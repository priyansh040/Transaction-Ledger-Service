// src/models/types.ts
export type Currency = "USD" | "INR";

export interface Account {
  id: string;
  owner_id?: string | null;
  currency: Currency;
  balance: number; // stored in smallest unit (cents/paise)
  created_at?: string;
}

export interface LedgerEntry {
  id?: number;
  account_id: string;
  related_transfer?: string | null;
  type: "credit" | "debit";
  amount: number;
  currency: Currency;
  description?: string | null;
  created_at?: string;
}

export interface Transfer {
  id?: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  currency: Currency;
  status?: "pending" | "succeeded" | "failed";
  idempotency_key?: string | null;
  created_at?: string;
}
