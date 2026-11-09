import type { Order, OrderStatus, Product } from "./biz";
export type Trigger = "pix_gerado" | "pix_nao_pago" | "carrinho_abandonado" | "pagamento_aprovado" | "pagamento_recusado" | "reembolso" | "novo_lead" | "agendado";
export type Step =
  | { type: "esperar"; minutes: number }
  | { type: "condicao"; field: string; op: "=" | "!=" | ">" | "<" | "contem"; value: string; else: "parar" | "continuar" }
  | { type: "whatsapp" | "email" | "telegram"; message: string }
  | { type: "webhook"; url: string }
  | { type: "tag"; tag: string };
export type Automation = { id: string; name: string; trigger: Trigger; productId: string; steps: Step[]; active: boolean };
export type RunLog = { id: string; automationId: string; key: string; at: number; status: "ok" | "falhou" | "parado" | "agendado"; detail: string; attempts: number };

export const TRIGGERS: Record<Trigger, string> = {
  pix_gerado: "Pix gerado", pix_nao_pago: "Pix não pago", carrinho_abandonado: "Carrinho/checkout abandonado",
  pagamento_aprovado: "Pagamento aprovado", pagamento_recusado: "Pagamento recusado", reembolso: "Reembolso",
  novo_lead: "Novo lead", agendado: "Agendado (data/hora)",
};

export function render(template: string, data: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, k) => data[k] ?? "");
}

export function checkCondition(s: Extract<Step, { type: "condicao" }>, data: Record<string, string>): boolean {
  const v = data[s.field] ?? "";
  switch (s.op) {
    case "=": return v === s.value;
    case "!=": return v !== s.value;
    case ">": return Number(v) > Number(s.value);
    case "<": return Number(v) < Number(s.value);
    case "contem": return v.toLowerCase().includes(s.value.toLowerCase());
  }
}

/** Idempotency: the same automation never runs twice for the same event key. */
export function alreadyRan(logs: RunLog[], automationId: string, key: string) {
  return logs.some((l) => l.automationId === automationId && l.key === key && l.status !== "falhou");
}


/** Order statuses that fire each trigger. */
export const TRIGGER_STATUS: Partial<Record<Trigger, OrderStatus[]>> = {
  pix_gerado: ["pix_gerado"], pix_nao_pago: ["pix_gerado"], carrinho_abandonado: ["pendente"],
  pagamento_aprovado: ["aprovado"], pagamento_recusado: ["recusado"], reembolso: ["reembolsado", "chargeback"],
};

/** Gateway webhook event → order, so automations react to real payments without manual entry. */
export function gatewayToOrder(ev: { id: string; external_id: string; status: string; amount: number; product_name: string | null; customer_email: string | null; customer_phone: string | null; utm: Record<string, string>; occurred_at: string; platform: string; payload?: unknown }, products: Product[]): Order {
  const map: Record<string, OrderStatus> = { approved: "aprovado", pending: "pix_gerado", refused: "recusado", refunded: "reembolsado", chargeback: "chargeback", abandoned: "pendente" };
  const prod = products.find((p) => ev.product_name && p.name.toLowerCase() === ev.product_name.toLowerCase());
  const name = String((ev.payload as any)?.Customer?.full_name ?? (ev.payload as any)?.customer?.name ?? (ev.payload as any)?.data?.buyer?.name ?? "");
  return {
    id: `gw:${ev.platform}:${ev.external_id}:${ev.status}`, productId: prod?.id ?? "", customer: name, email: ev.customer_email ?? "", phone: ev.customer_phone ?? "",
    amount: Number(ev.amount), status: map[ev.status] ?? "pendente", method: ev.status === "pending" ? "pix" : "cartao", gateway: ev.platform,
    at: new Date(ev.occurred_at).getTime(), utm_source: ev.utm["utm_source"] ?? "", utm_campaign: ev.utm["utm_campaign"] ?? "", utm_content: ev.utm["utm_content"] ?? "",
  };
}

type Send = (channel: "whatsapp" | "email" | "telegram" | "webhook", to: string, text: string) => Promise<{ ok: boolean; error: string }>;
export type TagOp = { phone: string; email: string; tag: string };

/** One engine for the open app and the 24h worker: idempotent per automation+order, waits are re-evaluated on the next pass. */
export async function runEngine(p: { autos: Automation[]; orders: Order[]; products: Product[]; logs: RunLog[]; send: Send; now?: number | undefined; only?: { automationId: string; key: string } | undefined; newId: () => string }) {
  const now = p.now ?? Date.now();
  const out: RunLog[] = []; const tags: TagOp[] = [];
  for (const au of p.autos.filter((x) => x.active && (!p.only || x.id === p.only.automationId))) {
    const statuses = TRIGGER_STATUS[au.trigger];
    if (!statuses) continue;
    for (const o of p.orders.filter((o) => statuses.includes(o.status) && (!au.productId || o.productId === au.productId))) {
      const key = o.id;
      if (p.only && p.only.key !== key) continue;
      if (alreadyRan([...p.logs, ...out], au.id, key)) continue;
      const prev = p.logs.find((l) => l.automationId === au.id && l.key === key);
      if (prev && prev.status === "falhou" && prev.attempts >= 5) continue; // retry limit
      const prod = p.products.find((x) => x.id === o.productId);
      const data = { nome: o.customer.split(" ")[0] ?? "", valor: o.amount.toFixed(2), produto: prod?.name ?? "", checkout: prod?.checkoutUrl ?? "", entrega: prod?.deliveryUrl ?? "", status: o.status, metodo: o.method, utm_campaign: o.utm_campaign };
      let elapsed = 0; let status: RunLog["status"] = "ok"; const detail: string[] = [];
      for (const s of au.steps) {
        if (s.type === "esperar") { elapsed += s.minutes; if (o.at + elapsed * 60000 > now) { status = "agendado"; break; } continue; }
        if (s.type === "condicao") { if (!checkCondition(s, data) && s.else === "parar") { status = "parado"; detail.push("condição falsa"); break; } continue; }
        if (s.type === "tag") { tags.push({ phone: o.phone, email: o.email, tag: s.tag }); detail.push("tag " + s.tag); continue; }
        const to = s.type === "whatsapp" ? o.phone : s.type === "email" ? o.email : s.type === "webhook" ? s.url : o.phone;
        const text = s.type === "webhook" ? JSON.stringify({ event: au.trigger, order: o }) : render(s.message, data);
        const r = await p.send(s.type, to || "-", text).catch(() => ({ ok: false, error: "falha" }));
        if (!r.ok) { status = "falhou"; detail.push(`${s.type}: ${r.error}`); break; }
        detail.push(`${s.type} enviado`);
      }
      if (status === "agendado") continue;
      out.push({ id: p.newId(), automationId: au.id, key, at: now, status, detail: detail.join(" · "), attempts: (prev?.attempts ?? 0) + 1 });
    }
  }
  return { out, tags };
}
