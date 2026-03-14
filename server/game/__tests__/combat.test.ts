// Combat resolution tests with seeded dice
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveCombat } from "../combat";
import { setRng, resetRng } from "../rng";

/**
 * Creates a deterministic RNG that returns values from the given sequence.
 * Die mapping: Math.floor(val * 6) + 1
 *   0.0  → 1
 *   0.17 → 2
 *   0.34 → 3
 *   0.5  → 4
 *   0.67 → 5
 *   0.84 → 6
 */
function createSequenceRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("resolveCombat", () => {
  afterEach(() => {
    resetRng();
  });

  describe("3v2 combat", () => {
    it("attacker wins both — attacker rolls higher on both pairs, defender loses 2", () => {
      // Attacker rolls: 6, 5, 4 (sorted desc: 6, 5, 4)
      // Defender rolls: 3, 2       (sorted desc: 3, 2)
      // Pairs: 6>3 attacker wins, 5>2 attacker wins
      setRng(createSequenceRng([0.84, 0.67, 0.5, 0.34, 0.17]));

      const result = resolveCombat(3, 2);

      expect(result.attackerDice).toEqual([6, 5, 4]);
      expect(result.defenderDice).toEqual([3, 2]);
      expect(result.attackerLosses).toBe(0);
      expect(result.defenderLosses).toBe(2);
    });

    it("defender wins both — defender rolls higher/ties on both pairs, attacker loses 2", () => {
      // Attacker rolls: 2, 1, 1 (sorted desc: 2, 1, 1)
      // Defender rolls: 5, 4     (sorted desc: 5, 4)
      // Pairs: 2<5 defender wins, 1<4 defender wins
      setRng(createSequenceRng([0.17, 0.0, 0.0, 0.67, 0.5]));

      const result = resolveCombat(3, 2);

      expect(result.attackerDice).toEqual([2, 1, 1]);
      expect(result.defenderDice).toEqual([5, 4]);
      expect(result.attackerLosses).toBe(2);
      expect(result.defenderLosses).toBe(0);
    });

    it("split result — attacker wins one pair, defender wins the other, 1 loss each", () => {
      // Attacker rolls: 6, 1, 1 (sorted desc: 6, 1, 1)
      // Defender rolls: 3, 5     (sorted desc: 5, 3)
      // Pairs: 6>5 attacker wins, 1<3 defender wins
      setRng(createSequenceRng([0.84, 0.0, 0.0, 0.34, 0.67]));

      const result = resolveCombat(3, 2);

      expect(result.attackerDice).toEqual([6, 1, 1]);
      expect(result.defenderDice).toEqual([5, 3]);
      expect(result.attackerLosses).toBe(1);
      expect(result.defenderLosses).toBe(1);
    });
  });

  describe("ties go to defender", () => {
    it("equal dice values result in attacker loss", () => {
      // Attacker rolls: 4, 4, 4 (sorted desc: 4, 4, 4)
      // Defender rolls: 4, 4     (sorted desc: 4, 4)
      // Pairs: 4==4 defender wins, 4==4 defender wins
      setRng(createSequenceRng([0.5, 0.5, 0.5, 0.5, 0.5]));

      const result = resolveCombat(3, 2);

      expect(result.attackerDice).toEqual([4, 4, 4]);
      expect(result.defenderDice).toEqual([4, 4]);
      expect(result.attackerLosses).toBe(2);
      expect(result.defenderLosses).toBe(0);
    });
  });

  describe("1v1 combat", () => {
    it("only one pair is compared", () => {
      // Attacker rolls: 6 (sorted desc: 6)
      // Defender rolls: 3 (sorted desc: 3)
      // Pairs: 6>3 attacker wins
      setRng(createSequenceRng([0.84, 0.34]));

      const result = resolveCombat(1, 1);

      expect(result.attackerDice).toEqual([6]);
      expect(result.defenderDice).toEqual([3]);
      expect(result.attackerLosses).toBe(0);
      expect(result.defenderLosses).toBe(1);
    });

    it("1v1 tie goes to defender", () => {
      // Attacker rolls: 3
      // Defender rolls: 3
      setRng(createSequenceRng([0.34, 0.34]));

      const result = resolveCombat(1, 1);

      expect(result.attackerDice).toEqual([3]);
      expect(result.defenderDice).toEqual([3]);
      expect(result.attackerLosses).toBe(1);
      expect(result.defenderLosses).toBe(0);
    });
  });

  describe("3v1 combat", () => {
    it("only one pair compared — highest attacker die vs single defender die", () => {
      // Attacker rolls: 2, 6, 1 (sorted desc: 6, 2, 1)
      // Defender rolls: 4       (sorted desc: 4)
      // Pairs: 6>4 attacker wins (only 1 pair)
      setRng(createSequenceRng([0.17, 0.84, 0.0, 0.5]));

      const result = resolveCombat(3, 1);

      expect(result.attackerDice).toEqual([6, 2, 1]);
      expect(result.defenderDice).toEqual([4]);
      expect(result.attackerLosses).toBe(0);
      expect(result.defenderLosses).toBe(1);
    });

    it("3v1 defender wins when defender die >= highest attacker die", () => {
      // Attacker rolls: 1, 2, 3 (sorted desc: 3, 2, 1)
      // Defender rolls: 5       (sorted desc: 5)
      // Pairs: 3<5 defender wins
      setRng(createSequenceRng([0.0, 0.17, 0.34, 0.67]));

      const result = resolveCombat(3, 1);

      expect(result.attackerDice).toEqual([3, 2, 1]);
      expect(result.defenderDice).toEqual([5]);
      expect(result.attackerLosses).toBe(1);
      expect(result.defenderLosses).toBe(0);
    });
  });

  describe("2v2 combat", () => {
    it("two pairs compared — attacker wins both", () => {
      // Attacker rolls: 6, 5 (sorted desc: 6, 5)
      // Defender rolls: 3, 2 (sorted desc: 3, 2)
      // Pairs: 6>3 attacker wins, 5>2 attacker wins
      setRng(createSequenceRng([0.84, 0.67, 0.34, 0.17]));

      const result = resolveCombat(2, 2);

      expect(result.attackerDice).toEqual([6, 5]);
      expect(result.defenderDice).toEqual([3, 2]);
      expect(result.attackerLosses).toBe(0);
      expect(result.defenderLosses).toBe(2);
    });

    it("two pairs compared — split result", () => {
      // Attacker rolls: 6, 1 (sorted desc: 6, 1)
      // Defender rolls: 4, 3 (sorted desc: 4, 3)
      // Pairs: 6>4 attacker wins, 1<3 defender wins
      setRng(createSequenceRng([0.84, 0.0, 0.5, 0.34]));

      const result = resolveCombat(2, 2);

      expect(result.attackerDice).toEqual([6, 1]);
      expect(result.defenderDice).toEqual([4, 3]);
      expect(result.attackerLosses).toBe(1);
      expect(result.defenderLosses).toBe(1);
    });
  });

  describe("dice are sorted descending", () => {
    it("highest dice are compared first regardless of roll order", () => {
      // Attacker rolls in order: 1, 6, 3 → sorted desc: 6, 3, 1
      // Defender rolls in order: 5, 2     → sorted desc: 5, 2
      // Pairs: 6>5 attacker wins, 3>2 attacker wins
      // Without sorting, 1<5 and 6>2 would give a split — so sorting matters
      setRng(createSequenceRng([0.0, 0.84, 0.34, 0.67, 0.17]));

      const result = resolveCombat(3, 2);

      expect(result.attackerDice).toEqual([6, 3, 1]);
      expect(result.defenderDice).toEqual([5, 2]);
      expect(result.attackerLosses).toBe(0);
      expect(result.defenderLosses).toBe(2);
    });

    it("defender dice are also sorted descending before comparison", () => {
      // Attacker rolls in order: 4, 3, 2 → sorted desc: 4, 3, 2
      // Defender rolls in order: 1, 5     → sorted desc: 5, 1
      // Pairs: 4<5 defender wins, 3>1 attacker wins
      // Without sorting defender, 4>1 and 3<5 would give same split but different dice reported
      setRng(createSequenceRng([0.5, 0.34, 0.17, 0.0, 0.67]));

      const result = resolveCombat(3, 2);

      expect(result.attackerDice).toEqual([4, 3, 2]);
      expect(result.defenderDice).toEqual([5, 1]);
      expect(result.attackerLosses).toBe(1);
      expect(result.defenderLosses).toBe(1);
    });
  });
});
