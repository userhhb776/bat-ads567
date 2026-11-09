import { describe, expect, it } from "vitest";
import { accountFunds, isRunningOut, parseDisplayAmount } from "./funds";

describe("funds", () => {
  it("reads BRL and USD prepaid balances", () => {
    expect(parseDisplayAmount("Saldo disponível (R$1.234,56 BRL)")).toBe(1234.56);
    expect(parseDisplayAmount("Available balance ($12.34 USD)")).toBe(12.34);
  });
  it("uses spend cap minus spent when there is a limit", () => {
    expect(accountFunds({ amount_spent: "15000", spend_cap: "20000" }).available).toBe(50);
  });
  it("card accounts have no fixed balance", () => {
    expect(accountFunds({ funding_source_details: { type: 1 } }).available).toBeNull();
  });
  it("alerts when less than 1.5 days of spend is left", () => {
    expect(isRunningOut(40, 30)).toBe(true);
    expect(isRunningOut(100, 30)).toBe(false);
    expect(isRunningOut(0, 0)).toBe(true);
  });
});
