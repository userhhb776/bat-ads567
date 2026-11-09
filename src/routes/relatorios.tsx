import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Bot, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, Empty, Field, NativeSelect, PageHead, head } from "@/components/ui-kit";
import { AccountBar } from "@/components/account-bar";
import { useAccount } from "@/lib/use-account";
import { money, useCurrency } from "@/lib/currency";
import { getObjects } from "@/lib/meta.functions";
import { crowleyChat } from "@/lib/crowley.functions";
import { delta, metricsOf, previousRange, sumMetrics, type Metrics } from "@/lib/reports";
import { useGatewayEvents, useSession, summarizeSales } from "@/lib/sales";
import { paymentTotals } from "@/lib/dashboard";
import { useStore, download, toCsv } from "@/lib/store";
import type { Product, Order } from "@/lib/biz";
import type { Automation, RunLog } from "@/lib/automation";

export const Route = createFileRoute("/relatorios")({
  head: () => head("Relatórios", "Campanhas, conjuntos, anúncios, produtos, automações e atendimento com comparação entre períodos e exportação."),
  component: Reports,
});

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const COLS: { key: keyof Metrics; label: string; fmt: "m" | "n" | "p" | "x" }[] = [
  { key: "spend", label: "Gasto", fmt: "m" }, { key: "impressions", label: "Impr.", fmt: "n" }, { key: "ctr", label: "CTR", fmt: "p" }, { key: "cpc", label: "CPC", fmt: "m" },
  { key: "cpm", label: "CPM", fmt: "m" }, { key: "purchases", label: "Compras", fmt: "n" }, { key: "leads", label: "Leads", fmt: "n" }, { key: "cpa", label: "CPA", fmt: "m" },
  { key: "revenue", label: "Valor conv.", fmt: "m" }, { key: "roas", label: "ROAS", fmt: "x" },
];

