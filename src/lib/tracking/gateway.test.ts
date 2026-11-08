import { describe, expect, it } from "vitest";
import { mapStatus, normalizeGateway } from "./gateway";

describe("gateway webhooks", () => {
  it("reads a Kiwify paid order with cents and UTMs", () => {
    const e = normalizeGateway({ order_id: "K1", order_status: "paid", Commissions: { charge_amount: 9700, currency: "BRL" }, TrackingParameters: { utm_source: "FB", utm_campaign: "Produto X" } })!;
    expect(e.status).toBe("approved");
    expect(e.amount).toBe(97);
    expect(e.utm["utm_campaign"]).toBe("Produto X");
  });
  it("reads a Hotmart purchase", () => {
    const e = normalizeGateway({ event: "PURCHASE_APPROVED", data: { purchase: { transaction: "HP1", status: "APPROVED", price: { value: 47, currency_value: "BRL" } } } })!;
    expect(e.external_id).toBe("HP1");
    expect(e.amount).toBe(47);
  });
  it("treats generated Pix waiting payment as pending", () => expect(mapStatus("waiting_payment")).toBe("pending"));
  it("treats refunds as refunded", () => expect(mapStatus("order_refunded")).toBe("refunded"));
  it("ignores payloads without an order id", () => expect(normalizeGateway({ hello: 1 })).toBeNull());
});
