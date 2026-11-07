# Module Explanations & Architecture Rationale

This document tracks each module in the Hotel Management System. For each module, it details:
1. **What it does**
2. **Why this design**
3. **How to demo it**

---

## 1. Authentication & Role-Based Access Control (RBAC)
- **What it does**: Provides secure user registration, login with hashed passwords (bcrypt), stateless JWT token issuance, and server-side role enforcement (`guest`, `staff`, `admin`).
- **Why this design**: Security rule: "Authorization is always enforced server-side. Never rely on hiding UI buttons." JWT bearer tokens keep the API stateless, while dedicated middleware (`authenticate` and `authorize`) validates permissions before any controller or service is invoked.
- **How to demo it**:
  1. Call `POST /api/auth/login` with `guest@hotel.com` / `Password123!`.
  2. Attempt to access `GET /api/admin/audit-logs` using the guest token -> Receive `403 Forbidden`.
  3. Login with `admin@hotel.com` -> Access is granted with `200 OK`.

---

## 2. Room & Rate Catalog
- **What it does**: Manages room types (capacity, base rates, amenities) and individual rooms with their operational status (`AVAILABLE`, `OCCUPIED`, `DIRTY`, `CLEANING`, `MAINTENANCE`).
- **Why this design**: Separating `RoomType` (metadata & pricing rules) from `Room` (physical instances and physical housekeeping states) enables flexible inventory scaling, dynamic rate calculations, and real-time housekeeping boards.
- **How to demo it**:
  1. Login as Admin and call `POST /api/rooms` to create a new room.
  2. View the rooms listing at `GET /api/rooms` or on the Staff Room Status Board.

---

## 3. Inventory & The Unique-Index Concurrency Engine
- **What it does**: Guarantees zero double-bookings and atomic reservations across overlapping date ranges using MongoDB compound unique indexes and multi-document transactions.
- **Why this design**: Range overlap queries are vulnerable to race conditions under concurrent requests. By mapping each night of a reservation to a unique `(roomId, date)` document in `RoomNight`, MongoDB's compound unique index physically forbids duplicate occupancy at the database engine level.
- **How to demo it**:
  1. Send two concurrent `POST /api/bookings/hold` requests for the exact same room and dates.
  2. One request will succeed with `201 Created` (status: `HOLD`).
  3. The competing request fails immediately with `409 Conflict` ("Room already booked for selected dates").

---

## 4. Booking State Machine & Idempotent Payments
- **What it does**: Enforces deterministic booking transitions (`HOLD` -> `CONFIRMED` -> `CHECKED_IN` -> `CHECKED_OUT`), auto-expires abandoned holds, and processes simulated payments with idempotency keys.
- **Why this design**: Financial operations require protection against double-charging during network drops or rapid button clicks. The idempotency middleware records the `Idempotency-Key` and returns identical responses for duplicate calls. The state machine strictly prevents illegal transitions (e.g. checking out a cancelled booking).
- **How to demo it**:
  1. Create a hold for a room -> status is `HOLD`.
  2. Call `POST /api/bookings/:id/pay` with header `Idempotency-Key: test-key-1`.
  3. Re-send the exact same request with the same header -> Returns the same payment receipt without reprocessing.

---

## 5. Front Desk & Room Status Board
- **What it does**: Allows hotel staff to view daily arrivals/departures, check guests in and out, and manage housekeeping states.
- **Why this design**: Streamlines operations by auto-transitioning room states: checking in marks room as `OCCUPIED`; checking out marks room as `DIRTY`. Staff can update room status to `CLEANING` and `AVAILABLE` when ready.
- **How to demo it**:
  1. Login as Staff.
  2. Check in a confirmed booking -> Room status switches to `OCCUPIED`.
  3. Perform check-out -> Booking status becomes `CHECKED_OUT` and Room status switches to `DIRTY`.

---

## 6. Admin Reports & Audit Logging
- **What it does**: Collects an append-only audit trail of all sensitive operations (role changes, status transitions, cancellations) and calculates hotel KPIs (Occupancy Rate, Total Revenue, ADR).
- **Why this design**: Compliance and debugging require an untampered log of who did what and when. Metric aggregation queries run over completed and active reservations.
- **How to demo it**:
  1. Perform any state transition or role change.
  2. Login as Admin and visit `GET /api/admin/audit-logs` to inspect the full event trail.
  3. Visit `GET /api/admin/reports` to inspect live metrics.

