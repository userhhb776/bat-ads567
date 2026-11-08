import { describe, expect, it } from "vitest";
import { summarizeSales, type GatewayEvent } from "./sales";

const ev = (id: string, status: string, amount: number, at: string): GatewayEvent => ({ id: id + status, platform: "kiwify", external_id: id, status, amount, currency: "BRL", product_name: null, customer_email: null, customer_phone: null, utm: {}, occurred_at: at });

describe("real sales summary", () => {
  it("a later refund removes the order from revenue", () => {
    const s = summarizeSales([ev("A", "approved", 97, "2026-01-01"), ev("A", "refunded", 97, "2026-01-02"), ev("B", "approved", 47, "2026-01-01")]);
    expect(s.revenue).toBe(47);
    expect(s.refundedCount).toBe(1);
  });
  it("a Pix paid after being generated counts once as approved", () => {
    const s = summarizeSales([ev("P", "pending", 30, "2026-01-01"), ev("P", "approved", 30, "2026-01-01T01")]);
    expect(s.approvedCount).toBe(1);
    expect(s.pendingCount).toBe(0);
  });
});
