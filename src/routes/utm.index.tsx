import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RefreshCw, TrendingUp, Target, Wallet, ShoppingCart, Activity, type LucideIcon } from "lucide-react";
import { useAdAccounts } from "@/components/account-bar";
import { getInsights } from "@/lib/meta.functions";
import { actionValue, brl } from "@/lib/use-account";
import { currencyStore, useCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/utm/")({
  head: () => ({
    meta: [
      { title: "Resumo UTM — Bat Gotham" },
      { name: "description", content: "Faturamento, lucro, ROAS e CPA de todas as contas." },
      { property: "og:title", content: "Resumo UTM — Bat Gotham" },
      { property: "og:description", content: "Faturamento, lucro, ROAS e CPA de todas as contas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Utm,
});

const PURCHASE = ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase"];
const IC = ["omni_initiated_checkout", "initiate_checkout", "offsite_conversion.fb_pixel_initiate_checkout"];
const presets: [string, string][] = [
  ["today", "Hoje"], ["yesterday", "Ontem"], ["last_7d", "Últimos 7 dias"], ["last_14d", "Últimos 14 dias"],
  ["last_30d", "Últimos 30 dias"], ["this_month", "Este mês"], ["last_month", "Mês passado"], ["maximum", "Máximo"],
];
const SETTINGS = "batads.utm.settings";

function metrics(rows: any[]) {
  const t = { spend: 0, revenue: 0, sales: 0, ic: 0, clicks: 0, impr: 0 };
  for (const r of rows) {
    t.spend += Number(r.spend ?? 0);
    t.revenue += actionValue(r.action_values, PURCHASE);
    t.sales += actionValue(r.actions, PURCHASE);
    t.ic += actionValue(r.actions, IC);
    t.clicks += Number(r.inline_link_clicks ?? r.clicks ?? 0);
    t.impr += Number(r.impressions ?? 0);
  }
  return t;
}

function Card({ label, value, tone, icon: Icon = Activity }: { label: string; value: string; tone?: "good" | "bad" | undefined; icon?: LucideIcon }) {
  return (
    <div className="metric-card min-w-0 rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2"><div className="text-xs text-muted-foreground">{label}</div><span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span></div>
      <div className={`mt-4 break-words text-xl font-semibold tabular-nums sm:text-3xl ${tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}

function Utm() {
  useCurrency();
  const { status, accounts } = useAdAccounts();
  const [preset, setPreset] = useState("today");
  const [scope, setScope] = useState("all");
  const [cfg, setCfg] = useState({ tax: "0", cost: "0", fee: "0" });
  useEffect(() => {
    const v = localStorage.getItem(SETTINGS);
    if (v) setCfg(JSON.parse(v));
  }, []);
  const saveCfg = (n: typeof cfg) => {
    setCfg(n);
    localStorage.setItem(SETTINGS, JSON.stringify(n));
  };

  const ids = scope === "all" ? (accounts.data ?? []).filter((a) => a.account_status === 1).map((a) => a.id) : [scope];
  const q = useQuery({
    queryKey: ["utm-insights", ids, preset],
    queryFn: () => getInsights({ data: { accountIds: ids, datePreset: preset } }),
    enabled: ids.length > 0,
    staleTime: 15 * 60_000,
  });

  const t = metrics(q.data?.campaigns ?? []);
  const pct = (v: string) => Number(v.replace(",", ".")) / 100 || 0;
  const taxes = t.revenue * pct(cfg.tax);
  const productCost = t.revenue * pct(cfg.cost);
  const fees = t.revenue * pct(cfg.fee);
  const profit = t.revenue - t.spend - taxes - productCost - fees;
  const roas = t.spend ? t.revenue / t.spend : 0;

  const chart = useMemo(() => {
    const byDay = new Map<string, { day: string; gasto: number; faturamento: number }>();
    for (const r of q.data?.daily ?? []) {
      const d = r.date_start as string;
      const cur = byDay.get(d) ?? { day: d.slice(5).split("-").reverse().join("/"), gasto: 0, faturamento: 0 };
      cur.gasto += Number(r.spend ?? 0);
      cur.faturamento += actionValue(r.action_values, PURCHASE);
      byDay.set(d, cur);
    }
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [q.data]);

  const campaigns = useMemo(
    () =>
      (q.data?.campaigns ?? [])
        .map((r) => ({ id: r.campaign_id as string, name: r.campaign_name as string, ...metrics([r]) }))
        .sort((a, b) => b.spend - a.spend),
    [q.data],
  );
  useEffect(() => {
    const list = accounts.data ?? [];
    const cur = scope === "all" ? list[0]?.currency : list.find((a) => a.id === scope)?.currency;
    if (cur) currencyStore.setSource(cur);
  }, [scope, accounts.data]);

  return (
    <div className="space-y-4 p-3 pb-24 sm:space-y-5 sm:p-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div><div className="mb-1 text-[10px] uppercase text-primary">Resultados da operação</div><h1 className="font-display text-3xl sm:text-4xl">Métricas</h1></div>
        <Button size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
          <RefreshCw className={`h-4 w-4 sm:mr-2 ${q.isFetching ? "animate-spin" : ""}`} /><span className="hidden sm:inline">Atualizar</span>
        </Button>
      </div>

      <div className="grid gap-3 sm:flex sm:flex-wrap">
        <Select value={preset} onValueChange={setPreset}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>{presets.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={scope} onValueChange={setScope}>
          <SelectTrigger className="w-full sm:w-72"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as contas ativas</SelectItem>
            {accounts.data?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} · {a.currency}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {q.error && <div className="text-sm text-destructive">{(q.error as Error).message}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="Receita atribuída" value={brl(t.revenue)} icon={Wallet} />
        <Card label="Investimento" value={brl(t.spend)} icon={TrendingUp} />
        <Card label="ROAS" value={roas ? roas.toFixed(2) : "—"} icon={Target} tone={roas >= 1 ? "good" : roas ? "bad" : undefined} />
        <Card label="Lucro estimado" value={brl(profit)} tone={profit >= 0 ? "good" : "bad"} />
        <Card label="Compras atribuídas" value={String(t.sales)} icon={ShoppingCart} />
        <Card label="CPA" value={t.sales ? brl(t.spend / t.sales) : "—"} />
        <Card label="Ticket médio" value={t.sales ? brl(t.revenue / t.sales) : "—"} />
        <Card label="Margem" value={t.revenue ? `${((profit / t.revenue) * 100).toFixed(1)}%` : "—"} />
        <Card label="Inic. de checkout" value={String(t.ic)} />
        <Card label="Custo por IC" value={t.ic ? brl(t.spend / t.ic) : "—"} />
        <Card label="Conversão IC → venda" value={t.ic ? `${((t.sales / t.ic) * 100).toFixed(1)}%` : "—"} />
        <Card label="CTR (link)" value={t.impr ? `${((t.clicks / t.impr) * 100).toFixed(2)}%` : "—"} />
      </div>

      <div className="border-y border-border py-5">
        <div className="mb-4 flex items-center gap-2 font-display text-2xl"><Activity className="h-5 w-5 text-primary" />Investimento e receita</div>
        <div className="h-56 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} width={48} />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)" }} formatter={(v: number) => brl(v)} />
              <Area type="monotone" dataKey="faturamento" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.2} />
              <Area type="monotone" dataKey="gasto" stroke="var(--signal)" fill="var(--signal)" fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {preset === "today" || preset === "yesterday" ? <div className="text-xs text-muted-foreground">Escolha um período maior para ver a evolução diária.</div> : null}
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border p-3 text-sm font-semibold sm:p-4">Campanhas</div>
        <div className="divide-y divide-border sm:hidden">
          {campaigns.map((c) => (
            <div key={c.id} className="space-y-1 p-3 text-sm">
              <div className="truncate font-medium">{c.name}</div>
              <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <span>Gasto<br /><b className="text-foreground">{brl(c.spend)}</b></span>
                <span>Vendas<br /><b className="text-foreground">{c.sales}</b></span>
                <span>ROAS<br /><b className="text-foreground">{c.spend ? (c.revenue / c.spend).toFixed(2) : "—"}</b></span>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase text-muted-foreground">
              <tr>{["Campanha", "Gasto", "Faturamento", "Vendas", "CPA", "ROAS", "IC", "Lucro"].map((h) => <th key={h} className="whitespace-nowrap px-3 py-3 text-left">{h}</th>)}</tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const p = c.revenue * (1 - pct(cfg.tax) - pct(cfg.cost) - pct(cfg.fee)) - c.spend;
                return (
                  <tr key={c.id} className="border-t border-border">
                    <td className="max-w-xs truncate px-3 py-3">{c.name}</td>
                    <td className="px-3 py-3">{brl(c.spend)}</td>
                    <td className="px-3 py-3">{brl(c.revenue)}</td>
                    <td className="px-3 py-3">{c.sales}</td>
                    <td className="px-3 py-3">{c.sales ? brl(c.spend / c.sales) : "—"}</td>
                    <td className="px-3 py-3">{c.spend ? (c.revenue / c.spend).toFixed(2) : "—"}</td>
                    <td className="px-3 py-3">{c.ic}</td>
                    <td className={`px-3 py-3 ${p >= 0 ? "text-primary" : "text-destructive"}`}>{brl(p)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!q.isLoading && campaigns.length === 0 && <div className="p-4 text-sm text-muted-foreground">Sem dados no período.</div>}
      </div>

      <div className="rounded-lg border border-border bg-card p-3 sm:p-4">
        <div className="mb-3 text-sm font-semibold">Custos para o cálculo do lucro (% do faturamento)</div>
        <div className="grid grid-cols-3 gap-3">
          {([["tax", "Impostos"], ["cost", "Custo do produto"], ["fee", "Taxas do gateway"]] as const).map(([k, l]) => (
            <label key={k} className="min-w-0 space-y-1">
              <span className="block truncate text-xs text-muted-foreground">{l}</span>
              <Input inputMode="decimal" value={cfg[k]} onChange={(e) => saveCfg({ ...cfg, [k]: e.target.value })} />
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Receita e compras atribuídas pela plataforma de anúncios; pagamentos aprovados ainda não estão conectados.
        </p>
      </div>
    </div>
  );
}
