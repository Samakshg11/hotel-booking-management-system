# 3-5 Minute Technical Demo Script & Walkthrough

> **Role & Assessment**: Algions AI Labs Take-Home Assessment (Full-Stack Role)  
> **Target Audience**: Senior Engineering Evaluator / Hiring Manager  
> **Key Focus**: Correctness, Database Concurrency, State Machine, and Architecture Separation

---

## ⏱️ Video Timeline & Screen Breakdown

| Timestamp | Screen / Action | What to Explain & Demonstrate |
|---|---|---|
| **0:00 - 0:30** | **Monorepo & Architecture** | Open terminal & editor: Show clean separation of `controllers/` (thin), `services/` (all business logic), `models/` (indexes), and `client/`. Show `docker-compose.yml` single-node replica set (`rs0`) required for multi-document ACID transactions. |
| **0:30 - 1:15** | **Live Guest Search & Booking Hold** | Navigate to `http://localhost:5173`. Click "Guest" on the top 1-click Demo Role Switcher. Search dates (`2026-11-20` to `2026-11-23`) for 2 guests. Point out itemized pricing calculation in paise. Click **Hold & Book**. Show the 10-minute countdown timer on the checkout page. |
| **1:15 - 2:00** | **Concurrency & The Unique-Index Trick** | Open second browser tab (or Incognito / curl). Attempt to hold the exact same room for the same dates. Show the immediate `409 Conflict (NO_AVAILABILITY)` response. Explain how compound unique index `{ roomId: 1, date: 1 }` on `roomNights` guarantees zero double-booking at the database engine level without fragile table locks. |
| **2:00 - 2:45** | **Simulated Payment & Idempotency** | On Tab 1: enter simulated card ending in `4444`. Click Pay. Show booking transition to `CONFIRMED`, `roomNights` marked confirmed, and provider reference generated. Mention that resending with the same `Idempotency-Key` returns the stored response without double-charging, while a modified payload returns `422`. (Optional: type card ending in `0000` to demo deterministic decline). |
| **2:45 - 3:30** | **Staff Operations & Housekeeping Board** | Click "Staff" on the top Demo Switcher. Navigate to **Front Desk**. Show the **Room Status Board** with real-time room statuses (`AVAILABLE`, `MAINTENANCE`, `OUT_OF_SERVICE`). In the Bookings Table, find the newly confirmed booking and click **Check In** (transitions to `CHECKED_IN`). Next, click **Check Out** (transitions to `CHECKED_OUT`). |
| **3:30 - 4:15** | **Admin Analytics & Audit Log** | Click "Admin" on the top Demo Switcher. Navigate to **Admin & Reports**. Show the KPI cards: Total Revenue, Occupancy Rate %, Occupied Room-Nights. Show that Revenue and Occupancy reconcile 100% via MongoDB aggregation pipelines against raw bookings. Click **Audit Trail** to show the tamper-evident log of all check-in, confirmation, and hold events. |
| **4:15 - 4:45** | **Automated Tests & ER Diagram** | Switch to terminal: run `cd server && npm test`. Show all 48 unit and integration tests passing in-memory with `MongoMemoryReplSet` (including the 10-parallel hold concurrency test). Finally, open `docs/ER.md` to show the complete Mermaid Entity Relationship diagram. |

---

## 🎙️ Spoken Script & Key Talking Points

### 1. Introduction (0:00 - 0:30)
> *"Hello! Today I'm demonstrating the Hotel Management System built for the Algions AI Labs take-home assessment. Our architecture is a modular monolith in a monorepo. We have separated concerns strictly: controllers are thin and never touch models; services contain all business logic and never touch HTTP request or response objects; and data models declare all unique and compound indexes upfront."*

### 2. Concurrency & The Unique-Index Trick (1:15 - 2:00)
> *"The hardest engineering problem in hotel reservations is concurrency: preventing two guests from booking the same room on overlapping dates. Rather than relying on fragile application-level range queries which suffer from race conditions under load, we use the Room-Night Unique-Index pattern. Every occupied night of a stay is stored as an individual document in `roomNights` with a compound unique index on `roomId` and `date`. When a hold is initiated inside a multi-document ACID transaction, MongoDB physically forbids duplicate date occupancy. If a collision occurs, our service catches code 11000 and automatically tries the next candidate room, or throws a 409 NO_AVAILABILITY if none remain."*

### 3. Payment Idempotency & State Machine (2:00 - 2:45)
> *"For payments, we protect against duplicate submissions using an `Idempotency-Key` header with SHA-256 payload hashing stored in MongoDB with a 24-hour TTL. Our central state machine strictly enforces legal transitions: HELD can transition to CONFIRMED, CANCELLED, or EXPIRED. Any illegal jump, such as checking in an unconfirmed booking, returns 409 INVALID_TRANSITION."*

### 4. Operations, Reports & Audit (2:45 - 4:15)
> *"For staff, we provide a live Housekeeping Status Board and Front Desk arrivals/departures workflows. For administrators, financial metrics are computed via MongoDB aggregation pipelines that reconcile 100% against raw booking totals and occupied room-nights. Every sensitive operation—from role changes to check-ins—writes to an append-only audit trail."*

### 5. Verification (4:15 - 4:45)
> *"All features are backed by comprehensive unit tests and Supertest integration tests running against `mongodb-memory-server` using `MongoMemoryReplSet` to validate real multi-document transactions."*
