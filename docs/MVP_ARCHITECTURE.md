# MVP Architecture (Smart Vending Pharmacy – “DawaFlow”)

This document explains the **current MVP code architecture** in this repo, how the files connect, and how the end‑to‑end workflow behaves today. It is written for **understanding** (not marketing).

---

## What “MVP” means in this codebase

The MVP is designed so you can:
- Run everything locally
- Click through the kiosk/client UI and pharmacist dashboard UI
- Simulate payments (STK push) and status changes
- Validate the UI flow and API contracts early

To ship fast, the backend currently uses **in‑memory stores** (Maps) instead of PostgreSQL. The **database schema already exists** (SQL scripts), and the backend is intentionally structured to be upgraded to a real DB without rewriting the UI.

---

## Repo structure (top-level)

- **`backend/`**: Node.js + TypeScript server (Express). Provides APIs used by the UI.
- **`frontend/`**: React + TypeScript “tablet/kiosk style” UI and pharmacist dashboard.
- **`db/postgres/`**: SQL scripts for creating the PostgreSQL database and schema.
- **`docs/`**: architecture + dev rules + UI/API specs.
- **`hardware/arduino/`**: placeholder for Arduino integration (not wired yet in MVP).

---

## Backend: how it is organized (`backend/`)

### Goal
Provide a stable, type-safe API surface that matches the UI needs:
- categories
- OTC suggestions
- cart
- checkout
- payment initiation (STK push)
- order status
- pharmacist approvals

### Key backend files

#### `backend/src/server.ts`
Starts the HTTP server and attaches Socket.IO (real-time is minimally stubbed in MVP).

Responsibilities:
- Boot Express app created in `createApp()`
- Create HTTP server
- Create Socket.IO server and basic join handler (placeholder)

#### `backend/src/app.ts`
Express application composition.

Responsibilities:
- Configure middleware: `helmet`, `cors`, `morgan`, JSON parser
- Add `/healthz`
- Mount API router at `/api`
- Provide a central error handler that returns a consistent error shape

#### `backend/src/routes/api.ts`
This is the **MVP API implementation**.

What’s inside:
- Endpoint definitions (Express `Router`)
- Request validation with **Zod**
- **In-memory stores** that act like “temporary DB tables”
- Stub catalog data (a few SKUs) so the UI can show suggestions and build carts
- Simulated M‑Pesa callback (a timer that marks a payment as verified)

In MVP, there is no separate controllers/services layer yet — everything is in this file to keep the MVP moving. The **next step** is splitting this into controllers/services/repositories while keeping routes stable.

#### `backend/src/routes/api.spec.ts`
Smoke tests with Supertest + Vitest.

Purpose:
- prevent accidental breakage of critical endpoints
- keep “no errors” culture while iterating

### “Models” in the backend MVP
In `api.ts`, you’ll see TypeScript types such as:
- `Cart`, `Order`, `Payment`, `PharmacistRequest`, `Consultation`

These are **domain models** in-memory. Later, their fields will map to the PostgreSQL schema under `db/postgres/init_schema.sql`.

---

## Frontend: how it is organized (`frontend/`)

### Goal
Provide two UIs:
- **Client/Kiosk UI**: select category → suggestions → cart → checkout → payment status
- **Pharmacist UI**: view approval queue → approve/reject

### Key frontend files

#### `frontend/src/main.tsx`
App bootstrap:
- mounts React app into `#root`
- sets up `BrowserRouter`
- imports global styles from `index.css`

#### `frontend/src/index.css`
Global styling:
- Tailwind base/components/utilities directives
- Poppins font + system sans fallback

#### `frontend/src/App.tsx`
Routing + global layout use.

Important idea:
- Each route is wrapped in a reusable page layout: **`DawaPageLayout`**
- This guarantees consistent sticky header/footer across screens

#### Reusable layout components
- **`frontend/src/components/layout/DawaPageLayout.tsx`**
  - Provides background (radial gradient)
  - Renders `StickyHeader`
  - Renders `children` (screen content)
  - Renders `StickyFooter`
- **`frontend/src/components/layout/StickyHeader.tsx`**
  - Sticky top bar
  - Uses a gradient opposite direction of the footer (visual “contrast”)
- **`frontend/src/components/layout/StickyFooter.tsx`**
  - Sticky bottom bar
  - Gradient background

#### Screens (Views)
Client:
- **`frontend/src/screens/client/LandingScreen.tsx`**: category grid
- **`frontend/src/screens/client/ProductSelectionScreen.tsx`**: symptoms input + suggestions + cart build
- **`frontend/src/screens/client/CartCheckoutScreen.tsx`**: checkout + STK push + polling status
- **`frontend/src/screens/client/PharmacistConsultationScreen.tsx`**: consultation placeholder + recommendations polling

Pharmacist:
- **`frontend/src/screens/pharmacist/RequestsQueueScreen.tsx`**: list open requests + approve/reject

