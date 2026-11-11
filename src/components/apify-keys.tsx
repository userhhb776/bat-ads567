import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apifyStatus } from "@/lib/spy.functions";
import { saveGatewayCred, deleteGatewayCred } from "@/lib/integrations.functions";

const SLOTS = [["apify", "Principal"], ...[2, 3, 4, 5, 6, 7, 8].map((n) => [`apify-${n}`, `Reserva ${n - 1}`] as const)] as const;

/** Bat Spy keys: balance per key; when one runs out the search moves to the next. */
export function ApifyKeys() {
  const status = useServerFn(apifyStatus), save = useServerFn(saveGatewayCred), del = useServerFn(deleteGatewayCred);
  const q = useQuery({ queryKey: ["apify-status"], queryFn: () => status(), staleTime: 60000, retry: false });
  const [draft, setDraft] = useState<Record<string, string>>({});
  return <section className="space-y-3 border-b border-border pb-6">
    <div className="flex items-center justify-between gap-3"><div><h2 className="font-display text-2xl">Bat Spy · chaves Apify</h2><p className="text-xs text-muted-foreground">Quando uma chave fica sem crédito, a mineração passa sozinha para a próxima.</p></div><Button variant="ghost" size="icon" aria-label="Atualizar saldo" onClick={() => void q.refetch()}><RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} /></Button></div>
    <div className="grid gap-3 sm:grid-cols-2">{SLOTS.map(([slot, label]) => { const s = q.data?.find((x) => x.slot === slot); const left = s ? s.limit - s.used : 0; const pct = s?.limit ? Math.min(100, (s.used / s.limit) * 100) : 0;
      return <div key={slot} className="space-y-2 rounded-md border border-border bg-card p-3">
        <div className="flex items-center justify-between"><span className="text-sm font-semibold">{label}</span>{s && <Button variant="ghost" size="icon" aria-label={`Remover ${label}`} onClick={async () => { if (!window.confirm("Remover esta chave?")) return; await del({ data: { platform: slot } }); void q.refetch(); }}><Trash2 className="h-4 w-4" /></Button>}</div>
        {s ? s.ok ? <><p className="text-2xl font-semibold">US$ {left.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">restantes de US$ {s.limit.toFixed(2)}</span></p>
          <div className="h-1.5 rounded-full bg-muted"><div className={`h-1.5 rounded-full ${pct > 85 ? "bg-destructive" : "bg-primary"}`} style={{ width: `${pct}%` }} /></div>
          <p className={`text-xs ${pct > 85 ? "text-destructive" : "text-muted-foreground"}`}>{pct > 85 ? "Quase acabando — troque ou renove." : "Saldo ok."} Plano {s.plan}{s.resetAt ? ` · renova ${new Date(s.resetAt).toLocaleDateString("pt-BR")}` : ""}</p></>
          : <p className="text-sm text-destructive">{s.error}</p>
          : <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); const v = (draft[slot] ?? "").trim(); if (!/^apify_api_/.test(v)) { toast.error("A chave começa com apify_api_"); return; } await save({ data: { platform: slot, token: v, secret: "" } }); setDraft({ ...draft, [slot]: "" }); toast.success("Chave salva"); void q.refetch(); }}><Input type="password" placeholder="apify_api_…" value={draft[slot] ?? ""} onChange={(e) => setDraft({ ...draft, [slot]: e.target.value })} /><Button>Salvar</Button></form>}
      </div>; })}</div>
  </section>;
}
