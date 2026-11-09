import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listGatewayCreds, saveGatewayCred, deleteGatewayCred, dbHealth, purgeLogs } from "@/lib/integrations.functions";
import { Button } from "@/components/ui/button";

const slug = (g: string) => g.toLowerCase().replace(/[^a-z0-9]/g, "");
const HINT: Record<string, string> = {
  hotmart: "Hottok (Ferramentas → Webhook)", kiwify: "Token do webhook", eduzz: "Chave de API / origin", monetizze: "Chave de postback",
  perfectpay: "Token público", braip: "Chave única do postback", ticto: "Token do webhook", yampi: "Secret do webhook",
  cartpanda: "Token da loja", shopify: "Secret de assinatura", pagarme: "Chave secreta", appmax: "Token de acesso",
};

export function GatewayTokens({ gateways }: { gateways: string[] }) {
  const list = useQuery({ queryKey: ["gateway-creds"], queryFn: () => listGatewayCreds() });
  const save = useServerFn(saveGatewayCred);
  const del = useServerFn(deleteGatewayCred);
  const [open, setOpen] = useState("");
  const [token, setToken] = useState(""); const [secret, setSecret] = useState("");
  return <div className="mt-6">
    <p className="mb-2 text-xs text-muted-foreground">Tokens das plataformas: algumas pedem uma chave de API, outras entregam um código de verificação do webhook. Salve aqui. Com o código de verificação salvo, eu só aceito vendas que chegarem com ele.</p>
    <div className="grid gap-2 sm:grid-cols-2">{gateways.map((g) => { const p = slug(g); const c = list.data?.find((x) => x.platform === p); return <div key={g} className="min-w-0 rounded-md border border-border p-3 text-sm">
      <div className="flex items-center justify-between gap-2"><span className="font-medium">{g}</span><span className="truncate text-[10px] uppercase text-muted-foreground">{c ? `token ${c.token || "—"} · verificação ${c.secret || "—"}` : "sem token"}</span></div>
      {open === p ? <form className="mt-2 space-y-2" onSubmit={async (e) => { e.preventDefault(); try { await save({ data: { platform: p, token, secret } }); toast.success(`${g} salvo`); setOpen(""); await list.refetch(); } catch (er) { toast.error((er as Error).message); } }}>
        <input type="password" placeholder="Token / chave de API (se a plataforma tiver)" value={token} onChange={(e) => setToken(e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" />
        <input type="password" placeholder={HINT[p] ?? "Código de verificação do webhook"} value={secret} onChange={(e) => setSecret(e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" />
        <div className="flex gap-2"><Button size="sm" type="submit">Salvar</Button><Button size="sm" variant="ghost" type="button" onClick={() => setOpen("")}>Cancelar</Button></div>
      </form> : <div className="mt-2 flex gap-2"><Button size="sm" variant="outline" onClick={() => { setOpen(p); setToken(""); setSecret(""); }}>{c ? "Trocar token" : "Adicionar token"}</Button>{c && <Button size="sm" variant="ghost" onClick={async () => { if (!confirm(`Remover token da ${g}?`)) return; await del({ data: { platform: p } }); await list.refetch(); }}>Remover</Button>}</div>}
    </div>; })}</div>
  </div>;
}

const NAMES: Record<string, string> = { track_events: "Visitas rastreadas", messages: "Mensagens", audit_log: "Histórico de ações", automation_runs: "Execuções de fluxos", watch_log: "Registros da vigia", notifications: "Avisos", gateway_events: "Eventos de vendas", jobs: "Tarefas agendadas", contacts: "Contatos", crowley_messages: "Conversa com Crowley" };

export function DbHealth() {
  const q = useQuery({ queryKey: ["db-health"], queryFn: () => dbHealth() });
  const purge = useServerFn(purgeLogs);
  const [days, setDays] = useState(3);
  return <section className="rounded-lg border border-border bg-card p-4">
    <div className="mb-2 text-sm font-semibold">Saúde do banco de dados</div>
    <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">{(q.data ?? []).map((r) => <div key={r.table} className="rounded border border-border p-2"><div className="text-muted-foreground">{NAMES[r.table] ?? r.table}</div><div className="text-base font-semibold">{r.rows === null ? "—" : r.rows.toLocaleString("pt-BR")}</div></div>)}</div>
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><span>Limpar visitas, vigia, execuções e avisos com mais de</span><select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded border border-border bg-background px-2 py-1">{[2, 3, 7, 30].map((d) => <option key={d} value={d}>{d} dias</option>)}</select>
      <Button size="sm" variant="outline" onClick={async () => { if (!confirm(`Apagar esses registros com mais de ${days} dias? Vendas, contatos e mensagens ficam.`)) return; try { const r = await purge({ data: { days } }); toast.success(`${r.removed} registros removidos`); await q.refetch(); } catch (e) { toast.error((e as Error).message); } }}>Limpar agora</Button></div>
  </section>;
}