function Reports() {
  const currency = useCurrency();
  const [account, setAccount] = useAccount();
  const [range, setRange] = useState({ since: daysAgo(6), until: today() });
  const [level, setLevel] = useState<"campaigns" | "adsets" | "ads">("campaigns");
  const [tab, setTab] = useState<"anuncios" | "vendas" | "operacao">("anuncios");
  const prev = previousRange(range.since, range.until);
  const cur = useQuery({ queryKey: ["rep", account, level, range], enabled: !!account, queryFn: () => getObjects({ data: { accountId: account, level, datePreset: "last_7d", timeRange: range } }), staleTime: 300000 });
  const old = useQuery({ queryKey: ["rep", account, level, prev], enabled: !!account, queryFn: () => getObjects({ data: { accountId: account, level, datePreset: "last_7d", timeRange: prev } }), staleTime: 300000 });
  const rows = (cur.data ?? []).map((o: any) => ({ id: o.id, name: o.name, status: o.effective_status, m: metricsOf(o.insights), p: metricsOf((old.data ?? []).find((x: any) => x.id === o.id)?.insights) })).filter((r) => r.m.spend > 0 || r.p.spend > 0);
  const total = sumMetrics(rows.map((r) => r.m)), totalPrev = sumMetrics(rows.map((r) => r.p));
  const fmt = (v: number, f: string) => f === "m" ? money(v) : f === "p" ? `${v.toFixed(2)}%` : f === "x" ? `${v.toFixed(2)}x` : v.toLocaleString("pt-BR");
  const session = useSession();
  const events = useGatewayEvents(!!session.data, Math.ceil((Date.now() - new Date(prev.since).getTime()) / 864e5) + 1);
  const [products] = useStore<Product[]>("products", []);
  const [orders] = useStore<Order[]>("orders", []);
  const [autos] = useStore<Automation[]>("automations", []);
  const [runs] = useStore<RunLog[]>("automation-logs", []);
  const [convs] = useStore<any[]>("conversations", []);
  const inRange = (iso: string, r: { since: string; until: string }) => iso.slice(0, 10) >= r.since && iso.slice(0, 10) <= r.until;
  const pay = useMemo(() => summarizeSales(events.data ?? []).orders.filter((e) => inRange(e.occurred_at, range)), [events.data, range]);
  const payPrev = useMemo(() => summarizeSales(events.data ?? []).orders.filter((e) => inRange(e.occurred_at, prev)), [events.data, prev.since]);
  const tCur = paymentTotals(pay, currency.source, currency.rate), tPrev = paymentTotals(payPrev, currency.source, currency.rate);
  const group = (key: (e: any) => string) => { const m = new Map<string, any[]>(); for (const e of pay) { const k = key(e) || "(sem informação)"; m.set(k, [...(m.get(k) ?? []), e]); } return [...m].map(([k, list]) => ({ k, ...paymentTotals(list, currency.source, currency.rate) })).sort((a, b) => b.revenue - a.revenue); };
  const [ai, setAi] = useState(""); const [busy, setBusy] = useState(false);
  const chat = useServerFn(crowleyChat);
  async function analyze() {
    setBusy(true);
    try {
      const r = await chat({ data: { provider: "auto", messages: [{ role: "user", content: "Analise este relatório comparando os dois períodos: tendências, anomalias, oportunidades, explique as mudanças e recomende ações. Não invente números." }], context: JSON.stringify({ range, prev, level, total, totalPrev, rows: rows.slice(0, 40).map((r) => ({ name: r.name, status: r.status, atual: r.m, anterior: r.p })), vendas: { atual: tCur, anterior: tPrev } }).slice(0, 19000) } });
      if ("error" in r) toast.error(r.error as string); else setAi(r.text);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  const exportAds = () => download(`relatorio-${level}-${range.since}_${range.until}.csv`, toCsv(rows.map((r) => ({ nome: r.name, status: r.status, ...Object.fromEntries(COLS.flatMap((c) => [[c.label, r.m[c.key].toFixed(2)], [`${c.label} anterior`, r.p[c.key].toFixed(2)]])) }))));
  const Delta = ({ c, p, inverse }: { c: number; p: number; inverse?: boolean }) => { const d = delta(c, p); if (d === null) return null; const good = inverse ? d < 0 : d > 0; return <span className={`ml-1 text-[10px] ${good ? "text-primary" : "text-destructive"}`}>{d > 0 ? "+" : ""}{d.toFixed(0)}%</span>; };
  return (
    <div className="space-y-4 p-4 pb-24 md:p-6">
      <PageHead title="Relatórios" sub={`Período ${range.since} a ${range.until} comparado com ${prev.since} a ${prev.until}.`}>
        <Button size="sm" variant="outline" onClick={analyze} disabled={busy}><Bot className="h-4 w-4" />{busy ? "Analisando…" : "Análise do Crowley"}</Button>
      </PageHead>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="De"><Input type="date" value={range.since} max={range.until} onChange={(e) => setRange({ ...range, since: e.target.value })} /></Field>
        <Field label="Até"><Input type="date" value={range.until} min={range.since} onChange={(e) => setRange({ ...range, until: e.target.value })} /></Field>
        {[7, 14, 30].map((n) => <Button key={n} size="sm" variant="outline" onClick={() => setRange({ since: daysAgo(n - 1), until: today() })}>{n} dias</Button>)}
      </div>
      <div className="flex gap-1.5">{(["anuncios", "vendas", "operacao"] as const).map((t) => <Button key={t} size="sm" variant={tab === t ? "default" : "outline"} className="h-7 text-xs" onClick={() => setTab(t)}>{t === "anuncios" ? "Anúncios" : t === "vendas" ? "Vendas e produtos" : "Automações e atendimento"}</Button>)}</div>
      {ai && <Card className="chat-markdown text-sm"><ReactMarkdown>{ai}</ReactMarkdown></Card>}
      {tab === "anuncios" && (
        <div className="space-y-3">
          <AccountBar account={account} setAccount={setAccount} />
          <div className="flex flex-wrap gap-2">
            <NativeSelect value={level} onChange={(e) => setLevel(e.target.value as never)}><option value="campaigns">Por campanha</option><option value="adsets">Por conjunto</option><option value="ads">Por anúncio</option></NativeSelect>
            <Button size="sm" variant="outline" onClick={exportAds} disabled={!rows.length}><Download className="h-4 w-4" />CSV</Button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {COLS.map((c) => <div key={c.key} className="rounded-md border border-border bg-card px-3 py-2"><div className="text-[10px] uppercase text-muted-foreground">{c.label}</div><div className="text-sm font-semibold tabular-nums">{fmt(total[c.key], c.fmt)}<Delta c={total[c.key]} p={totalPrev[c.key]} inverse={["cpa", "cpc", "cpm", "spend"].includes(c.key)} /></div></div>)}
          </div>
          {cur.isLoading ? <Empty>Carregando…</Empty> : cur.error ? <Empty>{(cur.error as Error).message}</Empty> : !rows.length ? <Empty>Sem gasto nos períodos.</Empty> : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="p-2">Nome</th>{COLS.map((c) => <th key={c.key} className="p-2 text-right">{c.label}</th>)}</tr></thead>
                <tbody>{rows.sort((a, b) => b.m.spend - a.m.spend).map((r) => <tr key={r.id} className="border-b border-border"><td className="max-w-56 truncate p-2">{r.name}<div className="text-[10px] text-muted-foreground">{r.status}</div></td>{COLS.map((c) => <td key={c.key} className="whitespace-nowrap p-2 text-right tabular-nums">{fmt(r.m[c.key], c.fmt)}<Delta c={r.m[c.key]} p={r.p[c.key]} inverse={["cpa", "cpc", "cpm", "spend"].includes(c.key)} /></td>)}</tr>)}</tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {tab === "vendas" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[["Faturamento", money(tCur.revenue), tCur.revenue, tPrev.revenue], ["Vendas", tCur.sales, tCur.sales, tPrev.sales], ["Ticket médio", tCur.sales ? money(tCur.avgTicket) : "—", tCur.avgTicket, tPrev.avgTicket], ["Pendentes", tCur.pending, tCur.pending, tPrev.pending], ["Reembolsos", tCur.refunds, tCur.refunds, tPrev.refunds]].map(([l, v, c, p]) => <div key={String(l)} className="rounded-md border border-border bg-card px-3 py-2"><div className="text-[10px] uppercase text-muted-foreground">{l}</div><div className="text-sm font-semibold">{v}<Delta c={Number(c)} p={Number(p)} inverse={l === "Reembolsos"} /></div></div>)}
          </div>
          {[["Por produto", (e: any) => e.product_name], ["Por campanha (utm_campaign)", (e: any) => e.utm?.utm_campaign], ["Por anúncio/criativo (utm_content)", (e: any) => e.utm?.utm_content], ["Por origem (utm_source)", (e: any) => e.utm?.utm_source]].map(([title, fn]) => {
            const g = group(fn as (e: any) => string);
            return <Card key={String(title)}><div className="mb-2 flex justify-between text-sm font-medium">{String(title)}<button className="text-xs text-primary" onClick={() => download(`vendas-${String(title).split(" ")[1]}.csv`, toCsv(g.map((x) => ({ item: x.k, vendas: x.sales, faturamento: x.revenue.toFixed(2), ticket: x.avgTicket.toFixed(2), reembolsos: x.refunds }))))}>CSV</button></div>{!g.length ? <p className="text-xs text-muted-foreground">Sem pagamentos no período.</p> : g.slice(0, 15).map((x) => <div key={x.k} className="flex justify-between border-b border-border py-1.5 text-xs"><span className="truncate">{x.k}</span><span>{x.sales} vendas · {money(x.revenue)} · {x.refunds} reemb.</span></div>)}</Card>;
          })}
          <Card><div className="mb-2 text-sm font-medium">Pedidos cadastrados manualmente (Produtos)</div>{products.map((p) => { const os = orders.filter((o) => o.productId === p.id && inRange(new Date(o.at).toISOString(), range)); const ap = os.filter((o) => o.status === "aprovado"); const rev = ap.reduce((s, o) => s + o.amount, 0); return <div key={p.id} className="flex justify-between border-b border-border py-1.5 text-xs"><span>{p.name}</span><span>{ap.length} aprovados · R$ {rev.toFixed(2)} · lucro est. R$ {(rev - ap.length * (p.cost || 0)).toFixed(2)}</span></div>; })}{!products.length && <p className="text-xs text-muted-foreground">Nenhum produto.</p>}</Card>
        </div>
      )}
      {tab === "operacao" && (
        <div className="grid gap-3 md:grid-cols-2">
          <Card><div className="mb-2 text-sm font-medium">Automações no período</div>{autos.map((a) => { const rs = runs.filter((r) => r.automationId === a.id && inRange(new Date(r.at).toISOString(), range)); return <div key={a.id} className="flex justify-between border-b border-border py-1.5 text-xs"><span>{a.name}</span><span>{rs.filter((r) => r.status === "ok").length} ok · {rs.filter((r) => r.status === "falhou").length} falhas · {rs.filter((r) => r.status === "parado").length} paradas</span></div>; })}{!autos.length && <p className="text-xs text-muted-foreground">Nenhuma automação.</p>}</Card>
          <Card><div className="mb-2 text-sm font-medium">Atendimento</div>{(() => { const list = convs.filter((c) => !c.updatedAt || inRange(new Date(c.updatedAt).toISOString(), range)); const by = (k: string) => list.filter((c) => c.status === k).length; return <div className="space-y-1 text-xs"><div className="flex justify-between"><span>Conversas</span><span>{list.length}</span></div><div className="flex justify-between"><span>Abertas</span><span>{by("aberta")}</span></div><div className="flex justify-between"><span>Com humano</span><span>{by("humano")}</span></div><div className="flex justify-between"><span>Resolvidas</span><span>{by("resolvida")}</span></div></div>; })()}</Card>
        </div>
      )}
    </div>
  );
}
