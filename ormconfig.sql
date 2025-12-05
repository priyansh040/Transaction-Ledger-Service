CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT,
  currency VARCHAR(3) NOT NULL,
  balance BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id BIGSERIAL PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  related_transfer UUID NULL,
  type VARCHAR(10) NOT NULL, -- 'credit' or 'debit'
  amount BIGINT NOT NULL, -- smallest currency unit
  currency VARCHAR(3) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_account_id UUID NOT NULL,
  to_account_id UUID NOT NULL,
  amount BIGINT NOT NULL,
  currency VARCHAR(3) NOT NULL,
  status VARCHAR(20) NOT NULL,
  idempotency_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- unique index for idempotency (per idempotency key)
CREATE UNIQUE INDEX IF NOT EXISTS idx_transfers_idempotency ON transfers(idempotency_key) WHERE idempotency_key IS NOT NULL;
