// Seedable RNG wrapper — ALL randomness in the game goes through here.
// Never call Math.random() directly in game logic.

type RngFunction = () => number;

let currentRng: RngFunction = Math.random;

export function setRng(rng: RngFunction): void {
  currentRng = rng;
}

export function resetRng(): void {
  currentRng = Math.random;
}

export function getRng(): RngFunction {
  return currentRng;
}

export function rollDie(): number {
  return Math.floor(currentRng() * 6) + 1;
}

export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(currentRng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
