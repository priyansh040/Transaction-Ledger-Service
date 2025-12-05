// src/controllers/accounts.controller.ts
import { Request, Response } from "express";
import { LedgerService } from "../services/ledger.service";
import { toMinorUnits } from "../util/money";

export class AccountsController {
  static async create(req: Request, res: Response) {
    try {
      const { owner_id, currency } = req.body;
      if (!currency)
        return res.status(400).json({ error: "currency required" });
      const account = await LedgerService.createAccount(owner_id, currency);
      res.status(201).json(account);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async get(req: Request, res: Response) {
    try {
      const id = req.params.id;
      const acc = await LedgerService.getAccount(id);
      if (!acc) return res.status(404).json({ error: "not_found" });
      // return balance in major units for UX
      res.json({ ...acc, balance: acc.balance });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async transactions(req: Request, res: Response) {
    try {
      const id = req.params.id;
      const page = parseInt((req.query.page as string) || "1", 10);
      const limit = parseInt((req.query.limit as string) || "20", 10);
      const offset = (page - 1) * limit;
      const rows = await LedgerService.getTransactions(id, limit, offset);
      res.json({ page, limit, transactions: rows });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}
