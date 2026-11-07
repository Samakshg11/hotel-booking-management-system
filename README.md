# Hotel Management System (Modular Monolith)

> Built for **Algions AI Labs** Take-Home Internship Assessment (Full-Stack Engineer Role).
> Focused on **correctness, explainability, and ownership**.

---

## 1. System Architecture

A modular monolith structured with clear boundary separation:
- **Routes**: Route definitions and middleware bindings only.
- **Controllers**: Thin HTTP boundary (parses requests, calls services, formats responses). Never accesses models directly.
- **Services**: Pure business domain logic (booking transactions, concurrency locking, state machine, idempotency, reporting). Never accesses `req` or `res`.
- **Models**: Mongoose schemas enforcing MongoDB compound unique indexes, validation, and TTL indices.
- **Docs**: Comprehensive architectural and interview explanations in `/docs`.

```
hotel-management-system/
├── docker-compose.yml       # Local MongoDB single-node Replica Set (rs0)
├── .env.example             # Safe environment configuration template
├── docs/
│   ├── ER.md                # Complete Mermaid ER diagram
│   ├── EXPLAIN.md           # 5-8 lines per module (What, Why, How to Demo)
│   ├── REPORT.md            # Occupancy & Revenue calculations rationale
│   ├── AI_ATTRIBUTION.md    # Tooling and assistance documentation
│   └── test-evidence.md     # Test execution logs and coverage
├── server/
│   ├── src/
│   │   ├── config/          # Environment, Mongoose DB connection, Pino logger
│   │   ├── models/          # User, RoomType, Room, RateOverride, RoomNight, Booking, Payment, AuditLog, IdempotencyKey
│   │   ├── routes/          # API v1 routes
│   │   ├── controllers/     # Thin controllers
│   │   ├── services/        # Business logic services
│   │   ├── middleware/      # authenticate, authorize, validate, idempotency, errorHandler, rateLimit
│   │   ├── utils/           # dates, money (paise), reference generator, errors
│   │   └── seed/            # Demo seeding script
│   ├── tests/               # Jest + Supertest + MongoMemoryReplSet integration tests
│   └── openapi.yaml         # Complete OpenAPI 3.0 specification served at /api/docs
└── client/                  # React 18 + Vite + Tailwind CSS + TanStack Query
```

---

## 2. Core Non-Obvious Logic & Engineering Decisions

### A. The "Unique-Index Trick" for Zero Double-Bookings
- **Problem**: Range overlap checks (`$lt` / `$gt`) are susceptible to phantom reads and race conditions under concurrent requests.
- **Solution**: Every occupied night for a room is represented by an individual document in the `roomNights` collection with a compound unique index:
  ```javascript
  roomNightSchema.index({ roomId: 1, date: 1 }, { unique: true });
  ```
- **Atomicity**: During `POST /api/v1/bookings/hold`, within a multi-document transaction (`session.withTransaction`), documents are inserted for each night of the stay `[checkIn, checkOut)`.
- If two users attempt to reserve the same room for overlapping dates simultaneously, MongoDB raises a duplicate key error (`E11000`). The transaction catches this error and automatically falls back to the next available room of that type, or returns `409 NO_AVAILABILITY` if none remain.

### B. Idempotency Key Engine
- `POST /api/v1/bookings/:id/confirm` requires an `Idempotency-Key` header.
- Cached responses are keyed by `{ key: 1, userId: 1 }` with a SHA-256 request payload hash.
- **Matching key + matching payload**: Returns cached `200 OK` response without duplicate payment or booking execution.
- **Reused key + modified payload**: Returns `422 IDEMPOTENCY_KEY_REUSED`.

### C. Booking State Machine
Centralized single source of truth for all booking status transitions:
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
Any invalid transition strictly returns `409 INVALID_TRANSITION` with `from` and `to` details.

---

## 3. Assumptions (Section 6 & Ambiguity Resolutions)

Per assessment Rule 6 (*"If a requirement is ambiguous, choose the simplest safe interpretation, state the assumption in README.md > Assumptions, and continue"*):
1. **Currency**: All monetary values are represented as integer minor units (**paise**, where 100 paise = ₹1.00) to prevent floating-point rounding errors.
2. **Stay Dates (Check-out turnover)**: Dates are stored with date-only semantics (UTC midnight `YYYY-MM-DD`). The night of `checkOut` is not an occupied night, permitting same-day room turnover (e.g., Guest A checks out on 2026-12-05 at noon, and Guest B checks in on 2026-12-05 at 2 PM).
3. **Hold Expiry**: Holds default to **10 minutes** (`HOLD_MINUTES=10`). Expired holds are ignored during availability search and cleaned up atomically before creating new holds.
4. **Simulated Payment Gateway**: Card numbers ending in `0000` deterministically trigger `PAYMENT_DECLINED` (`400`). Any other card number simulates a successful transaction (`SUCCEEDED`).
5. **Revenue Calculation Rule**: Revenue is calculated as the sum of `price.total` for bookings in `CONFIRMED`, `CHECKED_IN`, or `CHECKED_OUT` status whose stay overlaps with the query date range.
6. **Occupancy Formula**: `Occupancy Rate = (occupied room-nights in range) / (active rooms * days in range) * 100%`.

---

## 4. Implementation Phases (Section 14)

- [x] **Phase 1: Project Setup, Tooling, Database & Auth Core**
  - Modular directory layout, Docker Compose replica set (`rs0`), `.env.example`.
  - Mongoose models with validation & declared compound indexes.
  - JWT auth, server-side RBAC, centralized error handling, and test harness (`MongoMemoryReplSet`).
- [ ] **Phase 2: Room Catalog, Rates & The Unique-Index Concurrency Engine**
  - Room type and room management.
  - Real-time availability search with pagination.
  - Atomic room hold with transaction fallback on duplicate key collision.
- [ ] **Phase 3: State Machine, Idempotent Payments & Cancellations**
  - Deterministic simulated card payment.
  - Idempotency middleware & cache lookup.
  - Cancellation with 24-hour refund window policy.
- [ ] **Phase 4: Front Desk Housekeeping Board, Admin Reports & Audit Logs**
  - Check-in / check-out workflows with auto-room status update.
  - Aggregation pipeline for Revenue and Occupancy.
  - Append-only audit trail.
- [ ] **Phase 5: React + Vite + Tailwind Client with Role Switcher**
  - 1-click role switcher between Demo Guest, Staff, and Admin.
  - Responsive booking flow, front desk board, and admin KPI dashboard.
- [ ] **Phase 6: CI/CD, Documentation, and Interview Defense**
  - GitHub Actions workflow, complete OpenAPI docs, `docs/EXPLAIN.md`.

---

## 5. Quick Start (Local Run)

### Prerequisites
- Node.js 20+
- Docker & Docker Compose (or MongoDB Atlas M0 URI)

### 1. Start MongoDB Replica Set
```bash
docker compose up -d
```

### 2. Install & Seed
```bash
# In server directory
cd server
npm install
npm run seed
```

### Demo Accounts
| Role | Email | Password |
|---|---|---|
| **Guest** | `guest@hotel.com` | `Password123!` |
| **Staff** | `staff@hotel.com` | `Password123!` |
| **Admin** | `admin@hotel.com` | `Password123!` |

### 3. Run Tests
```bash
cd server
npm test
```
