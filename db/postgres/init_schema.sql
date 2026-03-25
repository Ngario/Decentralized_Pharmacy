-- Smart Vending Pharmacy - Schema Initialization
-- Important:
-- 1) Run this inside the target database: smart_vending_pharmacy
-- 2) If you use a different DB name, update the scripts accordingly
--
-- Example:
--   psql -U postgres -d smart_vending_pharmacy -f db/postgres/init_schema.sql

BEGIN;

CREATE SCHEMA IF NOT EXISTS svm;
SET search_path TO svm;

-- UUID generator used across tables
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------
-- Enums (status tracking)
-- -----------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'machine_status') THEN
    CREATE TYPE machine_status AS ENUM ('ONLINE', 'OFFLINE', 'PAUSED', 'FAULT');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE order_status AS ENUM (
      'CREATED',
      'PAYMENT_PENDING',
      'PAYMENT_VERIFIED',
      'PENDING_PHARMACIST',
      'APPROVED',
      'DISPENSE_QUEUED',
      'DISPENSED',
      'CANCELLED',
      'DISPENSE_FAILED'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM (
      'INITIATED',
      'PENDING_CALLBACK',
      'VERIFIED',
      'FAILED',
      'CANCELLED'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pharmacist_request_status') THEN
    CREATE TYPE pharmacist_request_status AS ENUM ('OPEN', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispense_job_status') THEN
    CREATE TYPE dispense_job_status AS ENUM ('CREATED', 'SENT', 'IN_PROGRESS', 'COMPLETED', 'FAILED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'movement_type') THEN
    CREATE TYPE movement_type AS ENUM ('RESERVE', 'RELEASE', 'DISPENSE', 'EXPIRE_ADJUST');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_actor_type') THEN
    CREATE TYPE audit_actor_type AS ENUM ('CLIENT', 'PHARMACIST', 'SYSTEM', 'MACHINE', 'ADMIN');
  END IF;
END $$;

-- -----------------------------
-- Master data
-- -----------------------------

CREATE TABLE IF NOT EXISTS machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_code text NOT NULL UNIQUE,
  location text,
  status machine_status NOT NULL DEFAULT 'ONLINE',
  firmware_version text,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL CHECK (role IN ('PHARMACIST', 'ADMIN')),
  name text NOT NULL,
  email text UNIQUE,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS medicines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  otc_classification text,
  requires_pharmacist_review boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS medicine_skus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id uuid NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  pack_size text,
  -- Pricing is stored per SKU (so promos/price changes can be tracked later)
  unit_price_cents bigint NOT NULL CHECK (unit_price_cents >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (medicine_id, pack_size)
);

CREATE TABLE IF NOT EXISTS batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_sku_id uuid NOT NULL REFERENCES medicine_skus(id) ON DELETE CASCADE,
  lot_number text NOT NULL,
  manufactured_at date,
  expires_at date NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (medicine_sku_id, lot_number, expires_at)
);

-- Inventory availability per machine + batch (implements "dispense lot" tracking)
CREATE TABLE IF NOT EXISTS inventory_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  quantity_on_hand integer NOT NULL CHECK (quantity_on_hand >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (machine_id, batch_id)
);

-- -----------------------------
-- Cart and orders
-- -----------------------------

CREATE TABLE IF NOT EXISTS carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  machine_id uuid NOT NULL REFERENCES machines(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CHECKED_OUT', 'CANCELLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  medicine_sku_id uuid NOT NULL REFERENCES medicine_skus(id) ON DELETE RESTRICT,
  qty integer NOT NULL CHECK (qty > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cart_id, medicine_sku_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL UNIQUE REFERENCES carts(id) ON DELETE RESTRICT,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  machine_id uuid NOT NULL REFERENCES machines(id) ON DELETE RESTRICT,
  status order_status NOT NULL DEFAULT 'CREATED',
  symptoms_text text,
  total_amount_cents bigint NOT NULL CHECK (total_amount_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  medicine_sku_id uuid NOT NULL REFERENCES medicine_skus(id) ON DELETE RESTRICT,
  qty integer NOT NULL CHECK (qty > 0),
  unit_price_cents bigint NOT NULL CHECK (unit_price_cents >= 0)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- -----------------------------
-- Payments (M-Pesa Daraja)
-- -----------------------------

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('MPESA')),
  mpesa_checkout_request_id text,
  mpesa_merchant_request_id text,
  phone text NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  status payment_status NOT NULL DEFAULT 'INITIATED',
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);

CREATE TABLE IF NOT EXISTS payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  raw_callback_payload jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key text UNIQUE
);

-- -----------------------------
-- Pharmacist requests (optional OTC governance)
-- -----------------------------

CREATE TABLE IF NOT EXISTS pharmacist_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  pharmacist_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  client_phone text,
  symptoms_text text,
  status pharmacist_request_status NOT NULL DEFAULT 'OPEN',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pharmacist_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES pharmacist_requests(id) ON DELETE CASCADE,
  pharmacist_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  decision text NOT NULL CHECK (decision IN ('APPROVE', 'REJECT')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------
-- Inventory reservations & movements
-- -----------------------------

CREATE TABLE IF NOT EXISTS inventory_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  machine_id uuid NOT NULL REFERENCES machines(id) ON DELETE RESTRICT,
  medicine_sku_id uuid NOT NULL REFERENCES medicine_skus(id) ON DELETE RESTRICT,
  qty_reserved integer NOT NULL CHECK (qty_reserved > 0),
  reserved_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  UNIQUE (order_id, batch_id, medicine_sku_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_order_id ON inventory_reservations(order_id);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  machine_id uuid NOT NULL REFERENCES machines(id) ON DELETE RESTRICT,
  medicine_sku_id uuid NOT NULL REFERENCES medicine_skus(id) ON DELETE RESTRICT,
  movement_type movement_type NOT NULL,
  qty integer NOT NULL CHECK (qty > 0),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb
);

-- -----------------------------
-- Dispensing & machine auditing
-- -----------------------------

CREATE TABLE IF NOT EXISTS dispense_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  machine_id uuid NOT NULL REFERENCES machines(id) ON DELETE RESTRICT,
  status dispense_job_status NOT NULL DEFAULT 'CREATED',
  job_signature text, -- signature/HMAC to prevent spoofing
  job_created_at timestamptz NOT NULL DEFAULT now(),
  dispatched_at timestamptz,
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS dispense_job_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispense_job_id uuid NOT NULL REFERENCES dispense_jobs(id) ON DELETE CASCADE,
  medicine_sku_id uuid NOT NULL REFERENCES medicine_skus(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  qty integer NOT NULL CHECK (qty > 0)
);

CREATE INDEX IF NOT EXISTS idx_dispense_job_items_job_id ON dispense_job_items(dispense_job_id);

CREATE TABLE IF NOT EXISTS dispense_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispense_job_id uuid NOT NULL REFERENCES dispense_jobs(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  reported_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb
);

CREATE INDEX IF NOT EXISTS idx_dispense_events_job_id ON dispense_events(dispense_job_id);

-- -----------------------------
-- Audit events (compliance traceability)
-- -----------------------------

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,   -- e.g. 'order', 'payment', 'dispense_job'
  entity_id uuid,
  actor_type audit_actor_type NOT NULL,
  actor_id text,
  action text NOT NULL,       -- e.g. 'ORDER_CREATED', 'PAYMENT_VERIFIED'
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events(actor_type, actor_id);

-- Basic updated_at management (MVP: you can replace with triggers later)
-- Note: backend should also set updated_at.

COMMIT;

