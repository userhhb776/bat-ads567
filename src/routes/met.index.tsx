import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronRight, Copy, Eye, FolderOpen, LayoutGrid, Pencil, RefreshCw, Smartphone, Trash2 } from "lucide-react";
import { AdReviewDialog } from "@/components/ad-review";
import { AccountBar, useAdAccounts } from "@/components/account-bar";
import { MetaColumnsDialog } from "@/components/meta-columns-dialog";
import { MetaEditSheet } from "@/components/meta-edit-sheet";
import { cleanColumns, DEFAULT_COLUMNS, formatMetric, metricByKey, NO_TOTAL, sumInsights } from "@/lib/meta-metrics";
import { useStore } from "@/lib/store";
import { useAccount, brl } from "@/lib/use-account";
import { useCurrency } from "@/lib/currency";
import { duplicateObject, getObjects, updateObject } from "@/lib/meta.functions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/met/")({
  head: () => ({
    meta: [
      { title: "Campanhas — Bat Gotham" },
      { name: "description", content: "Gerencie campanhas, conjuntos e anúncios." },
      { property: "og:title", content: "Campanhas — Bat Gotham" },
      { property: "og:description", content: "Gerencie campanhas, conjuntos e anúncios." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Manager,
});

type Level = "campaigns" | "adsets" | "ads";
const presets: [string, string][] = [
  ["today", "Hoje"],
  ["yesterday", "Ontem"],
  ["last_7d", "Últimos 7 dias"],
  ["last_14d", "Últimos 14 dias"],
  ["last_30d", "Últimos 30 dias"],
  ["last_90d", "Últimos 90 dias"],
  ["this_month", "Este mês"],
  ["last_month", "Mês passado"],
  ["this_year", "Este ano"],
  ["last_year", "Ano passado"],
  ["maximum", "Máximo"],
];
const STATUS_PT: Record<string, string> = { ACTIVE: "Ativo", PAUSED: "Pausado", ARCHIVED: "Arquivado", CAMPAIGN_PAUSED: "Campanha pausada", ADSET_PAUSED: "Conjunto pausado", WITH_ISSUES: "Com problemas", DISAPPROVED: "Reprovado", PENDING_REVIEW: "Em revisão", IN_PROCESS: "Processando", DELETED: "Excluído" };

function Manager() {
  useCurrency();
  const [account, setAccount] = useAccount();
  const [level, setLevel] = useState<Level>("campaigns");
  const [preset, setPreset] = useState("today");
  const [nameFilter, setNameFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [archived, setArchived] = useState(false);
  const [selected, setSelected] = useState<Record<Level, string[]>>({ campaigns: [], adsets: [], ads: [] });
  const [savedCols, setSavedCols] = useStore<string[]>("met-columns", DEFAULT_COLUMNS);
  const cols = cleanColumns(savedCols).map((k) => metricByKey(k)!).filter(Boolean);
  const [edit, setEdit] = useState<{ id: string; level: Level } | null>(null);
  const qc = useQueryClient();
  const { accounts } = useAdAccounts();
  const currency = ((accounts.data ?? []) as any[]).find((a) => a.id === account)?.currency ?? "moeda da conta";

  const parentIds = level === "adsets" ? selected.campaigns : level === "ads" ? selected.adsets : undefined;
  const q = useQuery({
    queryKey: ["objects", account, level, preset, parentIds, archived],
    queryFn: () => getObjects({ data: { accountId: account, level, datePreset: preset, parentIds, includeArchived: archived } }),
    enabled: !!account,
  });

  const update = useMutation({
    mutationFn: (v: { id: string; status?: "ACTIVE" | "PAUSED"; daily_budget?: number; before_budget?: number }) => updateObject({ data: v }),
    onSuccess: () => {
      toast.success("Atualizado na conta de anúncios");
      qc.invalidateQueries({ queryKey: ["objects"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const dup = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) await duplicateObject({ data: { id, deep: true, level } });
    },
    onSuccess: (_d, ids) => {
      toast.success(ids.length > 1 ? `${ids.length} cópias criadas (pausadas)` : "Cópia criada (pausada)");
      qc.invalidateQueries({ queryKey: ["objects"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const del = useMutation({
    mutationFn: async (ids: string[]) => { for (const id of ids) await updateObject({ data: { id, status: "DELETED" } }); },
    onSuccess: () => { toast.success("Excluído na conta de anúncios"); setSelected((s) => ({ ...s, [level]: [] })); qc.invalidateQueries({ queryKey: ["objects"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const [review, setReview] = useState("");

  const rows = ((q.data ?? []) as any[]).filter(
    (r: any) =>
      r.name.toLowerCase().includes(nameFilter.toLowerCase()) &&
      (statusFilter === "all" || r.effective_status === statusFilter),
  );
  const sel = selected[level];
  const toggleSel = (id: string) =>
    setSelected((s) => ({ ...s, [level]: s[level].includes(id) ? s[level].filter((x) => x !== id) : [...s[level], id] }));
  const allSel = rows.length > 0 && rows.every((r: any) => sel.includes(r.id));
  const total = sumInsights(rows.map((r: any) => r.insights));
  const insightsError = (q.data as any[] | undefined)?.[0]?.insightsError as string | null | undefined;
  const drill = (r: any) => {
    if (level === "campaigns") { setSelected((s) => ({ ...s, campaigns: [r.id], adsets: [] })); setLevel("adsets"); }
    else if (level === "adsets") { setSelected((s) => ({ ...s, adsets: [r.id] })); setLevel("ads"); }
  };

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
  const colSpan = cols.length + 4;

  return (
    <div className="space-y-4 p-3 pb-24 sm:space-y-5 sm:p-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <h1 className="truncate font-display text-3xl tracking-wide sm:text-4xl">Gerenciador de Campanhas</h1>
        <Button asChild>
          <Link to="/met/criar">+ Criar</Link>
        </Button>
      </div>
      <AccountBar account={account} setAccount={setAccount} />

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex overflow-x-auto border-b border-border">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setLevel(t.key)}
              className={`flex shrink-0 flex-1 items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-semibold ${level === t.key ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
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

        <div className="grid grid-cols-2 items-end gap-3 border-b border-border p-3 sm:flex sm:flex-wrap sm:p-4">
          <div>
            <div className="mb-1 text-xs text-muted-foreground">Nome</div>
            <Input placeholder="Filtrar por nome" value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} className="w-full sm:w-52" />
          </div>
          <div>
            <div className="mb-1 text-xs text-muted-foreground">Status</div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Qualquer</SelectItem>
                {Object.entries(STATUS_PT).filter(([k]) => k !== "DELETED").map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="mb-1 text-xs text-muted-foreground">Período</div>
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {presets.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm"><Switch checked={archived} onCheckedChange={setArchived} aria-label="Mostrar arquivadas" />Arquivadas</label>
          <MetaColumnsDialog cols={cols.map((c) => c.key)} setCols={setSavedCols} />
          <Button variant="secondary" disabled={!sel.length || dup.isPending} onClick={() => dup.mutate(sel)}>
            <Copy className="mr-2 h-4 w-4" /> Duplicar
          </Button>
          <Button variant="outline" disabled={!sel.length || del.isPending} onClick={() => { if (confirm(`Excluir ${sel.length} item(ns) na conta de anúncios? Isso não pode ser desfeito.`)) del.mutate(sel); }}>
            <Trash2 className="mr-2 h-4 w-4" /> Excluir
          </Button>
          {level === "ads" && <Button variant="outline" disabled={sel.length !== 1} onClick={() => setReview(sel[0]!)}><Eye className="mr-2 h-4 w-4" /> Prévia e revisão</Button>}
          <Button className="sm:ml-auto" onClick={() => q.refetch()} disabled={q.isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>

        {q.error && <div className="p-4 text-sm text-destructive">{(q.error as Error).message}</div>}
        {insightsError && <div className="p-3 text-xs text-destructive">Os itens carregaram, mas as métricas desse período falharam: {insightsError}</div>}

        {/* Own scroll area: header, name column and totals stay visible while scrolling far down or sideways. */}
        <div className="max-h-[calc(100dvh-13rem)] overflow-auto overscroll-contain">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="sticky left-0 top-0 z-30 border-b border-border bg-muted px-3 py-3 text-left"><Checkbox checked={allSel} onCheckedChange={() => setSelected((s) => ({ ...s, [level]: allSel ? [] : rows.map((r: any) => r.id) }))} aria-label="Selecionar todos" /></th>
                <th className="sticky top-0 z-20 border-b border-border bg-muted px-3 py-3 text-left font-semibold">Status</th>
                <th className="sticky left-10 top-0 z-30 min-w-[13rem] border-b border-border bg-muted px-3 py-3 text-left font-semibold">{level === "campaigns" ? "Campanha" : level === "adsets" ? "Conjunto" : "Anúncio"}</th>
                <th className="sticky top-0 z-20 border-b border-border bg-muted px-3 py-3 text-left font-semibold">Orçamento</th>
                {cols.map((c) => <th key={c.key} className="sticky top-0 z-20 whitespace-nowrap border-b border-border bg-muted px-3 py-3 text-left font-semibold">{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {q.isLoading && (
                <tr><td colSpan={colSpan} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>
              )}
              {!q.isLoading && rows.length === 0 && account && (
                <tr><td colSpan={colSpan} className="p-6 text-center text-muted-foreground">Nada por aqui.</td></tr>
              )}
              {rows.map((r: any) => {
                const i = r.insights;
                const budget = r.daily_budget ?? r.lifetime_budget;
                return (
                  <tr key={r.id} className="group">
                    <td className="sticky left-0 z-10 border-t border-border bg-card px-3 py-3 group-hover:bg-accent">
                      <Checkbox checked={sel.includes(r.id)} onCheckedChange={() => toggleSel(r.id)} />
                    </td>
                    <td className="border-t border-border px-3 py-3 group-hover:bg-accent/40">
                      <Switch
                        checked={r.status === "ACTIVE"}
                        disabled={r.status === "ARCHIVED"}
                        onCheckedChange={(on) => update.mutate({ id: r.id, status: on ? "ACTIVE" : "PAUSED" })}
                      />
                    </td>
                    <td className="sticky left-10 z-10 max-w-[16rem] border-t border-border bg-card px-3 py-2 group-hover:bg-accent">
                      <button type="button" onClick={() => setEdit({ id: r.id, level })} className="block max-w-full truncate text-left font-medium hover:text-primary hover:underline" title={r.name}>{r.name}</button>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{STATUS_PT[r.effective_status] ?? r.effective_status}</span>
                        <span className="flex gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                          <button type="button" aria-label="Editar" title="Editar" onClick={() => setEdit({ id: r.id, level })} className="rounded p-1 hover:bg-muted hover:text-primary"><Pencil className="h-3.5 w-3.5" /></button>
                          <button type="button" aria-label="Duplicar" title="Duplicar" disabled={dup.isPending} onClick={() => dup.mutate([r.id])} className="rounded p-1 hover:bg-muted hover:text-primary"><Copy className="h-3.5 w-3.5" /></button>
                          {level === "ads" && <button type="button" aria-label="Prévia" title="Prévia" onClick={() => setReview(r.id)} className="rounded p-1 hover:bg-muted hover:text-primary"><Eye className="h-3.5 w-3.5" /></button>}
                          {level !== "ads" && <button type="button" onClick={() => drill(r)} className="flex items-center rounded px-1 hover:bg-muted hover:text-primary">{level === "campaigns" ? "Conjuntos" : "Anúncios"}<ChevronRight className="h-3.5 w-3.5" /></button>}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap border-t border-border px-3 py-3 group-hover:bg-accent/40">
                      {budget ? (
                        <button
                          className="flex items-center gap-1 hover:text-primary"
                          onClick={() => {
                            const v = prompt(`Novo orçamento ${r.daily_budget ? "diário" : "total"} (${currency})`, String(Number(budget) / 100));
                            if (!v) return;
                            const next = Math.round(Number(v.replace(",", ".")) * 100);
                            if (!(next > 0)) { toast.error("Valor inválido"); return; }
                            if (r.daily_budget) update.mutate({ id: r.id, daily_budget: next, before_budget: Number(r.daily_budget) });
                            else updateObject({ data: { id: r.id, lifetime_budget: next } }).then(() => { toast.success("Atualizado"); qc.invalidateQueries({ queryKey: ["objects"] }); }, (e) => toast.error((e as Error).message));
                          }}
                        >
                          <Pencil className="h-3 w-3" /> {brl(Number(budget) / 100)}
                          <span className="text-xs text-muted-foreground">{r.daily_budget ? "Diário" : "Total"}</span>
                        </button>
                      ) : (
                        <span className="text-muted-foreground">{level === "campaigns" ? "Nos conjuntos" : level === "adsets" ? "Na campanha" : "—"}</span>
                      )}
                    </td>
                    {cols.map((c) => <td key={c.key} className="whitespace-nowrap border-t border-border px-3 py-3 tabular-nums group-hover:bg-accent/40">{formatMetric(c, c.value(i), brl)}</td>)}
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="text-xs font-semibold uppercase">
              <tr>
                <td className="sticky bottom-0 left-0 z-30 border-t border-border bg-muted px-3 py-3" />
                <td className="sticky bottom-0 z-20 border-t border-border bg-muted px-3 py-3" />
                <td className="sticky bottom-0 left-10 z-30 border-t border-border bg-muted px-3 py-3">{rows.length} itens</td>
                <td className="sticky bottom-0 z-20 border-t border-border bg-muted px-3 py-3" />
                {cols.map((c) => <td key={c.key} className="sticky bottom-0 z-20 whitespace-nowrap border-t border-border bg-muted px-3 py-3 tabular-nums">{NO_TOTAL.has(c.key) ? "—" : formatMetric(c, c.value(total), brl)}</td>)}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <AdReviewDialog adId={review} onClose={() => setReview("")} />
      <MetaEditSheet target={edit} onClose={() => setEdit(null)} currency={currency} />
    </div>
  );
}
