export type Product = {
  id: string; name: string; kind: "digital" | "fisico"; price: number; cost: number; currency: "BRL" | "USD";
  checkoutUrl: string; deliveryUrl: string; pageId: string; funnelName: string; campaignIds: string;
  offers: { id: string; name: string; type: "principal" | "order_bump" | "upsell" | "downsell"; price: number }[];
  coupons: { code: string; percent: number }[];
  knowledge: string; // base de conhecimento p/ suporte
};
export type OrderStatus = "pix_gerado" | "pendente" | "aprovado" | "recusado" | "reembolsado" | "chargeback";
export type Order = {
  id: string; productId: string; customer: string; email: string; phone: string; amount: number; status: OrderStatus;
  method: "pix" | "cartao" | "boleto"; gateway: string; at: number; utm_source: string; utm_campaign: string; utm_content: string;
};
export type Contact = {
  id: string; name: string; email: string; phone: string; source: string; tags: string[]; stage: string;
  fields: Record<string, string>; notes: { at: number; text: string }[]; createdAt: number;
};
export type Message = { id: string; contactId: string; channel: "whatsapp" | "telegram" | "email"; from: "cliente" | "ia" | "humano"; text: string; at: number };
export type Conversation = { contactId: string; productId: string; mode: "ia" | "humano"; status: "aberta" | "resolvida"; category: string };

export const STAGES = ["Novo", "Qualificado", "Checkout", "Cliente", "Recorrente", "Perdido"];
export const ORDER_LABEL: Record<OrderStatus, string> = { pix_gerado: "Pix gerado", pendente: "Pendente", aprovado: "Aprovado", recusado: "Recusado", reembolsado: "Reembolsado", chargeback: "Chargeback" };

export function salesSummary(orders: Order[], productId?: string) {
  const list = productId ? orders.filter((o) => o.productId === productId) : orders;
  const approved = list.filter((o) => o.status === "aprovado");
  const revenue = approved.reduce((s, o) => s + o.amount, 0);
  const refunded = list.filter((o) => o.status === "reembolsado" || o.status === "chargeback").reduce((s, o) => s + o.amount, 0);
  const pending = list.filter((o) => o.status === "pix_gerado" || o.status === "pendente").reduce((s, o) => s + o.amount, 0);
  return { count: approved.length, revenue, refunded, pending, ticket: approved.length ? revenue / approved.length : 0, conversion: list.length ? approved.length / list.length : 0 };
}
