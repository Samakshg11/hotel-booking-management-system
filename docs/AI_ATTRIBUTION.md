# AI Attribution & Engineering Tooling

## Context & Integrity
In accordance with Algions AI Labs evaluation standards:
- **Evaluation Criteria**: Correctness, explainability, architectural clarity, and candidate code ownership.
- **Role of AI**: AI was utilized as an accelerated pair-programming assistant to generate scaffolding, boilerplate types, and initial schemas according to the specification.
- **Candidate Ownership**: The full-stack architecture, transactions, unique index trick, state machine, and error handling are designed to be understood and modified live in a 10-minute technical interview.

## Core Architectural Patterns
1. **The Unique Index Concurrency Trick**:
   - Concurrency locking using compound unique index `{ roomId: 1, date: 1 }` on `roomNights`.
   - Handled inside MongoDB multi-document transactions with duplicate-key fallback across candidate rooms.
2. **Deterministic State Machine**:
   - Single source of truth `TRANSITIONS` dictionary preventing invalid state jumps.
3. **Idempotency Engine**:
   - SHA-256 payload hashing combined with `{ key: 1, userId: 1 }` unique indexing to prevent duplicate billing and race conditions.
4. **Server-Side Authorization**:
   - JWT tokens with strict server-side RBAC middleware (`guest`, `staff`, `admin`).
