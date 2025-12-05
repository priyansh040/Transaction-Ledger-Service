// src/services/ledger.service.ts
import { pool } from "../db/pool";
import { v4 as uuidv4 } from "uuid";
import { Account, LedgerEntry, Transfer, Currency } from "../models/types";

export class LedgerService {
  static async createAccount(
    owner_id: string | undefined,
    currency: Currency
  ): Promise<Account> {
    const res = await pool.query(
      `INSERT INTO accounts (owner_id, currency) VALUES ($1, $2) RETURNING id, owner_id, currency, balance, created_at`,
      [owner_id || null, currency]
    );
    return res.rows[0];
  }

  static async getAccount(accountId: string): Promise<Account | null> {
    const res = await pool.query(
      `SELECT id, owner_id, currency, balance, created_at FROM accounts WHERE id = $1`,
      [accountId]
    );
    return res.rows[0] || null;
  }

  static async getTransactions(accountId: string, limit = 20, offset = 0) {
    const res = await pool.query(
      `SELECT id, account_id, related_transfer, type, amount, currency, description, created_at
       FROM ledger_entries
       WHERE account_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT $2 OFFSET $3`,
      [accountId, limit, offset]
    );
    return res.rows;
  }

  static async deposit(
    accountId: string,
    amount: number,
    currency: Currency,
    description?: string,
    idempotencyKey?: string
  ) {
    // wrap in transaction
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Optionally: handle idempotency by inserting a transfers row with null from/to.
      if (idempotencyKey) {
        try {
          await client.query(
            `INSERT INTO transfers (id, from_account_id, to_account_id, amount, currency, status, idempotency_key)
             VALUES ($1,$2,$3,$4,$5,'pending',$6)`,
            [uuidv4(), null, accountId, amount, currency, idempotencyKey]
          );
        } catch (e: any) {
          if (e.code === "23505") {
            // idempotency key exists; return existing transfer
            const t = await client.query(
              `SELECT * FROM transfers WHERE idempotency_key = $1`,
              [idempotencyKey]
            );
            await client.query("ROLLBACK");
            return { alreadyExists: true, transfer: t.rows[0] };
          }
          throw e;
        }
      }

      // lock account
      const accRes = await client.query(
        `SELECT id, balance FROM accounts WHERE id = $1 FOR UPDATE`,
        [accountId]
      );
      if (accRes.rowCount === 0) {
        await client.query("ROLLBACK");
        throw new Error("account_not_found");
      }

      // insert ledger entry
      const ledgerRes = await client.query(
        `INSERT INTO ledger_entries (account_id, related_transfer, type, amount, currency, description)
         VALUES ($1, $2, 'credit', $3, $4, $5) RETURNING id`,
        [accountId, null, amount, currency, description || null]
      );

      // update balance
      await client.query(
        `UPDATE accounts SET balance = balance + $1 WHERE id = $2`,
        [amount, accountId]
      );

      if (idempotencyKey) {
        await client.query(
          `UPDATE transfers SET status='succeeded' WHERE idempotency_key = $1`,
          [idempotencyKey]
        );
      }

      await client.query("COMMIT");
      return { success: true, ledger_id: ledgerRes.rows[0].id };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  static async withdraw(
    accountId: string,
    amount: number,
    currency: Currency,
    description?: string,
    idempotencyKey?: string
  ) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      if (idempotencyKey) {
        try {
          await client.query(
            `INSERT INTO transfers (id, from_account_id, to_account_id, amount, currency, status, idempotency_key)
             VALUES ($1,$2,$3,$4,$5,'pending',$6)`,
            [uuidv4(), accountId, null, amount, currency, idempotencyKey]
          );
        } catch (e: any) {
          if (e.code === "23505") {
            const t = await client.query(
              `SELECT * FROM transfers WHERE idempotency_key = $1`,
              [idempotencyKey]
            );
            await client.query("ROLLBACK");
            return { alreadyExists: true, transfer: t.rows[0] };
          }
          throw e;
        }
      }

      const accRes = await client.query(
        `SELECT id, balance FROM accounts WHERE id = $1 FOR UPDATE`,
        [accountId]
      );
      if (accRes.rowCount === 0) {
        await client.query("ROLLBACK");
        throw new Error("account_not_found");
      }

      const balance: number = accRes.rows[0].balance;
      if (balance < amount) {
        await client.query("ROLLBACK");
        // mark failed if idempotency used
        if (idempotencyKey) {
          await client.query(
            `UPDATE transfers SET status='failed' WHERE idempotency_key = $1`,
            [idempotencyKey]
          );
        }
        throw new Error("insufficient_funds");
      }

      const ledgerRes = await client.query(
        `INSERT INTO ledger_entries (account_id, related_transfer, type, amount, currency, description)
         VALUES ($1, $2, 'debit', $3, $4, $5) RETURNING id`,
        [accountId, null, amount, currency, description || null]
      );

      await client.query(
        `UPDATE accounts SET balance = balance - $1 WHERE id = $2`,
        [amount, accountId]
      );

      if (idempotencyKey) {
        await client.query(
          `UPDATE transfers SET status='succeeded' WHERE idempotency_key = $1`,
          [idempotencyKey]
        );
      }

      await client.query("COMMIT");
      return { success: true, ledger_id: ledgerRes.rows[0].id };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  static async transfer(
    fromId: string,
    toId: string,
    amount: number,
    currency: Currency,
    idempotencyKey?: string
  ) {
    const client = await pool.connect();
    let createdTransferId: string | null = null;
    try {
      // 1) Try to create transfer row for idempotency
      if (idempotencyKey) {
        try {
          createdTransferId = uuidv4();
          await client.query(
            `INSERT INTO transfers (id, from_account_id, to_account_id, amount, currency, status, idempotency_key)
             VALUES ($1,$2,$3,$4,$5,'pending',$6)`,
            [createdTransferId, fromId, toId, amount, currency, idempotencyKey]
          );
        } catch (e: any) {
          if (e.code === "23505") {
            // idempotency key already used — return existing transfer info
            const existing = await client.query(
              `SELECT * FROM transfers WHERE idempotency_key = $1`,
              [idempotencyKey]
            );
            return { alreadyExists: true, transfer: existing.rows[0] };
          }
          throw e;
        }
      } else {
        // create transfer row (without idempotency) to record operation
        createdTransferId = uuidv4();
        await client.query(
          `INSERT INTO transfers (id, from_account_id, to_account_id, amount, currency, status)
           VALUES ($1,$2,$3,$4,$5,'pending')`,
          [createdTransferId, fromId, toId, amount, currency]
        );
      }

      // Begin transactional move: lock both accounts (order by id to avoid deadlock)
      await client.query("BEGIN");

      const ids = [fromId, toId].sort();
      const accountsRes = await client.query(
        `SELECT id, balance FROM accounts WHERE id = ANY($1::uuid[]) FOR UPDATE`,
        [ids]
      );

      const fromRow = accountsRes.rows.find((r: any) => r.id === fromId);
      const toRow = accountsRes.rows.find((r: any) => r.id === toId);
      if (!fromRow || !toRow) {
        await client.query("ROLLBACK");
        await client.query(
          `UPDATE transfers SET status='failed' WHERE id = $1`,
          [createdTransferId]
        );
        throw new Error("account_not_found");
      }

      if (fromRow.balance < amount) {
        await client.query("ROLLBACK");
        await client.query(
          `UPDATE transfers SET status='failed' WHERE id = $1`,
          [createdTransferId]
        );
        throw new Error("insufficient_funds");
      }

      // insert ledger entries (debit then credit)
      const debitRes = await client.query(
        `INSERT INTO ledger_entries (account_id, related_transfer, type, amount, currency)
         VALUES ($1, $2, 'debit', $3, $4) RETURNING id`,
        [fromId, createdTransferId, amount, currency]
      );
      const creditRes = await client.query(
        `INSERT INTO ledger_entries (account_id, related_transfer, type, amount, currency)
         VALUES ($1, $2, 'credit', $3, $4) RETURNING id`,
        [toId, createdTransferId, amount, currency]
      );

      // update balances
      await client.query(
        `UPDATE accounts SET balance = balance - $1 WHERE id = $2`,
        [amount, fromId]
      );
      await client.query(
        `UPDATE accounts SET balance = balance + $1 WHERE id = $2`,
        [amount, toId]
      );

      // mark transfer succeeded
      await client.query(
        `UPDATE transfers SET status='succeeded' WHERE id = $1`,
        [createdTransferId]
      );

      await client.query("COMMIT");

      return {
        success: true,
        transfer_id: createdTransferId,
        debit_ledger_id: debitRes.rows[0].id,
        credit_ledger_id: creditRes.rows[0].id,
      };
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      if (createdTransferId) {
        try {
          await client.query(
            `UPDATE transfers SET status='failed' WHERE id = $1`,
            [createdTransferId]
          );
        } catch {}
      }
      throw err;
    } finally {
      client.release();
    }
  }
}
