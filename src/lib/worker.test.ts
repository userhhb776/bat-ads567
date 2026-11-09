import { describe, it, expect, vi } from "vitest";
vi.mock("./channels.server", () => ({ deliver: vi.fn() }));
import { backoffMinutes } from "./worker.server";
import { parseInbound } from "@/routes/api/public/inbound/$channel";
import { runEngine, gatewayToOrder } from "./automation";

describe("background worker", () => {
  it("retries with exponential backoff capped at 2 hours", () => {
    expect([1, 2, 3, 4].map(backoffMinutes)).toEqual([1, 2, 4, 8]);
    expect(backoffMinutes(20)).toBe(120);
  });
  it("reads Telegram and WhatsApp inbound messages", () => {
    expect(parseInbound("telegram", { message: { chat: { id: 42 }, from: { first_name: "Ana" }, text: "oi" } })).toEqual({ from: "42", name: "Ana", text: "oi" });
    expect(parseInbound("whatsapp", { phone: "+55 11 99999-0000", name: "Bia", message: "quero" })).toEqual({ from: "5511999990000", name: "Bia", text: "quero" });
    expect(parseInbound("whatsapp", { phone: "1" })).toBeNull();
  });
  it("runs an automation once per approved gateway payment", async () => {
    const order = gatewayToOrder({ id: "1", external_id: "x", status: "approved", amount: 97, product_name: "P", customer_email: "a@b.c", customer_phone: "5511", utm: {}, occurred_at: new Date().toISOString(), platform: "kiwify" }, [{ id: "p1", name: "P" } as never]);
    const autos = [{ id: "a1", name: "Boas-vindas", trigger: "pagamento_aprovado" as const, productId: "", active: true, steps: [{ type: "whatsapp" as const, message: "Oi {produto}" }] }];
    const send = vi.fn(async () => ({ ok: true, error: "" }));
    const first = await runEngine({ autos, orders: [order], products: [], logs: [], send, newId: () => "r1" });
    expect(first.out).toHaveLength(1);
    const second = await runEngine({ autos, orders: [order], products: [], logs: first.out, send, newId: () => "r2" });
    expect(second.out).toHaveLength(0);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
