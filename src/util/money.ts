// src/util/money.ts
export function toMinorUnits(amount: number): number {
  // Accept number in major units (e.g., 12.34) and convert to integer cents (1234).
  // Avoid floating rounding issues: round to 2 decimal places then multiply.
  const rounded = Math.round((amount + Number.EPSILON) * 100);
  return rounded;
}

export function fromMinorUnits(amountMinor: number): number {
  return amountMinor / 100;
}
