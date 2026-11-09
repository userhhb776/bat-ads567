import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deepseekBalance } from "@/lib/channels.functions";

/** Shows the live DeepSeek credit balance so the chefe knows when to top up. */
export function DeepseekStatus() {
  const fn = useServerFn(deepseekBalance);
  const q = useQuery({ queryKey: ["deepseek-balance"], queryFn: () => fn(), staleTime: 60000, retry: false });
  const d = q.data;
  const low = d?.ok && d.balance < 1;
  return <section className="space-y-2 border-b border-border pb-6">
    <div className="flex items-center justify-between gap-3"><h2 className="font-display text-2xl">Créditos da DeepSeek</h2><Button variant="ghost" size="icon" aria-label="Atualizar saldo" onClick={() => void q.refetch()}><RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`}/></Button></div>
    {q.isLoading ? <p className="text-sm text-muted-foreground">Consultando…</p> : !d?.ok ? <p className="text-sm text-destructive">{d?.error || "Não consegui consultar."}</p> :
      <div><p className="text-3xl font-semibold">{d.currency === "USD" ? "US$" : d.currency} {d.balance.toFixed(2)}</p>
      <p className={`text-xs ${low || !d.available ? "text-destructive" : "text-muted-foreground"}`}>{!d.available ? "Sem saldo: o Crowley vai usar só o Ollama até você recarregar." : low ? "Saldo baixo — vale recarregar em platform.deepseek.com." : "Saldo ok. Uma conversa comum custa menos de 1 centavo de dólar."}</p></div>}
  </section>;
}
