// scripts/concurrency-test.js
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

const base = process.env.BASE_URL || "http://localhost:3000";

async function main() {
  // create accounts
  const a = (
    await axios.post(`${base}/accounts`, { owner_id: "alice", currency: "USD" })
  ).data;
  const b = (
    await axios.post(`${base}/accounts`, { owner_id: "bob", currency: "USD" })
  ).data;

  console.log("A", a.id, "B", b.id);

  // deposit into A: $10.00
  await axios.post(`${base}/transactions`, {
    account_id: a.id,
    type: "credit",
    amount: 10.0,
    currency: "USD",
  });

  const concurrent = 10;
  const transferAmount = 2.0; // $2.00 each; 10 attempts * 2 = $20 > $10 initial

  const promises = [];
  for (let i = 0; i < concurrent; i++) {
    const idempotency = uuidv4();
    const p = axios
      .post(
        `${base}/transfers`,
        {
          from_account_id: a.id,
          to_account_id: b.id,
          amount: transferAmount,
          currency: "USD",
        },
        {
          headers: { "Idempotency-Key": idempotency },
          timeout: 60000,
        }
      )
      .then((r) => ({ ok: true, data: r.data }))
      .catch((e) => ({
        ok: false,
        err: e.response ? e.response.data : e.message,
      }));
    promises.push(p);
  }

  const results = await Promise.all(promises);
  console.log("Results:", results);

  const finalA = (await axios.get(`${base}/accounts/${a.id}`)).data;
  const finalB = (await axios.get(`${base}/accounts/${b.id}`)).data;
  console.log("final balances:", finalA.balance, finalB.balance);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
