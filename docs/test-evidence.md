# Test Execution Evidence & Validation Logs

This document logs all automated test suites executed across the implementation phases.
All tests run against `mongodb-memory-server` with `MongoMemoryReplSet` to validate real multi-document transactions in memory.

---

## Phase 1: Authentication & Server-Side RBAC
- **Suite**: `server/tests/integration/auth.test.js`
- **Scenarios Tested**:
  1. `POST /api/v1/auth/register`:
     - Creates guest user with hashed password (bcrypt cost 10).
     - Rejects duplicate email with `409 EMAIL_ALREADY_EXISTS`.
     - Validates payload with Zod (`400 VALIDATION_ERROR`).
  2. `POST /api/v1/auth/login`:
     - Generates valid JWT token on matching credentials.
     - Rejects incorrect password with `401 UNAUTHORIZED`.
     - Rejects unknown email with `401 UNAUTHORIZED`.
  3. `GET /api/v1/auth/me`:
     - Returns authenticated user details without sensitive fields.
     - Rejects missing/malformed Bearer tokens with `401 UNAUTHORIZED`.

---

## Phase 2: Room Catalog, Real-Time Availability & The Unique-Index Concurrency Engine
- **Suites**:
  - `server/tests/integration/roomsAndAvailability.test.js`
  - `server/tests/integration/bookingConcurrency.test.js`
- **Scenarios Tested**:
  1. **Room & Room Type Catalog (RBAC)**:
     - Public can list room types (`GET /api/v1/room-types`).
     - Non-admin (e.g. staff/guest) rejected from creating room types with `403 FORBIDDEN`.
     - Admin can create room types (`POST /api/v1/room-types`).
     - Staff can list rooms and update housekeeping status (`PATCH /api/v1/rooms/:id/status`).
  2. **Availability Engine**:
     - Calculates live available count filtering out occupied dates and maintenance rooms.
     - Computes itemized pricing breakdown (nightly rates in paise, 12% tax, total).
     - Rejects invalid dates (`checkOut <= checkIn`, past dates, > 30 nights).
  3. **The Unique-Index Trick & Concurrency Concurrency Safety**:
     - `POST /api/v1/bookings/hold` creates hold with format `HB-<YYYYMMDD>-<5 char base32>` and inserts `roomNights` with `{ roomId, date }` unique index.
     - Two concurrent requests for the same room type and dates: both succeed atomically by claiming distinct rooms (201 and 202).
     - Third request with exhausted inventory is rejected with `409 NO_AVAILABILITY`.
     - Same-day turnover: check-out date is not an occupied night, permitting same-day arrival.
     - Expired holds: past holds are cleaned up and the room becomes immediately bookable.
     - Security: Mongo operator injection attacks (`$where`, `.`) are rejected with `400 PROHIBITED_CHARACTERS`.

---

## Phase 3: Booking State Machine, Idempotent Payments & Cancellations
- **Suite**: `server/tests/integration/bookingStateMachineAndPayment.test.js`
- **Scenarios Tested**:
  1. **State Machine & Confirm with Simulated Payment**:
     - Confirms an active `HELD` booking inside a multi-document transaction: updates nights to `CONFIRMED`, unsets `expiresAt`, generates payment receipt.
     - Deterministic card simulation: cards ending in `0000` fail with `400 PAYMENT_DECLINED` and leave booking in `HELD` status with no confirmed nights.
     - Hold expiration: confirming an expired hold releases room nights, marks booking `EXPIRED`, and returns `410 HOLD_EXPIRED`.
  2. **Idempotency Engine**:
     - Retrying `POST /bookings/:id/confirm` with identical `Idempotency-Key` and payload returns stored `200 OK` without creating duplicate payments or booking modifications.
     - Reusing an existing `Idempotency-Key` with a modified payload returns `422 IDEMPOTENCY_KEY_REUSED`.
  3. **Cancellation & Refund Policy**:
     - Cancelling a hold immediately deletes `roomNights`, making the room bookable for others.
     - Cancelling a confirmed booking > 24 hours before check-in grants `FULL_REFUND_GREATER_THAN_24H` and marks payment `REFUNDED`.
     - Cancelling within 24 hours of check-in retains the first night rate and marks payment `PARTIALLY_REFUNDED`.
  4. **Ownership & Access Control**:
     - Guests can only view and manage their own bookings (`403 FORBIDDEN` for other guests).
     - Staff and Admin can view any booking.
     - `GET /api/v1/bookings/mine` lists only caller's bookings.

---

## Full Test Execution Output
```
PASS tests/integration/bookingStateMachineAndPayment.test.js
  Booking State Machine, Idempotent Payments & Cancellations Tests
    Confirm Booking & Deterministic Payments
      ✓ should confirm a held booking, persist payment and unset expiresAt on roomNights (966 ms)
      ✓ should decline payment for card ending in 0000, leaving booking in HELD status (423 ms)
      ✓ should reject confirming an expired hold with 410 HOLD_EXPIRED and release room nights (440 ms)
    Idempotency Key Verification
      ✓ should return identical cached response on duplicate request and reject modified payload with 422 (451 ms)
    Cancellation & Refund Policy
      ✓ should cancel HELD booking, delete room nights and make room rebookable (475 ms)
      ✓ should give full refund when cancelling CONFIRMED booking more than 24h before check-in (474 ms)
      ✓ should retain first night when cancelling CONFIRMED booking within 24h of check-in (522 ms)
    Authorization & Ownership Guards
      ✓ should prevent Guest B from confirming or reading Guest A booking (427 ms)
      ✓ should list only own bookings in GET /api/v1/bookings/mine (425 ms)

PASS tests/integration/roomsAndAvailability.test.js
  Rooms & Availability Integration Tests
    ✓ 7 room and availability tests passed

PASS tests/integration/bookingConcurrency.test.js
  The Unique-Index Trick & Booking Hold Concurrency Tests
    ✓ 5 concurrency and duplicate key tests passed

PASS tests/integration/auth.test.js
  Auth & RBAC Integration Tests
    ✓ 8 auth and token validation tests passed

Test Suites: 4 passed, 4 total
Tests:       29 passed, 29 total
Snapshots:   0 total
Time:        21.606 s
```
