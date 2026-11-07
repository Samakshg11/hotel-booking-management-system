# Entity Relationship Diagram

```mermaid
erDiagram
    users ||--o{ bookings : "places"
    users ||--o{ auditLogs : "initiates"
    roomTypes ||--o{ rooms : "classifies"
    roomTypes ||--o{ rateOverrides : "seasonal rates"
    rooms ||--o{ bookings : "reserved in"
    rooms ||--o{ roomNights : "occupied nights"
    bookings ||--o{ roomNights : "locks"
    bookings ||--o{ payments : "paid by"

    users {
        ObjectId _id PK
        string name
        string email UK "unique, lowercase"
        string passwordHash
        string role "guest | staff | admin"
        string phone
        date createdAt
        date updatedAt
    }

    roomTypes {
        ObjectId _id PK
        string name UK "unique"
        string description
        int capacity ">= 1"
        string[] amenities
        int baseRate "integer minor units (paise)"
        boolean isActive "default true"
        date createdAt
        date updatedAt
    }

    rooms {
        ObjectId _id PK
        string roomNumber UK "unique, e.g. 101"
        ObjectId roomTypeId FK
        int floor
        string status "available | maintenance | out_of_service"
        date createdAt
        date updatedAt
    }

    rateOverrides {
        ObjectId _id PK
        ObjectId roomTypeId FK
        string startDate "YYYY-MM-DD"
        string endDate "YYYY-MM-DD"
        int rate "integer minor units (paise)"
        date createdAt
        date updatedAt
    }

    roomNights {
        ObjectId _id PK
        ObjectId roomId FK
        string date "YYYY-MM-DD (UTC midnight)"
        ObjectId bookingId FK
        string status "HELD | CONFIRMED"
        date expiresAt "only for HELD (TTL index for cleanup)"
        date createdAt
    }

    bookings {
        ObjectId _id PK
        string reference UK "HB-<YYYYMMDD>-<5 char base32>"
        ObjectId guestId FK
        ObjectId roomId FK
        ObjectId roomTypeId FK
        string checkIn "YYYY-MM-DD"
        string checkOut "YYYY-MM-DD"
        int nights
        int guests
        string status "HELD | CONFIRMED | CHECKED_IN | CHECKED_OUT | CANCELLED | EXPIRED"
        object guestDetails "fullName, email, phone"
        object price "nightly[], subtotal, taxRate, tax, fees, total"
        date holdExpiresAt
        date cancelledAt
        string cancellationReason
        string idempotencyKey
        date createdAt
        date updatedAt
    }

    payments {
        ObjectId _id PK
        ObjectId bookingId FK
        int amount "paise"
        string status "SUCCEEDED | FAILED | REFUNDED | PARTIALLY_REFUNDED"
        string method "SANDBOX"
        string providerRef
        date createdAt
    }

    idempotencyKeys {
        ObjectId _id PK
        string key "unique with userId"
        ObjectId userId FK
        string requestHash
        int responseStatus
        object responseBody
        date createdAt "TTL 24h"
    }

    auditLogs {
        ObjectId _id PK
        ObjectId actorId FK
        string actorRole "guest | staff | admin"
        string action
        string entityType "Booking | Room | User | Payment"
        string entityId
        object before
        object after
        object meta
        date createdAt
    }
```

### Critical Concurrency & Database Rules:
1. **The Unique-Index Trick**: `roomNights` has `{ roomId: 1, date: 1 }` UNIQUE index. One document per room per occupied night. The check-out date is NOT a night, enabling same-day turnover.
2. **MongoDB Multi-Document Transactions**: `session.withTransaction()` guarantees atomic hold, payment, and state changes.
3. **Idempotency**: `idempotencyKeys` with `{ key: 1, userId: 1 }` UNIQUE index ensures safe retries without double-charging or duplicate bookings.
4. **State Machine**: Enforced via central `TRANSITIONS` dictionary across all endpoints.
