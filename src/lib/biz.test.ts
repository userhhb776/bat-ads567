import { describe, expect, it } from "vitest";
import { salesSummary, type Order } from "./biz";

const o = (status: Order["status"], amount: number): Order => ({ id: status + amount, productId: "p", customer: "", email: "", phone: "", amount, status, method: "pix", gateway: "", at: 0, utm_source: "", utm_campaign: "", utm_content: "" });

describe("sales summary", () => {
  it("counts only approved payments as revenue", () => {
    const s = salesSummary([o("aprovado", 97), o("pix_gerado", 97), o("reembolsado", 50)]);
    expect(s.revenue).toBe(97);
    expect(s.pending).toBe(97);
    expect(s.refunded).toBe(50);
    expect(s.count).toBe(1);
  });
});
