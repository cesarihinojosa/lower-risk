import { describe, it, expect } from "vitest";
import { getTradeInArmies } from "../cards";
import { isValidCardSet } from "../validation";

describe("getTradeInArmies", () => {
  it("should return escalating values", () => {
    expect(getTradeInArmies(0)).toBe(4);
    expect(getTradeInArmies(1)).toBe(6);
    expect(getTradeInArmies(2)).toBe(8);
    expect(getTradeInArmies(3)).toBe(10);
    expect(getTradeInArmies(4)).toBe(12);
    expect(getTradeInArmies(5)).toBe(15);
    expect(getTradeInArmies(6)).toBe(20);
    expect(getTradeInArmies(7)).toBe(25);
  });

  it("should continue +5 pattern beyond 7th trade", () => {
    expect(getTradeInArmies(8)).toBe(30);
    expect(getTradeInArmies(9)).toBe(35);
    expect(getTradeInArmies(10)).toBe(40);
  });
});

describe("isValidCardSet", () => {
  it("should accept 3 infantry", () => {
    expect(isValidCardSet([
      { type: "infantry" },
      { type: "infantry" },
      { type: "infantry" },
    ])).toBe(true);
  });

  it("should accept 3 cavalry", () => {
    expect(isValidCardSet([
      { type: "cavalry" },
      { type: "cavalry" },
      { type: "cavalry" },
    ])).toBe(true);
  });

  it("should accept 3 artillery", () => {
    expect(isValidCardSet([
      { type: "artillery" },
      { type: "artillery" },
      { type: "artillery" },
    ])).toBe(true);
  });

  it("should accept 1 of each type", () => {
    expect(isValidCardSet([
      { type: "infantry" },
      { type: "cavalry" },
      { type: "artillery" },
    ])).toBe(true);
  });

  it("should accept 2 + 1 wild (infantry)", () => {
    expect(isValidCardSet([
      { type: "infantry" },
      { type: "infantry" },
      { type: "wild" },
    ])).toBe(true);
  });

  it("should accept 2 + 1 wild (cavalry)", () => {
    expect(isValidCardSet([
      { type: "cavalry" },
      { type: "cavalry" },
      { type: "wild" },
    ])).toBe(true);
  });

  it("should accept 1 + 1 wild + 1 different (wild completes set)", () => {
    expect(isValidCardSet([
      { type: "infantry" },
      { type: "wild" },
      { type: "cavalry" },
    ])).toBe(true);
  });

  it("should accept 2 wilds + 1 anything", () => {
    expect(isValidCardSet([
      { type: "wild" },
      { type: "wild" },
      { type: "infantry" },
    ])).toBe(true);
  });

  it("should reject invalid set (2 infantry + 1 cavalry, no wild)", () => {
    expect(isValidCardSet([
      { type: "infantry" },
      { type: "infantry" },
      { type: "cavalry" },
    ])).toBe(false);
  });

  it("should reject invalid set (2 cavalry + 1 artillery, no wild)", () => {
    expect(isValidCardSet([
      { type: "cavalry" },
      { type: "cavalry" },
      { type: "artillery" },
    ])).toBe(false);
  });

  it("should reject fewer than 3 cards", () => {
    expect(isValidCardSet([
      { type: "infantry" },
      { type: "infantry" },
    ])).toBe(false);
  });

  it("should reject more than 3 cards", () => {
    expect(isValidCardSet([
      { type: "infantry" },
      { type: "infantry" },
      { type: "infantry" },
      { type: "infantry" },
    ])).toBe(false);
  });
});
