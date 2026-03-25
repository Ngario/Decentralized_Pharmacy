# Smart Vending Pharmacy - Development Rules

## Goals
- Build an MVP quickly, but keep the codebase **scalable, safe, and audit-friendly**.
- Prevent “double-dispense” and payment/dispense race conditions via **state machines + idempotency**.
- Minimize runtime errors with **type-safe contracts, validation, and tests**.

## Architecture (high-level)
1. **Backend is the source of truth** for:
   - inventory reservation/commit
   - payment verification status
   - pharmacist approvals/rejections
   - dispense job creation and dispatch
2. Frontend stores only **ephemeral UI state** (cart draft). The backend persists the order on checkout.
3. Hardware controllers are **dumb execution devices**:
   - they execute signed dispense jobs
   - they report dispense completion/failures back to the backend

## Backend folder conventions (Express + TypeScript)
- `src/controllers/`: request/response handling (thin)
- `src/routes/`: route wiring (thin)
- `src/services/`: business logic (unit-testable)
- `src/db/`: DB client + repositories
- `src/workers/`: background jobs (payment reconciliation, dispense orchestration, retries)
- `src/lib/`: cross-cutting utilities (idempotency, crypto/signing, validators)

## Data splitting rules (explicit)
- Client cart items do NOT decrement stock until:
  - payment is verified (and any required pharmacist approval exists)
  - backend creates and dispatches a dispense job
- Stock is decremented only when:
  - backend receives a successful dispense completion from the machine
  - and commits inventory movement + order status
- Pharmacist approvals do NOT directly dispense:
  - they only move order state toward `APPROVED`
  - dispensing still depends on `PAYMENT_VERIFIED` + policy

## API contract rules
- Every endpoint must:
  - validate request bodies with **Zod** (or equivalent)
  - return typed responses
  - use consistent error shapes (`{ code, message, details? }`)
- All monetary values:
  - are stored as `*_cents` (bigint/int) in the backend
  - are only formatted to currency in the UI

## Idempotency & anti-double-dispense (non-negotiable)
- Payments: callback processing must be idempotent using:
  - `payment.idempotency_key` for STK push initiation
  - `payment_events.idempotency_key` for Daraja callbacks
- Dispense jobs:
  - create exactly once per order (`orders -> dispense_jobs` is 1:1)
  - machine accepts only signed dispense jobs (HMAC/signature)

## Checks & validation (run continuously)
1. Type checking: `npm run typecheck`
2. Linting: `npm run lint`
3. Unit tests: `npm run test`
4. Integration tests (API + DB): `npm run test:integration`
5. API contract sanity: run OpenAPI generation check (once added)

## Testing strategy (incremental)
- Unit tests (fast):
  - payment state transitions
  - approval gating logic
  - dispense job creation logic
- Integration tests (real DB):
  - “order checkout -> payment verified -> dispense job created”
  - “duplicate callback does not create duplicate jobs”
- Hardware tests (simulated):
  - device receives job, reports completion, backend commits inventory

## CI recommendation (later, after first build)
- Add GitHub Actions / similar:
  - lint + typecheck
  - unit + integration tests
  - build artifacts check for frontend

