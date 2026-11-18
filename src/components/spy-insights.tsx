import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Activity, BarChart3, ExternalLink, Loader2, RefreshCw, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { spyPageCount, spyTraffic, spyTrends } from "@/lib/spy.functions";
import { checkoutFromUrl, checkoutLabel, type SpyAd } from "@/lib/spy";
import { pace, trend, type PageStats, type Snap } from "@/lib/spy-trend";
import { domainOf, fmtVisits, type Traffic } from "@/lib/spy-traffic";

const fmtDay = (d: string) => d.slice(8, 10) + "/" + d.slice(5, 7);
const signed = (n: number) => `${n > 0 ? "+" : ""}${n}%`;

/** Small chips on the feed card: launch rhythm (first search) and active-ad change (history). */
export function TrendBadges({ stats, snaps }: { stats?: PageStats | undefined; snaps?: Snap[] | undefined }) {
  const p = pace(stats);
  const t = snaps ? trend(snaps) : null;
  if (!p && (!t || t.kind === "sem-historico")) return null;
  const d = t?.d30 ?? t?.d3 ?? t?.d1;
  return <div className="flex flex-wrap gap-1">
    {p && <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.kind === "acelerando" ? "bg-primary/15 text-primary" : p.kind === "desacelerando" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}>{p.kind === "acelerando" ? <TrendingUp className="h-3 w-3" /> : p.kind === "desacelerando" ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}{p.label}</span>}
    {t && d && t.kind !== "sem-historico" && <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${t.kind === "subindo" ? "bg-primary/15 text-primary" : t.kind === "descendo" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}><Activity className="h-3 w-3" />{d.from} → {d.to} ativos ({signed(d.pct)})</span>}
  </div>;
}

/** "Espionar" extras: day-by-day active ads of the page, exact recount and website traffic. */
export function SpyInsights({ ad, stats }: { ad: SpyAd; stats?: PageStats | undefined }) {
  const trendsFn = useServerFn(spyTrends), countFn = useServerFn(spyPageCount), trafficFn = useServerFn(spyTraffic);
  const key = ad.pageId || ad.pageName;
  const [snaps, setSnaps] = useState<Snap[] | null>(null);
  const [counting, setCounting] = useState(false);
  const [traffic, setTraffic] = useState<{ t: Traffic | null; at: string; source: string } | null>(null);
  const [tBusy, setTBusy] = useState(false);
  const domain = domainOf(ad.link);
  const viaPlatform = checkoutFromUrl(ad.link);
  const load = () => trendsFn({ data: { pageIds: [key] } }).then((r) => setSnaps(r[key] ?? [])).catch(() => setSnaps([]));
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [key]);
  const t = snaps ? trend(snaps) : null;
  const p = pace(stats);
  const max = Math.max(1, ...(t?.series ?? []).map((s) => s.active));

  const count = async () => {
    if (!/^\d{3,30}$/.test(ad.pageId)) { toast.error("Essa página não tem identificação pública para contar."); return; }
    setCounting(true);
    const r = await countFn({ data: { pageId: ad.pageId, pageName: ad.pageName } }).catch(() => ({ active: 0, capped: false, error: "Falha ao contar." }));
    setCounting(false);
    if (r.error) { toast.error(r.error); return; }
    toast.success(`${r.active}${r.capped ? "+" : ""} anúncios ativos agora`);
    void load();
  };
  const analyze = async (refresh = false) => {
    if (!domain) return;
    setTBusy(true);
    const r = await trafficFn({ data: { domain, refresh } }).catch(() => ({ traffic: null, source: "", at: "", error: "Falha ao consultar o tráfego." }));
    setTBusy(false);
    if (r.error) toast.error(r.error);
    if (r.traffic || !r.error) setTraffic({ t: r.traffic, at: r.at, source: r.source });
  };

  const Delta = ({ label, d }: { label: string; d: { from: number; to: number; pct: number } | null }) => d ? <div className="rounded-md border border-border p-2"><p className="text-[11px] text-muted-foreground">{label}</p><p className={`text-sm font-semibold ${d.pct > 0 ? "text-primary" : d.pct < 0 ? "text-destructive" : ""}`}>{d.from} → {d.to} ({signed(d.pct)})</p></div> : null;

  return <div className="space-y-4 border-t border-border pt-4">
    <section className="space-y-2">
      <div className="flex flex-wrap items-center gap-2"><Activity className="h-4 w-4 text-primary" /><p className="font-semibold">Ritmo de anúncios da página</p>
        <Button size="sm" variant="outline" className="ml-auto" disabled={counting} onClick={() => void count()}>{counting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}{counting ? "Contando (até 4 min)…" : "Contar ativos agora"}</Button></div>
      {p && <p className="text-sm">{p.label}{stats ? ` · ${stats.active} ativos nesta busca` : ""}</p>}
      {!snaps ? <p className="text-xs text-muted-foreground">Carregando histórico…</p> : t && t.series.length >= 2 ? <>
        <div className="grid grid-cols-3 gap-2"><Delta label="Desde a véspera" d={t.d1} /><Delta label="3 dias" d={t.d3} /><Delta label="30 dias" d={t.d30} /></div>
        <div className="flex h-24 items-end gap-1 rounded-md border border-border p-2" aria-label="Anúncios ativos por dia">
          {t.series.map((s) => <div key={s.day} className="flex min-w-0 flex-1 flex-col items-center gap-1"><span className="text-[9px] text-muted-foreground">{s.active}</span><div className={`w-full rounded-sm ${s.exact ? "bg-primary" : "bg-primary/40"}`} style={{ height: `${Math.max(4, (s.active / max) * 56)}px` }} /><span className="text-[9px] text-muted-foreground">{fmtDay(s.day)}</span></div>)}
        </div>
        <p className="text-[11px] text-muted-foreground">{t.exact ? "Contagens exatas da página." : "Barras claras = ativos vistos nas buscas do dia. Toque em “Contar ativos agora” para a contagem exata."}</p>
      </> : <p className="text-xs text-muted-foreground">{snaps.length === 1 ? `Hoje: ${snaps[0]!.active} ativos. ` : ""}O histórico vai se formando sozinho a cada busca (ou contagem) desta página — amanhã já aparece se subiu ou desceu.</p>}
    </section>

    <section className="space-y-2">
      <div className="flex flex-wrap items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /><p className="font-semibold">Tráfego do site</p>{domain && <span className="text-xs text-muted-foreground">{domain}</span>}
        {domain && <Button size="sm" className="ml-auto" disabled={tBusy} onClick={() => void analyze(!!traffic)}>{tBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BarChart3 className="h-3.5 w-3.5" />}{traffic ? "Atualizar" : "Analisar tráfego"}</Button>}</div>
      {!domain ? <p className="text-xs text-muted-foreground">O anúncio não leva para um site.</p> : <>
        {viaPlatform && <p className="text-xs text-muted-foreground">O link vai direto para {checkoutLabel(viaPlatform) || "uma plataforma"}: o tráfego mostrado é da plataforma inteira, não só da oferta.</p>}
        {traffic && (traffic.t?.available ? <TrafficView t={traffic.t} at={traffic.at} /> : <p className="rounded-md bg-muted/50 p-2 text-sm">Sem dados de tráfego para esse site — normalmente é site novo ou com poucas visitas (menos de ~5 mil por mês).</p>)}
        <a className="inline-flex items-center gap-1 text-xs text-primary underline" href={`https://www.similarweb.com/website/${domain}/`} target="_blank" rel="noreferrer">Ver página pública do site no Similarweb<ExternalLink className="h-3 w-3" /></a>
      </>}
    </section>
  </div>;
}

