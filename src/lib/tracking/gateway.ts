import { utmsFromUrl } from "./utm";

export type GatewayStatus = "approved" | "pending" | "refused" | "refunded" | "chargeback" | "abandoned";
export type NormalizedEvent = {
  external_id: string; status: GatewayStatus; amount: number; currency: string;
  product_name: string | null; customer_email: string | null; customer_phone: string | null;
  utm: Record<string, string>;
};

const get = (o: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), o);
const first = (o: unknown, paths: string[]) => { for (const p of paths) { const v = get(o, p); if (v !== undefined && v !== null && v !== "") return v; } return undefined; };

/** Maps the many status words gateways use onto one vocabulary. */
export function mapStatus(raw: string): GatewayStatus {
  const s = raw.toLowerCase();
  if (/(refund|reembols|estorn)/.test(s)) return "refunded";
  if (/(chargeback|dispute)/.test(s)) return "chargeback";
  if (/(abandon)/.test(s)) return "abandoned";
  if (/(refus|recus|declin|fail|cancel|expired|expirad)/.test(s)) return "refused";
  if (/(approv|aprov|paid|pago|complete|succeed|purchase)/.test(s)) return "approved";
  return "pending";
}

/** Value in major units; integer cents (Kiwify, Stripe, Hotmart cents fields) are converted when the field name says so. */
function money(body: unknown): number {
  const cents = first(body, ["Commissions.charge_amount", "amount_cents", "data.object.amount_total", "data.object.amount"]);
  if (typeof cents === "number") return cents / 100;
  const v = first(body, ["data.purchase.price.value", "purchase.price.value", "total_price", "amount", "value", "price", "order.total", "data.amount", "sale_amount"]);
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Normalizes Kiwify, Hotmart, Shopify, Stripe and generic JSON payloads; returns null when no order id exists. */
export function normalizeGateway(body: unknown): NormalizedEvent | null {
  const id = first(body, ["order_id", "data.purchase.transaction", "purchase.transaction", "data.object.id", "id", "transaction_id", "order.id", "sale_id"]);
  if (id === undefined) return null;
  const statusRaw = String(first(body, ["order_status", "event", "data.purchase.status", "status", "financial_status", "type", "payment_status"]) ?? "pending");
  const url = first(body, ["TrackingParameters.url", "landing_site", "checkout_url", "url"]);
  const tracked = (first(body, ["TrackingParameters", "tracking", "utm", "data.purchase.origin"]) ?? {}) as Record<string, unknown>;
  const utm: Record<string, string> = typeof url === "string" ? { ...utmsFromUrl(url) } as Record<string, string> : {};
  for (const [k, v] of Object.entries(tracked)) if (typeof v === "string" && v && k !== "url") utm[k] = v;
  const str = (v: unknown) => (v === undefined || v === null ? null : String(v));
  return {
    external_id: String(id),
    status: mapStatus(statusRaw),
    amount: money(body),
    currency: String(first(body, ["currency", "data.purchase.price.currency_value", "data.object.currency", "Commissions.currency"]) ?? "BRL").toUpperCase(),
    product_name: str(first(body, ["Product.product_name", "data.product.name", "product.name", "product_name", "line_items.0.title"])),
    customer_email: str(first(body, ["Customer.email", "data.buyer.email", "customer.email", "email", "data.object.customer_details.email"])),
    customer_phone: str(first(body, ["Customer.mobile", "data.buyer.checkout_phone", "customer.phone", "phone"])),
    utm,
  };
}
