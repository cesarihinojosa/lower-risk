/**
 * Get the number of bonus armies for the Nth trade-in (0-indexed).
 * 1st trade: 4, 2nd: 6, 3rd: 8, 4th: 10, 5th: 12, 6th: 15, then +5 each.
 */
export function getTradeInArmies(tradeInCount: number): number {
  const values = [4, 6, 8, 10, 12, 15];
  if (tradeInCount < values.length) {
    return values[tradeInCount];
  }
  // After the 6th trade-in: 15 + 5 * (tradeInCount - 5)
  return 15 + 5 * (tradeInCount - 5);
}