function TrafficView({ t, at }: { t: Traffic; at: string }) {
  const max = Math.max(1, ...t.history.map((h) => h.visits));
  const mins = t.timeOnSite !== null ? `${Math.floor(t.timeOnSite / 60)}m${String(t.timeOnSite % 60).padStart(2, "0")}s` : "—";
  const Box = ({ l, v }: { l: string; v: string }) => <div className="rounded-md border border-border p-2"><p className="text-[11px] text-muted-foreground">{l}</p><p className="text-sm font-semibold">{v}</p></div>;
  return <div className="space-y-2">
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <Box l={`Visitas/mês${t.month ? ` (${t.month.slice(5, 7)}/${t.month.slice(0, 4)})` : ""}`} v={fmtVisits(t.visits)} />
      <Box l="Mês anterior" v={t.changePct !== null ? `${signed(t.changePct)}` : "—"} />
      <Box l="Rejeição" v={t.bounce !== null ? `${t.bounce}%` : "—"} />
      <Box l="Páginas por visita" v={t.pagesPerVisit !== null ? String(t.pagesPerVisit).replace(".", ",") : "—"} />
      <Box l="Tempo no site" v={mins} />
      <Box l="Ranking no país" v={t.countryRank ? `#${t.countryRank.toLocaleString("pt-BR")} ${t.countryCode}` : "—"} />
    </div>
    {t.history.length > 1 && <div className="flex h-20 items-end gap-2 rounded-md border border-border p-2">{t.history.map((h) => <div key={h.month} className="flex flex-1 flex-col items-center gap-1"><span className="text-[9px] text-muted-foreground">{fmtVisits(h.visits)}</span><div className="w-full rounded-sm bg-primary/70" style={{ height: `${Math.max(4, (h.visits / max) * 44)}px` }} /><span className="text-[9px] text-muted-foreground">{h.month.slice(5, 7)}/{h.month.slice(2, 4)}</span></div>)}</div>}
    {t.countries.length > 0 && <p className="text-xs"><b>Países:</b> {t.countries.map((c) => `${c.name} ${String(c.pct).replace(".", ",")}%`).join(" · ")}</p>}
    {t.sources.length > 0 && <p className="text-xs"><b>De onde vem:</b> {t.sources.map((s) => `${s.label} ${String(s.pct).replace(".", ",")}%`).join(" · ")}</p>}
    <p className="text-[11px] text-muted-foreground">Estimativa mensal de mercado, não os números internos do site.{at ? ` Consultado em ${new Date(at).toLocaleDateString("pt-BR")}.` : ""}</p>
  </div>;
}
