# Transactional Ledger Service

This project implements a simplified internal ledger system designed to model how financial platforms handle account balances and money movement. The focus is on correctness, concurrency safety, atomic operations, and idempotency. The application is built with **Node.js (TypeScript)** and **PostgreSQL**, and runs entirely through Docker.

---

## Features

- Create accounts in USD or INR
- Perform deposits and withdrawals with overdraft protection
- Internal transfers are atomic (debit + credit in a single transaction)
- Immutable ledger entries for all financial events
- Idempotency for safe retry handling
- Protects against double-spending during concurrent operations
- Paginated transaction history
- Fully containerized with Docker Compose

---

## Why PostgreSQL?

PostgreSQL provides:

- ACID transactions
- Row-level locks (`SELECT ... FOR UPDATE`)
- Strong consistency
- Safe handling of numeric values using BIGINT

Financial systems require predictable, isolated writes. PostgreSQL is built for this.

---

## Database Schema

### Accounts

| Field      | Type       | Description           |
| ---------- | ---------- | --------------------- |
| id         | UUID       | Unique account ID     |
| owner_id   | TEXT       | User identifier       |
| currency   | VARCHAR(3) | USD / INR             |
| balance    | BIGINT     | Stored in minor units |
| created_at | TIMESTAMP  | Timestamp             |

### Ledger Entries

| Field            | Type           | Description            |
| ---------------- | -------------- | ---------------------- |
| id               | BIGSERIAL      | Ledger entry ID        |
| account_id       | UUID           | FK to accounts         |
| related_transfer | UUID           | Reference to transfers |
| type             | debit / credit | Ledger direction       |
| amount           | BIGINT         | Minor units            |
| currency         | VARCHAR(3)     | USD / INR              |
| created_at       | TIMESTAMP      | Timestamp              |

### Transfers

| Field           | Type               | Description                |
| --------------- | ------------------ | -------------------------- |
| id              | UUID               | Transfer ID                |
| from_account_id | UUID               | Debited account            |
| to_account_id   | UUID               | Credited account           |
| amount          | BIGINT             | Minor units                |
| currency        | VARCHAR(3)         | Currency                   |
| status          | succeeded / failed | Final status               |
| idempotency_key | TEXT               | Ensures request uniqueness |
| created_at      | TIMESTAMP          | Timestamp                  |

---

## Concurrency Handling

To prevent double spending:

- Both account rows are locked using `SELECT ... FOR UPDATE`
- Debit and credit operations execute inside a single SQL transaction
- If funds are insufficient, the entire transaction rolls back
- A concurrency test fires 10 parallel transfers to ensure safety

Expected result:

- 5 transfers succeed
- 5 fail
- Final balances remain accurate

---

## Idempotency

Transfers require an `Idempotency-Key` header.

If the same key is reused, the API returns the original result and avoids processing the transfer twice. This prevents double-charging during retries.

---

## Running the Project

Start using Docker:

```bash
docker-compose up --build
Run concurrency test:

bash
Copy code
docker-compose exec app node scripts/concurrency-test.js
Endpoints
Create Account
bash
Copy code
POST /accounts
Deposit / Withdraw
bash
Copy code
POST /transactions
Transfer
bash
Copy code
POST /transfers
Idempotency-Key: <key>
Get Account
bash
Copy code
GET /accounts/:id
History
bash
Copy code
GET /accounts/:id/transactions?page=1&limit=20
Postman Collection
A full Postman collection is included in:

bash
Copy code
postman/ledger-service.postman_collection.json
Conclusion
This service demonstrates the core principles behind real-world financial ledger systems such as atomicity, idempotency, concurrency safety, and immutable bookkeeping. It is designed to be simple, correct, and extensible for real fintech use cases.
```
