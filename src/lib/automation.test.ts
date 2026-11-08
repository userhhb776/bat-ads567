import { describe, expect, it } from "vitest";
import { alreadyRan, checkCondition, render } from "./automation";

describe("automations", () => {
  it("fills message variables", () => expect(render("Oi {nome}, seu Pix de {valor}", { nome: "Ana", valor: "97" })).toBe("Oi Ana, seu Pix de 97"));
  it("numeric condition", () => expect(checkCondition({ type: "condicao", field: "valor", op: ">", value: "50", else: "parar" }, { valor: "97" })).toBe(true));
  it("does not run twice for the same event", () => {
    const logs = [{ id: "1", automationId: "a", key: "pedido-1", at: 0, status: "ok" as const, detail: "", attempts: 1 }];
    expect(alreadyRan(logs, "a", "pedido-1")).toBe(true);
    expect(alreadyRan(logs, "a", "pedido-2")).toBe(false);
  });
  it("allows retry after a failure", () => {
    expect(alreadyRan([{ id: "1", automationId: "a", key: "k", at: 0, status: "falhou", detail: "", attempts: 1 }], "a", "k")).toBe(false);
  });
});
