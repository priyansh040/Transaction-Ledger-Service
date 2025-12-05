// src/routes.ts
import express from "express";
import { AccountsController } from "./controllers/accounts.controller";
import { TransactionsController } from "./controllers/transactions.controller";
import { TransfersController } from "./controllers/transfers.controller";

const router = express.Router();

router.post("/accounts", AccountsController.create);
router.get("/accounts/:id", AccountsController.get);
router.get("/accounts/:id/transactions", AccountsController.transactions);

router.post("/transactions", TransactionsController.create);

router.post("/transfers", TransfersController.create);

export default router;
