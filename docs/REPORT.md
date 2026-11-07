# Engineering Report: Architectural Decisions & System Trade-Offs

> **Assessment**: Algions AI Labs Take-Home (Full-Stack Role)  
> **Author**: Senior Full-Stack Engineering Candidate  
> **Focus**: Correctness, Database Concurrency, ACID Guarantees, and Failure Modes

---

## 1. The Room-Night Unique Index Pattern vs. Alternatives

### The Fundamental Problem
Hotel reservation systems represent interval allocation over discrete calendar units. The critical failure mode is **double-booking**: two concurrent requests claiming the same room for overlapping date intervals $[S_1, E_1)$ and $[S_2, E_2)$ such that $\max(S_1, S_2) < \min(E_1, E_2)$.

### Alternative 1: Application-Level Range Overlap Queries (`$lt` / `$gt`)
- **How it works**: Before booking, query the database: `find({ roomId, checkIn: { $lt: requestedCheckOut }, checkOut: { $gt: requestedCheckIn } })`. If count is zero, insert new reservation.
- **Why it fails**: Classic Time-of-Check to Time-of-Use (**TOCTOU**) race condition. Under concurrent requests, two transactions execute the query simultaneously, both observe zero collisions, and both insert reservations. Even with MongoDB transactions, standard Read Committed isolation does not protect against phantom reads without range locks (which MongoDB lacks).

### Alternative 2: PostgreSQL Range Types with GiST Exclusion Constraints
- **How it works**: In PostgreSQL, `tsrange(check_in, check_out, '[)') WITH &&` physically enforces interval exclusion at the database engine level.
- **Why it was not chosen here**: The assessment tech stack mandates **Node.js, Express, MongoDB with Mongoose**. MongoDB does not natively support temporal range exclusion constraints.

### The Chosen Design: The Room-Night Unique Index Pattern
- **How it works**: Rather than storing occupancy as an abstract interval, we discretize the stay into individual calendar units: one document per room per occupied night in the `roomNights` collection:
  ```javascript
  {
    roomId: ObjectId("..."),
    date: "2026-11-20",      // UTC midnight string (YYYY-MM-DD)
    bookingId: ObjectId("..."),
    status: "HELD" | "CONFIRMED",
    expiresAt: ISODate("...") // For HELD only
  }
  ```
- **The Database Guarantee**:
  ```javascript
  roomNightSchema.index({ roomId: 1, date: 1 }, { unique: true });
  ```
- **Why this design**:
  1. **Engine-Level Atomicity**: The unique constraint is enforced by WiredTiger's B-Tree index at the storage layer. No application-level race condition can bypass a duplicate key error (`E11000`).
  2. **Same-Day Turnover**: The check-out date is not an occupied night (e.g., checkout on Nov 22 means the night of Nov 22 is free for another guest).
  3. **Candidate Room Fallback**: If request A and request B race for Room 101, request A succeeds and request B catches code 11000 and immediately falls back to candidate Room 102 inside the same loop. If no rooms remain, it responds with `409 NO_AVAILABILITY`.

---

## 2. Why Transactions + Replica Set

MongoDB operations on a single document are atomic, but booking a multi-night stay requires mutating multiple collections:
1. Deleting expired holds in `roomNights`.
2. Inserting $N$ new `roomNights` documents.
3. Creating the `Booking` master record.
4. Writing the append-only `AuditLog` entry.

Without multi-document transactions:
- If a duplicate key collision occurred on night 3 of a 5-night stay, nights 1 and 2 would remain orphaned in the database, permanently corrupting inventory.
- MongoDB requires a **Replica Set** (`rs0`) for multi-document ACID transactions because the transaction coordinator utilizes the oplog to manage two-phase commit across WiredTiger storage instances.
- **Local Dev**: Configured in `docker-compose.yml` with `mongod --replSet rs0` and an automatic healthcheck initialization step.
- **Test Harness**: Configured with `mongodb-memory-server` using `MongoMemoryReplSet` so that real multi-document ACID transactions execute in-memory with zero external dependencies.

---

## 3. Hold Expiry Strategy

### The Dual-Layer Approach (Correctness vs. Cleanup)
A major trap in reservation systems is relying solely on MongoDB TTL (Time-To-Live) indexes for hold expiration:
- **MongoDB TTL indexes run as a background task every 60 seconds**.
- Therefore, a hold that expired 10 seconds ago would still physically exist in the database, causing false "no availability" rejections for competing guests.

### Our Solution
1. **Application-Level Correctness (Immediate)**:
   - When searching availability: `findAvailableRoomsForType` ignores any `roomNights` with `status: 'HELD'` whose `expiresAt < now`.
   - When creating a hold: step 1 inside the transaction executes `RoomNight.deleteMany({ roomId, date: { $in: nights }, status: 'HELD', expiresAt: { $lt: now } })`. This immediately purges expired holds for the candidate room.
   - When confirming a hold: if `holdExpiresAt <= now`, the service marks the booking `EXPIRED`, deletes its room nights, writes an audit log, and rejects the confirmation with `410 HOLD_EXPIRED`.
2. **Database-Level Cleanup (Lazy Background)**:
   - A TTL index on `expiresAt` (`{ expireAfterSeconds: 0 }`) cleans up orphaned documents in the background if the server restarts.

