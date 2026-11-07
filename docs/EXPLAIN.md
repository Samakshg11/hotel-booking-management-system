# Interview Walkthrough & Module Explanation Guide (docs/EXPLAIN.md)

This document provides per-module walkthrough notes for the live technical interview.
For each module, it provides:
1. **What it does**
2. **Why this design**
3. **How to demo it live**
4. **How to modify it in 10 minutes**

---

## 1. Authentication & Role-Based Access Control (`authService.js`, `authenticate.js`, `authorize.js`)
- **What it does**: Provides bcrypt-hashed registration (cost 10), stateless JWT token issuance, and server-side RBAC enforcing permissions for `guest`, `staff`, and `admin`.
- **Why this design**: The assessment explicitly states: *"Authorization is always enforced server-side. Never rely on hiding UI buttons."* Self-registration is strictly hardcoded to the `guest` role, and role elevation is admin-only.
- **How to demo it**:
  1. Login with `guest@demo.test` / `Password123!`.
  2. Send `GET /api/v1/audit-logs` $\rightarrow$ Receive `403 FORBIDDEN`.
  3. Click "Admin" on the top demo switcher $\rightarrow$ Receive `200 OK`.
- **10-minute live modification**: To add a new role like `'manager'`, add `'manager'` to `User.js` enum, update `authorize('manager')` in route files, and add demo credentials.

---

## 2. Room & Rate Catalog (`roomService.js`, `RoomType.js`, `Room.js`, `RateOverride.js`)
- **What it does**: Manages room types (capacity, base rates, amenities) and individual rooms with housekeeping states (`available`, `maintenance`, `out_of_service`).
- **Why this design**: Separates abstract classification (`RoomType`) from physical inventory (`Room`), allowing multiple physical rooms to inherit shared pricing while maintaining independent maintenance lifecycles.
- **How to demo it**:
  1. As Admin, call `POST /api/v1/room-types` to create a new type.
  2. As Staff, call `PATCH /api/v1/rooms/:id/status` to mark room `101` in `maintenance`.
  3. Search availability $\rightarrow$ Room `101` is immediately removed from available inventory count.
- **10-minute live modification**: To add custom amenities or change status values, edit the `status` enum in `Room.js` and validation in `roomRoutes.js`.

---

## 3. The Unique-Index Concurrency Engine (`bookingHoldService.js`, `RoomNight.js`)
- **What it does**: Eliminates double-booking race conditions during simultaneous hold requests using MongoDB multi-document transactions and compound unique indexes.
- **Why this design**: Interval overlap queries (`$lt`/`$gt`) suffer from phantom reads and TOCTOU races under load. By decomposing stays into individual calendar dates with `{ roomId: 1, date: 1 }` UNIQUE index, MongoDB physically rejects duplicate bookings with error `11000`. The service catches `11000` and automatically assigns the next available candidate room or throws `409 NO_AVAILABILITY`.
- **How to demo it**:
  1. Run `npx jest tests/integration/bookingConcurrency.test.js -t "10 parallel holds"`.
  2. Watch 10 concurrent requests fire simultaneously for the last room: exactly 1 receives `201 Created` and 9 receive `409 NO_AVAILABILITY`.
- **10-minute live modification**: To change the hold duration, edit `HOLD_MINUTES` in `.env.example` or pass custom TTL in `bookingHoldService.js`.

---

## 4. Real-Time Availability & Pricing Engine (`availabilityService.js`, `pricingService.js`)
- **What it does**: Computes live room availability filtering out occupied dates, active holds, and maintenance rooms. Computes itemized pricing with tax (12%) in integer minor units (paise).
- **Why this design**: Avoids floating point rounding errors (`0.1 + 0.2 != 0.3`). The server recomputes prices from database base rates and `RateOverride` rules on both hold and confirmation, never trusting client-submitted totals.
- **How to demo it**:
  1. Call `GET /api/v1/availability?checkIn=2026-11-20&checkOut=2026-11-23&guests=2`.
  2. Inspect response: itemized nightly lines, subtotal, 12% tax, and total.
- **10-minute live modification**: To add weekend price surges, add an entry to `RateOverride` or adjust the calculation formula in `pricingService.js`.

---

## 5. Booking State Machine (`bookingStateMachine.js`)
- **What it does**: Enforces deterministic booking status transitions through a single source of truth dictionary:
  `HELD -> [CONFIRMED, CANCELLED, EXPIRED]`, `CONFIRMED -> [CHECKED_IN, CANCELLED]`, `CHECKED_IN -> [CHECKED_OUT]`.
- **Why this design**: Centralizing transitions prevents invalid state jumps across disparate controllers. Any illegal transition throws `409 INVALID_TRANSITION` with structured `{ from, to }` details.
- **How to demo it**:
  1. Attempt to check in a booking that is currently in `HELD` status.
  2. API immediately rejects the request with `409 INVALID_TRANSITION`.
- **10-minute live modification**: To allow cancelling a checked-in stay, add `'CANCELLED'` to `TRANSITIONS.CHECKED_IN`.

---

