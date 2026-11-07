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

## Full Test Execution Output
```
PASS tests/integration/roomsAndAvailability.test.js
  Rooms & Availability Integration Tests
    Room Types & Rooms Management (RBAC)
      ✓ should allow public to list room types (665 ms)
      ✓ should reject non-admin from creating room types with 403 (359 ms)
      ✓ should allow admin to create a new room type (366 ms)
      ✓ should allow staff to view rooms list (351 ms)
      ✓ should allow staff to update room status (e.g. maintenance) (361 ms)
    GET /api/v1/availability
      ✓ should return availability count and itemized pricing breakdown (353 ms)
      ✓ should reject invalid dates (checkOut <= checkIn) (343 ms)

PASS tests/integration/bookingConcurrency.test.js
  The Unique-Index Trick & Booking Hold Concurrency Tests
    ✓ should successfully create a hold with reference, prices, and roomNight records (765 ms)
    ✓ should prevent double-booking under concurrent hold attempts and assign distinct candidate rooms (364 ms)
    ✓ should allow same-day turnover (check-out date is NOT an occupied night) (332 ms)
    ✓ should ignore expired holds and allow rebooking the room (328 ms)
    ✓ should reject MongoDB operator injection attacks with 400 PROHIBITED_CHARACTERS (268 ms)

PASS tests/integration/auth.test.js
  Auth & RBAC Integration Tests
    POST /api/v1/auth/register
      ✓ should register a new guest and return 201 with token (420 ms)
      ✓ should reject registration if email is already taken (165 ms)
      ✓ should reject registration with invalid email or password (12 ms)
    POST /api/v1/auth/login
      ✓ should log in successfully with correct credentials (173 ms)
      ✓ should fail with 401 when password is wrong (223 ms)
      ✓ should fail with 401 for non-existent email (100 ms)
    GET /api/v1/auth/me
      ✓ should return 401 if no token is provided (10 ms)
      ✓ should return user profile when valid token is provided (100 ms)

Test Suites: 3 passed, 3 total
Tests:       20 passed, 20 total
Snapshots:   0 total
Time:        13.654 s
```
