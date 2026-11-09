/** Reads how much money an ad account still has, from Meta's account fields (values in cents). */
export type RawAccount = { amount_spent?: string; spend_cap?: string; balance?: string; is_prepay_account?: boolean; funding_source_details?: { display_string?: string; type?: number } };
export type Funds = { kind: "prepago" | "limite" | "cartao" | "desconhecido"; available: number | null; owed: number; spent: number; label: string };

/** Parses "Saldo disponível (R$1.234,56 BRL)" / "Available balance ($12.34 USD)". */
export function parseDisplayAmount(s: string | undefined): number | null {
  const m = s?.match(/([\d.,]+)\s*[A-Z]{3}\)?\s*$/);
  if (!m) return null;
  let n = m[1]!;
  const lastComma = n.lastIndexOf(","), lastDot = n.lastIndexOf(".");
  if (lastComma > lastDot) n = n.replace(/\./g, "").replace(",", ".");
  else n = n.replace(/,/g, "");
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

export function accountFunds(a: RawAccount): Funds {
  const spent = Number(a.amount_spent ?? 0) / 100;
  const cap = Number(a.spend_cap ?? 0) / 100;
  const owed = Number(a.balance ?? 0) / 100;
  const capLeft = cap > 0 ? Math.max(0, cap - spent) : null;
  if (a.is_prepay_account) {
    const bal = parseDisplayAmount(a.funding_source_details?.display_string);
    const available = bal === null ? capLeft : capLeft === null ? bal : Math.min(bal, capLeft);
    return { kind: "prepago", available, owed, spent, label: available === null ? "Pré-pago (saldo não informado pela Meta)" : "Saldo pré-pago" };
  }
  if (capLeft !== null) return { kind: "limite", available: capLeft, owed, spent, label: "Restante do limite de gastos" };
  if (a.funding_source_details) return { kind: "cartao", available: null, owed, spent, label: "Cartão/pós-pago: cobra conforme gasta" };
  return { kind: "desconhecido", available: null, owed, spent, label: "Sem forma de pagamento informada" };
}

/** True when the remaining money covers less than ~1.5 days at the recent daily pace. */
export function isRunningOut(available: number | null, dailyPace: number) {
  if (available === null) return false;
  if (available <= 0) return true;
  return dailyPace > 0 && available < dailyPace * 1.5;
}
