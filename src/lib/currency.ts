import { useSyncExternalStore } from "react";

export type View = "original" | "BRL" | "USD";
type State = { view: View; source: string; rate: number };

let state: State = { view: "original", source: "BRL", rate: 5.5 };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export const currencyStore = {
  get: () => state,
  subscribe: (f: () => void) => {
    subs.add(f);
    return () => subs.delete(f);
  },
  setView(view: View) {
    state = { ...state, view };
    try { localStorage.setItem("batgotham.currency", view); } catch {}
    emit();
  },
  setSource(source: string) {
    if (source && source !== state.source) { state = { ...state, source }; emit(); }
  },
  setRate(rate: number) {
    if (rate > 0) { state = { ...state, rate }; emit(); }
  },
};

export function useCurrency() {
  return useSyncExternalStore(currencyStore.subscribe, currencyStore.get, currencyStore.get);
}

/** Converte um valor da moeda da conta para a moeda escolhida (USD↔BRL) e formata. */
export function money(v: number | string | undefined | null) {
  if (v == null || v === "") return "—";
  const { view, source, rate } = state;
  let n = Number(v);
  let cur = source === "USD" || source === "BRL" ? source : "BRL";
  if (view !== "original" && view !== cur) {
    n = cur === "USD" ? n * rate : n / rate;
    cur = view;
  }
  return n.toLocaleString("pt-BR", { style: "currency", currency: cur });
}

export async function loadRate() {
  try {
    const saved = localStorage.getItem("batgotham.currency") as View | null;
    if (saved) currencyStore.setView(saved);
    const r = await fetch("https://open.er-api.com/v6/latest/USD");
    const j = await r.json();
    currencyStore.setRate(Number(j?.rates?.BRL));
  } catch {}
}
