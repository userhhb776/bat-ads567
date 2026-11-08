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
