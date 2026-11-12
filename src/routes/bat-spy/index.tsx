import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search, SlidersHorizontal, Rows3, LayoutGrid, ChevronsDown, BellRing, ShieldOff, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHead, Field, NativeSelect, head } from "@/components/ui-kit";
import { SpyAdCard } from "@/components/spy-ad-card";
import { SpyXrayButton } from "@/components/spy-xray";
import { useStore, uid } from "@/lib/store";
import { spySearch, spyTech } from "@/lib/spy.functions";
import { COUNTRIES, DEFAULT_FILTERS, NICHES, MIN_DAYS, FORMATS, SCALES, CHECKOUTS, MAX_PER_SEARCH, applyMinDays, applyMinActive, applyScale, checkoutFromUrl, formatOf, heat, isBigBrand, mergeAds, reachedEnd, type SpyAd, type SpyFilters, type SpySentinel } from "@/lib/spy";

export const Route = createFileRoute("/bat-spy/")({ head: () => head("Bat Spy — Minerador", "Minere anúncios da biblioteca por país, nicho, mídia, plataforma e escala do anunciante."), component: Spy });

type Results = { ads: SpyAd[]; at: string; q: string; asked?: number; end?: boolean; f?: SpyFilters };

function Spy() {
  const run = useServerFn(spySearch);
  const techFn = useServerFn(spyTech);
  const [f, setF] = useStore<SpyFilters>("spy-filters", DEFAULT_FILTERS);
  const [res, setRes] = useStore<Results>("spy-results", { ads: [], at: "", q: "" });
  const [tech, setTech] = useStore<Record<string, string>>("spy-tech", {});
  const [sentinels, setSentinels] = useStore<SpySentinel[]>("spy-sentinels", []);
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);
  const [techBusy, setTechBusy] = useState(false);
  const [sort, setSort] = useState("escala");
  const [hot, setHot] = useState("todos");
  const [text, setText] = useState("");
  const [compact, setCompact] = useState(false);
  const set = <K extends keyof SpyFilters>(k: K, v: SpyFilters[K]) => setF({ ...f, [k]: v });
  const platformOf = (a: SpyAd) => checkoutFromUrl(a.link) || tech[a.link] || "";

  /** Reads landing pages (no Apify credit) to tag the checkout platform of each offer. */
  const detect = async (ads: SpyAd[]) => {
    const urls = [...new Set(ads.map((a) => a.link).filter((l) => /^https?:\/\//.test(l) && !checkoutFromUrl(l) && !(l in tech)))].slice(0, 40);
    if (!urls.length) return;
    setTechBusy(true);
    const found = await techFn({ data: { urls } }).catch(() => ({} as Record<string, string>));
    setTechBusy(false);
    setTech((prev) => Object.fromEntries(Object.entries({ ...prev, ...found }).slice(-600)));
  };

  const go = async () => {
    setBusy(true);
    setRes({ ads: [], at: "", q: "" });
    const used = { ...f, since: "", minDays: f.minDays ?? 0 };
    const r = await run({ data: used }).catch(() => ({ ads: [], error: "Falha ao minerar.", slot: "" }));
    setBusy(false);
    if (r.error && !r.ads.length) { toast.error(r.error); return; }
    const { ads } = mergeAds([], r.ads);
    setRes({ ads, at: new Date().toISOString(), q: f.q || f.pageUrl, asked: f.limit, end: reachedEnd(f.limit, r.ads.length, ads.length), f: used });
    toast.success(`${ads.length} anúncios minerados`);
    setTimeout(() => document.getElementById("spy-feed")?.scrollIntoView({ behavior: "smooth" }), 100);
    void detect(ads);
  };

  /** Next batch of the same search: asks for more, keeps the ones already loaded, stops when the library runs out. */
  const loadMore = async () => {
    const base = res.f ?? { ...f, since: "", minDays: f.minDays ?? 0 };
    const asked = Math.min(MAX_PER_SEARCH, (res.asked ?? res.ads.length) + f.limit);
    setMore(true);
    const r = await run({ data: { ...base, limit: asked } }).catch(() => ({ ads: [], error: "Falha ao minerar.", slot: "" }));
    setMore(false);
    if (r.error && !r.ads.length) { toast.error(r.error); return; }
    const m = mergeAds(res.ads, r.ads);
    const end = reachedEnd(asked, r.ads.length, m.added);
    setRes({ ...res, ads: m.ads, asked, end });
    toast.success(m.added ? `+${m.added} anúncios novos` : "Nenhum anúncio novo — fim da lista");
    void detect(m.ads.slice(-m.added));
  };

  const addSentinel = () => {
    const base = res.f ?? f;
    setSentinels([...sentinels, { id: uid(), label: res.q || "Busca", q: base.q, pageUrl: base.pageUrl, country: base.country, minDays: Math.max(base.minDays ?? 0, 15), everyHours: 24, whatsapp: "", active: true }]);
    toast.success("Sentinela criada — ajuste em Bat Spy → Sentinela");
  };

  const shown = useMemo(() => {
    let a = applyScale(applyMinDays(applyMinActive(res.ads, f.minActive), f.minDays ?? 0), f.scale);
    if (f.noBrands) a = a.filter((x) => !isBigBrand(x));
    if (f.format && f.format !== "todos") a = a.filter((x) => formatOf(x) === f.format);
    if (f.checkout && f.checkout !== "todos") a = a.filter((x) => platformOf(x) === f.checkout);
    if (hot !== "todos") a = a.filter((x) => heat(x) === hot);
    if (text.trim()) a = a.filter((x) => `${x.text} ${x.title} ${x.pageName} ${x.link}`.toLowerCase().includes(text.toLowerCase()));
    return [...a].sort((x, y) => sort === "dias" ? y.days - x.days : sort === "recentes" ? x.days - y.days : y.sameCreative - x.sameCreative);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res.ads, f.minActive, f.minDays, f.scale, f.noBrands, f.format, f.checkout, hot, text, sort, tech]);

  return <div className="space-y-5 p-4 pb-32 sm:p-7">
    <PageHead title="Bat Spy" sub="Minerador da biblioteca de anúncios — ache ofertas escalando e modele."><Button asChild variant="outline"><Link to="/bat-spy/sentinela"><BellRing className="h-4 w-4" />Sentinela</Link></Button><Button asChild variant="outline"><Link to="/bat-spy/anunciantes">Anunciantes</Link></Button></PageHead>
    <form className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-4" onSubmit={(e) => { e.preventDefault(); void go(); }}>
      <div className="md:col-span-2"><Field label="Termo, nicho ou promessa"><Input value={f.q} onChange={(e) => set("q", e.target.value)} placeholder="ex.: emagrecer, renda extra" list="spy-niches" /></Field><datalist id="spy-niches">{NICHES.map((n) => <option key={n} value={n} />)}</datalist></div>
      <Field label="País"><NativeSelect value={f.country} onChange={(e) => set("country", e.target.value)}>{COUNTRIES.map(([c, l]) => <option key={c} value={c}>{l}</option>)}</NativeSelect></Field>
      <Field label="Mínimo de anúncios ativos"><NativeSelect value={String(f.minActive)} onChange={(e) => set("minActive", Number(e.target.value))}>{[0, 3, 5, 10, 20, 30, 50, 100].map((n) => <option key={n} value={n}>{n ? `${n}+ anúncios` : "Qualquer"}</option>)}</NativeSelect></Field>
      <Field label="Mídia"><NativeSelect value={f.media} onChange={(e) => set("media", e.target.value as SpyFilters["media"])}><option value="all">Todas</option><option value="video">Vídeo</option><option value="image">Imagem</option></NativeSelect></Field>
      <Field label="Status"><NativeSelect value={f.status} onChange={(e) => set("status", e.target.value as SpyFilters["status"])}><option value="active">Só ativos</option><option value="all">Ativos e parados</option></NativeSelect></Field>
      <Field label="Tempo ativo"><NativeSelect value={String(f.minDays ?? 0)} onChange={(e) => set("minDays", Number(e.target.value))}>{MIN_DAYS.map((n) => <option key={n} value={n}>{n ? `No mínimo ${n} dias` : "Qualquer tempo"}</option>)}</NativeSelect></Field>
      <Field label="Idioma"><NativeSelect value={f.lang} onChange={(e) => set("lang", e.target.value)}><option value="">Qualquer</option><option value="pt">Português</option><option value="en">Inglês</option><option value="es">Espanhol</option></NativeSelect></Field>
      <div className="md:col-span-3"><Field label="Ou espione uma página / link da biblioteca"><Input value={f.pageUrl} onChange={(e) => set("pageUrl", e.target.value)} placeholder="https://www.facebook.com/ads/library/?... ou link da página" inputMode="url" /></Field></div>
      <Field label="Lote por busca"><NativeSelect value={String(f.limit)} onChange={(e) => set("limit", Number(e.target.value))}>{[20, 50, 100, 200, 300].map((n) => <option key={n} value={n}>{n} anúncios por vez</option>)}</NativeSelect></Field>
      <div className="flex items-end gap-2 md:col-span-4"><Button disabled={busy} className="w-full md:w-auto">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{busy ? "Minerando (até 4 min)…" : "Minerar"}</Button><p className="text-xs text-muted-foreground">Cada busca gasta crédito da Apify. Os filtros abaixo não gastam.</p></div>
    </form>
    {res.ads.length > 0 && <div className="space-y-2 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-muted-foreground" /><Input aria-label="Filtrar resultados" className="sm:w-64" placeholder="Filtrar texto, página, domínio" value={text} onChange={(e) => setText(e.target.value)} /><NativeSelect aria-label="Ordenar" value={sort} onChange={(e) => setSort(e.target.value)}><option value="escala">Mais escalados</option><option value="dias">Mais tempo no ar</option><option value="recentes">Mais recentes</option></NativeSelect><NativeSelect aria-label="Temperatura" value={hot} onChange={(e) => setHot(e.target.value)}><option value="todos">Todos</option><option value="quente">Quentes</option><option value="validando">Validando</option><option value="novo">Novos</option></NativeSelect><span className="text-xs text-muted-foreground">{shown.length} de {res.ads.length} · busca “{res.q}”</span><div className="ml-auto flex gap-1 sm:hidden"><Button type="button" size="icon" variant={compact ? "outline" : "default"} aria-label="1 coluna" onClick={() => setCompact(false)}><Rows3 className="h-4 w-4" /></Button><Button type="button" size="icon" variant={compact ? "default" : "outline"} aria-label="2 colunas" onClick={() => setCompact(true)}><LayoutGrid className="h-4 w-4" /></Button></div></div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <NativeSelect aria-label="Formato" value={f.format ?? "todos"} onChange={(e) => set("format", e.target.value)}>{FORMATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</NativeSelect>
        <NativeSelect aria-label="Plataforma de checkout" value={f.checkout ?? "todos"} onChange={(e) => set("checkout", e.target.value)}><option value="todos">Qualquer plataforma</option>{CHECKOUTS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}<option value="whatsapp">WhatsApp</option><option value="proprio">Site próprio</option></NativeSelect>
        <NativeSelect aria-label="Escala do anunciante" value={f.scale ?? "todos"} onChange={(e) => set("scale", e.target.value)}>{SCALES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</NativeSelect>
        <Button type="button" size="sm" variant={f.noBrands ? "default" : "outline"} onClick={() => set("noBrands", !f.noBrands)}><ShieldOff className="h-3.5 w-3.5" />Sem grandes marcas</Button>
        {techBusy && <span className="col-span-2 flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Verificando plataformas das páginas…</span>}
      </div>
      <div className="flex flex-wrap gap-2 border-t border-border pt-2"><SpyXrayButton ads={shown} niche={res.q} label="Raio-X da busca (5 mais antigos)" /><Button type="button" size="sm" variant="outline" onClick={addSentinel}><BellRing className="h-3.5 w-3.5" />Vigiar esta busca</Button></div>
    </div>}
    {res.ads.length > 0 && shown.length < res.ads.length && <p className="rounded-md border border-border bg-muted/40 p-3 text-sm">{res.ads.length - shown.length} anúncios escondidos pelos filtros. <button className="font-semibold text-primary underline" onClick={() => { setF({ ...f, minActive: 0, minDays: 0, scale: "todos", format: "todos", checkout: "todos", noBrands: false }); setHot("todos"); setText(""); }}>Mostrar todos</button></p>}
    <div id="spy-feed" className={`grid scroll-mt-20 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4 ${compact ? "grid-cols-2" : "grid-cols-1"}`}>{shown.map((a) => <SpyAdCard key={a.id} ad={a} niche={f.q} compact={compact} platform={platformOf(a)} />)}</div>
    {res.ads.length > 0 && (res.end
      ? <p className="flex items-center justify-center gap-2 rounded-lg border border-border bg-muted/40 p-4 text-center text-sm"><CheckCircle2 className="h-4 w-4 text-primary" />Fim da lista: {(res.asked ?? 0) >= MAX_PER_SEARCH ? `limite de ${MAX_PER_SEARCH} anúncios por busca atingido` : "todos os anúncios compatíveis foram minerados"} ({res.ads.length}).</p>
      : <div className="flex flex-col items-center gap-1 py-2"><Button type="button" size="lg" disabled={more || busy} onClick={() => void loadMore()} className="w-full sm:w-auto">{more ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronsDown className="h-4 w-4" />}{more ? "Minerando mais…" : `Minerar mais ${f.limit}`}</Button><p className="text-center text-xs text-muted-foreground">Mantém os {res.ads.length} já carregados e junta só os novos. Gasta crédito da Apify.</p></div>)}
    {!res.ads.length && !busy && <p className="border-y border-border py-10 text-center text-sm text-muted-foreground">Escolha os filtros e toque em Minerar.</p>}
  </div>;
}