#### API client layer
The frontend does not call `fetch()` everywhere. It uses a small API client:

- **`frontend/src/api/http.ts`**
  - `apiFetch()` wrapper (base URL, headers, JSON parse)
  - Normalizes backend errors into `ApiError`

- **`frontend/src/api/clientApi.ts`**
  - Functions like `getCategories()`, `getOtcSuggestions()`, `createCart()`, `checkoutCart()`, `stkPush()`, etc.
  - Uses **Zod parsing** on responses to catch contract drift early

This is a key MVP best practice: **fail fast** when API responses change.

---

## How the MVP workflow works (end-to-end)

Below is the current runtime story: what happens when a user clicks through.

### 1) Landing → category tap
Frontend:
- `LandingScreen` loads categories via `getCategories()`
Backend:
- `GET /api/client/categories` returns the list of categories
Navigation:
- When a category is clicked, UI navigates to `/products`

### 2) Product selection → suggestions
Frontend:
- User optionally types symptoms
- Clicks “Get OTC suggestions”
- `ProductSelectionScreen` calls `getOtcSuggestions()`
Backend:
- `POST /api/otc/suggestions` validates body using Zod
- Returns a list of stub suggestions (ranked by simple keyword/category logic)

### 3) Add to cart
Frontend:
- First time you add: create a cart via `createCart()`
- Add item via `addCartItem()`
Backend:
- `POST /api/carts` creates an in-memory cart
- `POST /api/carts/:cartId/items` adds/upserts item qty

### 4) Checkout → order created
Frontend:
- On checkout, `CartCheckoutScreen` calls `checkoutCart()`
Backend:
- `POST /api/carts/:cartId/checkout` creates an order
- **Policy gating (MVP rule):**
  - If any SKU has `requiresPharmacistReview=true`
  - then a pharmacist request is created and order moves to `PENDING_PHARMACIST`
  - otherwise order is `PAYMENT_PENDING`

### 5) Payment initiation (STK push)
Frontend:
- calls `stkPush({ orderId, phone })`
Backend:
- `POST /api/payments/mpesa/stkpush` creates a Payment record in memory
- MVP simulates the Daraja callback after a short delay:
  - sets payment status `VERIFIED`
  - updates the order status accordingly

### 6) Pharmacist approval (if required)
Pharmacist UI:
- loads open requests from `GET /api/pharmacist/requests?status=OPEN`
- approves using `POST /api/pharmacist/requests/:id/approve`
Backend:
- marks pharmacist request approved
- updates order to `APPROVED`
- once payment is verified + approval is present, MVP may move order to `DISPENSED`

### 7) Client sees status updates
Client UI:
- `CartCheckoutScreen` polls `GET /api/orders/:orderId/status`
- UI updates its phase/status display

---

## Where the database fits (now vs next)

### Current MVP (now)
- `backend/src/routes/api.ts` uses Maps as storage.
- The SQL scripts exist but are not wired:
  - `db/postgres/create_database.sql`
  - `db/postgres/init_schema.sql`

### Next iteration (planned)
Replace the in-memory Maps with:
- PostgreSQL tables (already defined in schema)
- Repositories in `backend/src/db/`
- Transaction-safe workflows:
  - inventory reserve/commit
  - idempotent payment callback processing
  - dispense job creation + machine event auditing

The frontend should not need to change much because the API contracts are already in place.

---

## How “Controllers / Services / Repositories” will look (upgrade path)

When we harden the MVP, `backend/src/routes/api.ts` will be split like this:

1. **Routes** (`src/routes/*`)
   - “wiring only” (path → controller)
2. **Controllers** (`src/controllers/*`)
   - request parsing
   - response mapping
   - no business logic
3. **Services** (`src/services/*`)
   - business rules (policy gating, state transitions, idempotency)
4. **Repositories** (`src/db/*`)
   - SQL queries + transactions
5. **Types/DTOs** (`src/types/*`)
   - shared typed shapes for responses

This allows scaling without turning code into a “giant route file”.

---

## Why the sticky header/footer layout was made reusable

The kiosk UI and pharmacist UI should feel like one product. The reusable layout ensures:
- consistent branding across all screens
- consistent sticky behavior (top/bottom)
- consistent typography and spacing
- only the “content area” changes per screen

Implementation:
- `App.tsx` wraps each screen in `DawaPageLayout`
- each screen becomes a simpler “view” focused on its content + calls

---

## Quick mental model: how files “talk”

**Frontend screen** → calls → **frontend API client** → calls → **backend route** → updates → **in-memory store** → returns → **frontend updates UI**

Later:
**backend route/controller** → **service** → **repository (Postgres)** → returns

---

## Reference docs you can also read
- `docs/DEV_RULES.md` (dev rules, idempotency, testing expectations)
- `docs/client-and-pharmacist-interface-spec.md` (screen flows + API contract targets)

