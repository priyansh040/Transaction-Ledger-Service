// src/controllers/transfers.controller.ts
import { Request, Response } from "express";
import { LedgerService } from "../services/ledger.service";
import { toMinorUnits } from "../util/money";

export class TransfersController {
  static async create(req: Request, res: Response) {
    try {
      const { from_account_id, to_account_id, amount, currency } = req.body;
      if (!from_account_id || !to_account_id || amount == null || !currency) {
        return res.status(400).json({ error: "missing_fields" });
      }
      const minor = toMinorUnits(Number(amount));
      const idempotencyKey = req.header("Idempotency-Key") || undefined;

      const result = await LedgerService.transfer(
        from_account_id,
        to_account_id,
        minor,
        currency,
        idempotencyKey
      );
      return res.status(201).json(result);
    } catch (err: any) {
      if (err.message === "insufficient_funds")
        return res.status(400).json({ error: "insufficient_funds" });
      if (err.message === "account_not_found")
        return res.status(404).json({ error: "account_not_found" });
      res.status(500).json({ error: err.message });
    }
  }
}
