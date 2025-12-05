// tests/concurrency.test.ts
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

const base = process.env.BASE_URL || "http://localhost:3000";

describe("concurrency", () => {
  jest.setTimeout(120_000);

  test("multiple simultaneous transfers do not overdraw account", async () => {
    const a = (
      await axios.post(`${base}/accounts`, {
        owner_id: "alice",
        currency: "USD",
      })
    ).data;
    const b = (
      await axios.post(`${base}/accounts`, { owner_id: "bob", currency: "USD" })
    ).data;
    await axios.post(`${base}/transactions`, {
      account_id: a.id,
      type: "credit",
      amount: 10.0,
      currency: "USD",
    });

    const concurrent = 10;
    const transferAmount = 2.0;
    const promises = [];
    for (let i = 0; i < concurrent; i++) {
      promises.push(
        axios
          .post(
            `${base}/transfers`,
            {
              from_account_id: a.id,
              to_account_id: b.id,
              amount: transferAmount,
              currency: "USD",
            },
            {
              headers: { "Idempotency-Key": uuidv4() },
            }
          )
          .then((r) => ({ ok: true, data: r.data }))
          .catch((e) => ({
            ok: false,
            err: e.response ? e.response.data : e.message,
          }))
      );
    }

    const results = await Promise.all(promises);

    const finalA = (await axios.get(`${base}/accounts/${a.id}`)).data;
    const finalB = (await axios.get(`${base}/accounts/${b.id}`)).data;

    // finalA.balance is in minor units; initial 10.00 -> 1000
    const totalTransferredMinor =
      results.filter((r) => r.ok).length * (transferAmount * 100);
    expect(finalA.balance).toBeGreaterThanOrEqual(0);
    expect(finalA.balance + finalB.balance).toEqual(1000); // money preserved across accounts
  });
});