## 6. Payment Simulation & Idempotency Engine (`paymentService.js`, `idempotency.js`)
- **What it does**: Simulates card payments (cards ending in `0000` decline; others succeed) and protects mutating endpoints via `Idempotency-Key` headers and SHA-256 payload caching.
- **Why this design**: Network retries during booking confirmation must never double-charge or create duplicate bookings. If a key is reused with identical payload, it returns the cached response; if reused with different payload, it returns `422 IDEMPOTENCY_KEY_REUSED`.
- **How to demo it**:
  1. Confirm a booking with header `Idempotency-Key: test-1` and card `4111222233334444` $\rightarrow$ `200 OK`.
  2. Resend exact request $\rightarrow$ Returns identical cached response, no new payment created.
  3. Resend with different card number $\rightarrow$ Returns `422 IDEMPOTENCY_KEY_REUSED`.
  4. Send card ending in `0000` $\rightarrow$ Returns `400 PAYMENT_DECLINED`.
- **10-minute live modification**: To adjust the TTL, edit `expires: 86400` in `IdempotencyKey.js`.

---

## 7. Cancellation & 24h Refund Policy (`bookingService.js`)
- **What it does**: Cancels reservations, deletes `roomNights` to free up the room, and calculates refunds: 100% full refund if cancelled > 24 hours before check-in; first night retained if within 24 hours.
- **Why this design**: Protects hotel revenue from last-minute cancellations while offering fair flexibility for advance cancellations. Deleting `roomNights` inside the transaction immediately restores room availability.
- **How to demo it**:
  1. Cancel a confirmed booking scheduled 5 days in future $\rightarrow$ Payment status updates to `REFUNDED`.
  2. Cancel a confirmed booking starting today $\rightarrow$ Payment status updates to `PARTIALLY_REFUNDED`, retaining first night.
- **10-minute live modification**: To change the policy window from 24h to 48h, change `24` to `48` in `cancelBooking()`.

---

## 8. Front Desk Operations (`frontDeskService.js`)
- **What it does**: Handles guest check-in (validates today >= checkIn) and check-out, plus all-bookings query with filters.
- **Why this design**: Restricts check-in/out to `staff` and `admin` roles only. Enforces that early check-in is rejected unless `ALLOW_EARLY_CHECKIN=true`.
- **How to demo it**:
  1. In Front Desk page, click "Check In" on a confirmed booking whose arrival date is today $\rightarrow$ Transitions to `CHECKED_IN`.
  2. Click "Check Out" $\rightarrow$ Transitions to `CHECKED_OUT`.
- **10-minute live modification**: To auto-transition room status to `dirty` on check-out, call `room.status = 'dirty'` inside `checkOutGuest()`.

---

## 9. Reports & Financial Reconciliation (`reportService.js`)
- **What it does**: Aggregates occupancy % and gross revenue over arbitrary date ranges using MongoDB aggregation pipelines.
- **Why this design**: Reconciles 100% with raw bookings without manual reconciliation errors. Revenue is defined as sum of `price.total` for qualifying bookings (`CONFIRMED`, `CHECKED_IN`, `CHECKED_OUT`); occupancy is `occupied room-nights / (active rooms * days)`.
- **How to demo it**:
  1. Call `GET /api/v1/reports/summary?from=2026-11-01&to=2026-11-30`.
  2. Compare revenue total against the sum of total from `/bookings` query $\rightarrow$ Exactly identical.
- **10-minute live modification**: To add an Average Daily Rate (ADR) field, divide `totalRevenue` by `occupiedRoomNights` in `getSummaryReport()`.

---

## 10. Audit Logging (`auditService.js`, `AuditLog.js`)
- **What it does**: Records an append-only audit trail of sensitive actions (`BOOKING_HOLD`, `BOOKING_CONFIRM`, `BOOKING_CANCEL`, `BOOKING_CHECK_IN`, `BOOKING_CHECK_OUT`, `USER_ROLE_CHANGE`).
- **Why this design**: Ensures full regulatory compliance and forensic debugging by preserving `before` and `after` snapshots and actor identity.
- **How to demo it**:
  1. Promote a user or check in a guest.
  2. Visit `GET /api/v1/audit-logs` as Admin $\rightarrow$ Inspect the newly added audit entry.
- **10-minute live modification**: To log failed logins, call `AuditLog.create()` inside `authService.login()` when credentials fail.

---

## 11. Security & Mongo Operator Sanitization (`sanitizeMongo.js`)
- **What it does**: Recursively scans request body, query, and params for keys starting with `$` or containing `.`, rejecting them with `400 PROHIBITED_CHARACTERS`.
- **Why this design**: Protects against NoSQL injection attacks where attackers inject MongoDB query operators (`$gt`, `$where`, `$ne`) to bypass authentication or extract data.
- **How to demo it**:
  1. Send `POST /api/v1/auth/login` with `{"email": {"$gt": ""}, "password": "x"}`.
  2. API immediately rejects the request with `400 PROHIBITED_CHARACTERS`.
- **10-minute live modification**: To sanitize by stripping keys instead of rejecting, replace `return res.status(400)` with `delete obj[key]`.

---

## 12. Frontend Architecture & 1-Click Role Switcher (`AuthContext.jsx`, `Navbar.jsx`)
- **What it does**: Full React 18 single-page app with TanStack Query and a persistent top switcher bar enabling instant switching between Guest, Staff, and Admin test accounts without retyping passwords.
- **Why this design**: Drastically streamlines evaluator testing during technical interviews. Provides responsive, accessible interfaces with loading states, empty states, and toast notifications.
- **How to demo it**:
  1. Open `http://localhost:5173`.
  2. Click "Staff" $\rightarrow$ Nav bar and dashboard instantly update with front-desk controls.
  3. Click "Admin" $\rightarrow$ Admin analytics and audit tables become accessible.
- **10-minute live modification**: To add a new navigation tab, add a `<Link>` in `Navbar.jsx` and `<Route>` in `App.jsx`.
