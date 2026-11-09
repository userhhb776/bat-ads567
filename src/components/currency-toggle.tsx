import { currencyStore, useCurrency, type View } from "@/lib/currency";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const opts: [View, string][] = [["original", "Original"], ["BRL", "R$"], ["USD", "US$"]];

export function CurrencyToggle({ className = "" }: { className?: string }) {
  const c = useCurrency();
  return (
    <Select value={c.view} onValueChange={(v) => currencyStore.setView(v as View)}>
      <SelectTrigger aria-label="Moeda de exibição" title={`Cotação: US$ 1 = R$ ${c.rate.toFixed(2)}`} className={`h-7 w-24 border-0 bg-transparent px-1 text-[11px] text-muted-foreground shadow-none ${className}`}><SelectValue /></SelectTrigger>
      <SelectContent>{opts.map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
    </Select>
  );
}
