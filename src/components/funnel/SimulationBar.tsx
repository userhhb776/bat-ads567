import { fmtBRL, fmtInt } from "@/lib/funnel/simulate";
import { useSim } from "./sim-context";

export function SimulationBar({ multiplier, onMultiplier, days, onDays }: { multiplier: number; onMultiplier: (v: number) => void; days: number; onDays: (v: number) => void }) {
  const { result, simMode } = useSim();
  const t = result.totals;
  const scale = 1;
  const stats = [
    ["Visitas", fmtInt(t.visitors * scale)],
    ["Vendas", fmtInt(t.sales * scale)],
    ["Investimento", fmtBRL(t.cost * scale)],
    ["Receita", fmtBRL(t.revenue * scale)],
    ["Lucro", fmtBRL(t.profit * scale)],
    ["ROAS", `${t.roas.toFixed(2)}x`],
  ];
  return (
    <div className="flex max-h-[30dvh] shrink-0 flex-wrap items-center gap-x-4 gap-y-2 overflow-y-auto border-t border-border bg-sidebar px-3 py-2 md:gap-6 md:px-5 md:py-3">
      {stats.map(([k, v]) => (
        <div key={k}>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{k}</div>
          <div className={`font-mono text-sm font-semibold md:text-lg ${k === "Lucro" ? (t.profit >= 0 ? "text-success" : "text-destructive") : ""}`}>{v}</div>
        </div>
      ))}
      {simMode && (
        <div className="ml-auto flex flex-wrap items-center gap-4">
          <label className="text-xs text-muted-foreground">
            Escala de tráfego <span className="font-mono text-primary">{multiplier.toFixed(1)}x</span>
            <input type="range" min={0.1} max={5} step={0.1} value={multiplier} onChange={(e) => onMultiplier(Number(e.target.value))} className="block w-40 accent-[var(--primary)]" />
          </label>
          <label className="text-xs text-muted-foreground">
            Projeção <span className="font-mono text-primary">{days} dias</span>
            <input type="range" min={1} max={365} value={days} onChange={(e) => onDays(Number(e.target.value))} className="block w-40 accent-[var(--primary)]" />
          </label>
        </div>
      )}
    </div>
  );
}
