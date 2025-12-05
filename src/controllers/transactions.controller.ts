// src/controllers/transactions.controller.ts
import { Request, Response } from "express";
import { LedgerService } from "../services/ledger.service";
import { toMinorUnits } from "../util/money";

export class TransactionsController {
  static async create(req: Request, res: Response) {
    try {
      const { account_id, type, amount, currency, description } = req.body;
      if (!account_id || !type || amount == null || !currency) {
        return res.status(400).json({ error: "missing_fields" });
      }
      // convert to minor units
      const minor = toMinorUnits(Number(amount));
      const idempotencyKey = req.header("Idempotency-Key") || undefined;

      if (type === "credit") {
        const result = await LedgerService.deposit(
          account_id,
          minor,
          currency,
          description,
          idempotencyKey
        );
        return res.status(201).json(result);
      } else if (type === "debit") {
        const result = await LedgerService.withdraw(
          account_id,
          minor,
          currency,
          description,
          idempotencyKey
        );
        return res.status(201).json(result);
      } else {
        return res.status(400).json({ error: "invalid_type" });
      }
    } catch (err: any) {
      if (err.message === "insufficient_funds")
        return res.status(400).json({ error: "insufficient_funds" });
      if (err.message === "account_not_found")
        return res.status(404).json({ error: "account_not_found" });
      res.status(500).json({ error: err.message });
    }
  }
}
