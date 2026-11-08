import { currencyStore, useCurrency, type View } from "@/lib/currency";

const opts: [View, string][] = [["original", "Original"], ["BRL", "R$"], ["USD", "US$"]];

export function CurrencyToggle({ className = "" }: { className?: string }) {
  const c = useCurrency();
  return (
    <div className={`grid grid-cols-3 rounded-md bg-sidebar-accent p-1 text-xs font-semibold ${className}`} title={`Cotação: US$ 1 = R$ ${c.rate.toFixed(2)}`}>
      {opts.map(([v, l]) => (
        <button key={v} onClick={() => currencyStore.setView(v)} className={`rounded px-2 py-1 ${c.view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
          {l}
        </button>
      ))}
    </div>
  );
}
