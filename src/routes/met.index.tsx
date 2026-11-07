import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, FolderOpen, LayoutGrid, Pencil, RefreshCw, Smartphone } from "lucide-react";
import { AccountBar } from "@/components/account-bar";
import { useAccount, brl, actionValue } from "@/lib/use-account";
import { duplicateObject, getObjects, updateObject } from "@/lib/meta.functions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/met/")({
  head: () => ({
    meta: [
      { title: "Campanhas — Bat Ads" },
      { name: "description", content: "Gerencie campanhas, conjuntos e anúncios." },
      { property: "og:title", content: "Campanhas — Bat Ads" },
      { property: "og:description", content: "Gerencie campanhas, conjuntos e anúncios." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Manager,
});

type Level = "campaigns" | "adsets" | "ads";
const PURCHASE = ["purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase"];
const IC = ["initiate_checkout", "offsite_conversion.fb_pixel_initiate_checkout", "omni_initiated_checkout"];
const presets: [string, string][] = [
  ["today", "Hoje"],
  ["yesterday", "Ontem"],
  ["last_7d", "Últimos 7 dias"],
  ["last_14d", "Últimos 14 dias"],
  ["last_30d", "Últimos 30 dias"],
  ["this_month", "Este mês"],
  ["maximum", "Máximo"],
];

function Manager() {
  const [account, setAccount] = useAccount();
  const [level, setLevel] = useState<Level>("campaigns");
  const [preset, setPreset] = useState("today");
  const [nameFilter, setNameFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<Record<Level, string[]>>({ campaigns: [], adsets: [], ads: [] });
  const qc = useQueryClient();

  const parentIds = level === "adsets" ? selected.campaigns : level === "ads" ? selected.adsets : undefined;
  const q = useQuery({
    queryKey: ["objects", account, level, preset, parentIds],
    queryFn: () => getObjects({ data: { accountId: account, level, datePreset: preset, parentIds } }),
    enabled: !!account,
  });

  const update = useMutation({
    mutationFn: (v: { id: string; status?: "ACTIVE" | "PAUSED"; daily_budget?: number }) => updateObject({ data: v }),
    onSuccess: () => {
      toast.success("Atualizado na Meta");
      qc.invalidateQueries({ queryKey: ["objects"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const dup = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) await duplicateObject({ data: { id, deep: true } });
    },
    onSuccess: () => {
      toast.success("Duplicado (pausado)");
      qc.invalidateQueries({ queryKey: ["objects"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const rows = (q.data ?? []).filter(
    (r: any) =>
      r.name.toLowerCase().includes(nameFilter.toLowerCase()) &&
      (statusFilter === "all" || r.effective_status === statusFilter),
  );
  const sel = selected[level];
  const toggleSel = (id: string) =>
    setSelected((s) => ({ ...s, [level]: s[level].includes(id) ? s[level].filter((x) => x !== id) : [...s[level], id] }));

  const totals = rows.reduce(
    (t: any, r: any) => {
      const i = r.insights;
      t.spend += Number(i?.spend ?? 0);
      t.sales += actionValue(i?.actions, PURCHASE);
      t.ic += actionValue(i?.actions, IC);
      t.clicks += Number(i?.clicks ?? 0);
      t.impr += Number(i?.impressions ?? 0);
      return t;
    },
    { spend: 0, sales: 0, ic: 0, clicks: 0, impr: 0 },
  );

  const tabs: { key: Level; label: string; icon: any }[] = [
    { key: "campaigns", label: "Campanhas", icon: FolderOpen },
    {
      key: "adsets",
      label: selected.campaigns.length ? `Conjuntos para ${selected.campaigns.length} campanha(s)` : "Conjuntos de anúncios",
      icon: LayoutGrid,
    },
    {
      key: "ads",
      label: selected.adsets.length ? `Anúncios para ${selected.adsets.length} conjunto(s)` : "Anúncios",
      icon: Smartphone,
    },
  ];

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-4xl tracking-wide">Gerenciador de Campanhas</h1>
        <Button asChild>
          <Link to="/met/criar">+ Criar</Link>
        </Button>
      </div>
      <AccountBar account={account} setAccount={setAccount} />

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex border-b border-border">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setLevel(t.key)}
              className={`flex flex-1 items-center gap-2 px-5 py-3 text-sm font-semibold ${level === t.key ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
              {t.key !== "ads" && selected[t.key].length > 0 && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected((s) => ({ ...s, [t.key]: [] }));
                  }}
                  className="rounded-full bg-primary px-2 text-xs text-primary-foreground"
                >
                  {selected[t.key].length} ✕
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3 border-b border-border p-4">
          <div>
            <div className="mb-1 text-xs text-muted-foreground">Nome</div>
            <Input placeholder="Filtrar por nome" value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} className="w-52" />
          </div>
          <div>
            <div className="mb-1 text-xs text-muted-foreground">Status</div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Qualquer</SelectItem>
                <SelectItem value="ACTIVE">Ativo</SelectItem>
                <SelectItem value="PAUSED">Pausado</SelectItem>
                <SelectItem value="CAMPAIGN_PAUSED">Campanha pausada</SelectItem>
                <SelectItem value="ADSET_PAUSED">Conjunto pausado</SelectItem>
                <SelectItem value="WITH_ISSUES">Com problemas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="mb-1 text-xs text-muted-foreground">Período</div>
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {presets.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="secondary" disabled={!sel.length || dup.isPending} onClick={() => dup.mutate(sel)}>
            <Copy className="mr-2 h-4 w-4" /> Duplicar
          </Button>
          <Button className="ml-auto" onClick={() => q.refetch()} disabled={q.isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>

        {q.error && <div className="p-4 text-sm text-destructive">{(q.error as Error).message}</div>}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase text-muted-foreground">
              <tr>
                {["", "Status", level === "campaigns" ? "Campanha" : level === "adsets" ? "Conjunto" : "Anúncio", "Orçamento", "Vendas", "CPA", "Gastos", "IC", "Custo/IC", "CPC", "CTR", "CPM", "Impressões"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-3 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.isLoading && (
                <tr><td colSpan={13} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>
              )}
              {!q.isLoading && rows.length === 0 && account && (
                <tr><td colSpan={13} className="p-6 text-center text-muted-foreground">Nada por aqui.</td></tr>
              )}
              {rows.map((r: any) => {
                const i = r.insights;
                const spend = Number(i?.spend ?? 0);
                const sales = actionValue(i?.actions, PURCHASE);
                const ic = actionValue(i?.actions, IC);
                const budget = r.daily_budget ?? r.lifetime_budget;
                return (
                  <tr key={r.id} className="border-t border-border hover:bg-accent/40">
                    <td className="px-3 py-3">
                      <Checkbox checked={sel.includes(r.id)} onCheckedChange={() => toggleSel(r.id)} />
                    </td>
                    <td className="px-3 py-3">
                      <Switch
                        checked={r.status === "ACTIVE"}
                        onCheckedChange={(on) => update.mutate({ id: r.id, status: on ? "ACTIVE" : "PAUSED" })}
                      />
                    </td>
                    <td className="max-w-xs px-3 py-3">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.effective_status}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {budget ? (
                        <button
                          className="flex items-center gap-1 hover:text-primary"
                          onClick={() => {
                            const v = prompt("Novo orçamento diário (R$)", String(Number(budget) / 100));
                            if (v) update.mutate({ id: r.id, daily_budget: Math.round(Number(v.replace(",", ".")) * 100) });
                          }}
                        >
                          <Pencil className="h-3 w-3" /> {brl(Number(budget) / 100)}
                          <span className="text-xs text-muted-foreground">{r.daily_budget ? "Diário" : "Total"}</span>
                        </button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">{sales}</td>
                    <td className="px-3 py-3">{sales ? brl(spend / sales) : "—"}</td>
                    <td className="px-3 py-3">{brl(spend)}</td>
                    <td className="px-3 py-3">{ic}</td>
                    <td className="px-3 py-3">{ic ? brl(spend / ic) : "—"}</td>
                    <td className="px-3 py-3">{i?.cpc ? brl(i.cpc) : "—"}</td>
                    <td className="px-3 py-3">{i?.ctr ? `${Number(i.ctr).toFixed(2)}%` : "—"}</td>
                    <td className="px-3 py-3">{i?.cpm ? brl(i.cpm) : "—"}</td>
                    <td className="px-3 py-3">{Number(i?.impressions ?? 0).toLocaleString("pt-BR")}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted text-xs font-semibold uppercase">
              <tr>
                <td className="px-3 py-3" colSpan={3}>{rows.length} itens</td>
                <td />
                <td className="px-3 py-3">{totals.sales}</td>
                <td className="px-3 py-3">{totals.sales ? brl(totals.spend / totals.sales) : "—"}</td>
                <td className="px-3 py-3">{brl(totals.spend)}</td>
                <td className="px-3 py-3">{totals.ic}</td>
                <td className="px-3 py-3">{totals.ic ? brl(totals.spend / totals.ic) : "—"}</td>
                <td className="px-3 py-3">{totals.clicks ? brl(totals.spend / totals.clicks) : "—"}</td>
                <td className="px-3 py-3">{totals.impr ? `${((totals.clicks / totals.impr) * 100).toFixed(2)}%` : "—"}</td>
                <td className="px-3 py-3">{totals.impr ? brl((totals.spend / totals.impr) * 1000) : "—"}</td>
                <td className="px-3 py-3">{totals.impr.toLocaleString("pt-BR")}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