---

## 4. Idempotency Design

### The Problem
In financial and booking transactions, network drops or impatient double-clicks can cause clients to resend `POST /bookings/:id/confirm`. Without idempotency, this results in double-charging or corrupt state transitions.

### Our Architecture
- Mutating endpoints accept an `Idempotency-Key` header (e.g. UUID).
- The `idempotencyKeys` collection stores:
  ```javascript
  {
    key: "unique-key-123",
    userId: ObjectId("..."),
    requestHash: "<SHA-256 of request payload>",
    responseStatus: 200,
    responseBody: { ... },
    createdAt: ISODate("...") // 24h TTL
  }
  ```
- **Compound Unique Index**: `{ key: 1, userId: 1 }` prevents cross-user key collision.
- **Execution Flow**:
  1. Intercept request before controller execution.
  2. Compute SHA-256 hash of `req.body`.
  3. If key exists with matching hash $\rightarrow$ Return cached response immediately (`200 OK`) without re-running transactions or payment gateway calls.
  4. If key exists with different hash $\rightarrow$ Return `422 IDEMPOTENCY_KEY_REUSED` (prevents parameter tampering).
  5. If key is new $\rightarrow$ Process transaction, intercept `res.json`, and cache the response status and body with a 24-hour TTL.

---

## 5. State Machine Architecture

### Central Source of Truth
State jumps must be deterministic and guarded centrally rather than scattered across controllers:
```javascript
const TRANSITIONS = {
  HELD: ['CONFIRMED', 'CANCELLED', 'EXPIRED'],
  CONFIRMED: ['CHECKED_IN', 'CANCELLED'],
  CHECKED_IN: ['CHECKED_OUT'],
  CHECKED_OUT: [],
  CANCELLED: [],
  EXPIRED: [],
};
```

### Safety Rules
- Every transition invokes `validateBookingTransition(currentStatus, targetStatus)`.
- Illegal jumps (e.g., trying to check in a `CANCELLED` or `HELD` booking) return `409 INVALID_TRANSITION` with structured metadata `{ from, to }`.
- Terminal states (`CHECKED_OUT`, `CANCELLED`, `EXPIRED`) have empty transition arrays and can never be modified.

---

## 6. Server-Side RBAC & Security Approach

### Defense in Depth
- **Rule**: "Authorization is always enforced server-side. Never rely on hiding UI buttons."
- Role hierarchy:
  - `guest`: Self-registration, room search, hold, confirm (simulated payment), view own bookings, cancel own bookings.
  - `staff`: Front-desk check-in, check-out, room status board (available, maintenance, out-of-service), guest records viewer, all-bookings search.
  - `admin`: All staff permissions plus room/rate CRUD, reports dashboard, audit log viewer, and user role management (`PATCH /admin/users/:id/role`).
- **Resource Ownership Guards**: On `/bookings/:id`, `/bookings/:id/confirm`, and `/bookings/:id/cancel`, the service verifies `booking.guestId === req.user.id` unless `req.user.role` is `staff` or `admin`.
- **Injection Sanitization**: Custom `sanitizeMongo` middleware recursively inspects `req.body`, `req.query`, and `req.params`, rejecting any keys starting with `$` or containing `.` with `400 PROHIBITED_CHARACTERS`.

---

## 7. Report Reconciliation Rules

### Mathematical Rationale
Reports must reconcile 100% against underlying booking records without manual drift:
1. **Total Gross Revenue**:
   - Sum of `price.total` (in integer paise) for bookings whose status is in `['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT']` and whose stay overlaps the date range $[from, to]$.
   - `HELD`, `CANCELLED`, and `EXPIRED` bookings contribute 0.
2. **Occupancy Rate (%)**:
   $$\text{Occupancy Rate} = \frac{\text{Count of CONFIRMED Room-Nights in } [from, to]}{\text{Active Rooms Count} \times \text{Days in Range}} \times 100\%$$
   - Active rooms exclude any rooms marked `out_of_service`.
   - Reconciled via MongoDB aggregation pipelines directly on `roomNights`.

---

## 8. Trade-Offs & Future Improvements

### Trade-Offs Made for the Take-Home
1. **Discretized Room-Nights vs Storage**: Storing one document per night per occupied room uses slightly more document storage than a single interval record. However, for a hotel with 100 rooms over 5 years, this is only ~180,000 tiny documents (~15 MB of storage), which is negligible compared to the massive benefit of 100% race-condition-free concurrency.
2. **In-Memory Replica Set in Tests**: `MongoMemoryReplSet` takes 3-4 seconds to spin up WiredTiger storage compared to 200ms for a mock database. However, this is the only way to test real multi-document ACID transactions and concurrency collisions honestly.

### What I Would Do Next in Production
1. **Distributed Locks for Room Allocation**: For 10,000 concurrent requests across a large chain, integrate Redis Redlock to coordinate room candidate selection before hitting MongoDB.
2. **Webhook Support**: Integrate Stripe/Razorpay webhooks for asynchronous payment status transitions.
3. **Optimistic Locking with Document Versioning**: Add `__v` concurrency checks for staff concurrently updating room housekeeping notes.
