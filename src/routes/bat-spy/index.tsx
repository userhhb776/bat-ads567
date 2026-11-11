import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHead, Field, NativeSelect, head } from "@/components/ui-kit";
import { SpyAdCard } from "@/components/spy-ad-card";
import { useStore } from "@/lib/store";
import { spySearch } from "@/lib/spy.functions";
import { COUNTRIES, DEFAULT_FILTERS, NICHES, applyMinActive, heat, type SpyAd, type SpyFilters } from "@/lib/spy";

export const Route = createFileRoute("/bat-spy/")({ head: () => head("Bat Spy — Minerador", "Minere anúncios da biblioteca por país, nicho, mídia e quantidade de anúncios ativos."), component: Spy });

function Spy() {
  const run = useServerFn(spySearch);
  const [f, setF] = useStore<SpyFilters>("spy-filters", DEFAULT_FILTERS);
  const [res, setRes] = useStore<{ ads: SpyAd[]; at: string; q: string }>("spy-results", { ads: [], at: "", q: "" });
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState("escala");
  const [hot, setHot] = useState("todos");
  const [text, setText] = useState("");
  const set = <K extends keyof SpyFilters>(k: K, v: SpyFilters[K]) => setF({ ...f, [k]: v });
  const go = async () => {
    setBusy(true);
    const r = await run({ data: f }).catch(() => ({ ads: [], error: "Falha ao minerar.", slot: "" }));
    setBusy(false);
    if (r.error && !r.ads.length) { toast.error(r.error); return; }
    setRes({ ads: r.ads, at: new Date().toISOString(), q: f.q || f.pageUrl });
    toast.success(`${r.ads.length} anúncios minerados`);
  };
  const shown = useMemo(() => {
    let a = applyMinActive(res.ads, f.minActive);
    if (hot !== "todos") a = a.filter((x) => heat(x) === hot);
    if (text.trim()) a = a.filter((x) => `${x.text} ${x.title} ${x.pageName} ${x.link}`.toLowerCase().includes(text.toLowerCase()));
    return [...a].sort((x, y) => sort === "dias" ? y.days - x.days : sort === "recentes" ? x.days - y.days : y.sameCreative - x.sameCreative);
  }, [res.ads, f.minActive, hot, text, sort]);
  return <div className="space-y-5 p-4 pb-24 sm:p-7">
    <PageHead title="Bat Spy" sub="Minerador da biblioteca de anúncios — ache ofertas escalando e modele."><Button asChild variant="outline"><Link to="/bat-spy/anunciantes">Anunciantes</Link></Button></PageHead>
    <form className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-4" onSubmit={(e) => { e.preventDefault(); void go(); }}>
      <div className="md:col-span-2"><Field label="Termo, nicho ou promessa"><Input value={f.q} onChange={(e) => set("q", e.target.value)} placeholder="ex.: emagrecer, renda extra" list="spy-niches" /></Field><datalist id="spy-niches">{NICHES.map((n) => <option key={n} value={n} />)}</datalist></div>
      <Field label="País"><NativeSelect value={f.country} onChange={(e) => set("country", e.target.value)}>{COUNTRIES.map(([c, l]) => <option key={c} value={c}>{l}</option>)}</NativeSelect></Field>
      <Field label="Mínimo de anúncios ativos"><NativeSelect value={String(f.minActive)} onChange={(e) => set("minActive", Number(e.target.value))}>{[0, 3, 5, 10, 20, 30, 50, 100].map((n) => <option key={n} value={n}>{n ? `${n}+ anúncios` : "Qualquer"}</option>)}</NativeSelect></Field>
      <Field label="Mídia"><NativeSelect value={f.media} onChange={(e) => set("media", e.target.value as SpyFilters["media"])}><option value="all">Todas</option><option value="video">Vídeo</option><option value="image">Imagem</option></NativeSelect></Field>
      <Field label="Status"><NativeSelect value={f.status} onChange={(e) => set("status", e.target.value as SpyFilters["status"])}><option value="active">Só ativos</option><option value="all">Ativos e parados</option></NativeSelect></Field>
      <Field label="Rodando desde"><Input type="date" value={f.since} onChange={(e) => set("since", e.target.value)} /></Field>
      <Field label="Idioma"><NativeSelect value={f.lang} onChange={(e) => set("lang", e.target.value)}><option value="">Qualquer</option><option value="pt">Português</option><option value="en">Inglês</option><option value="es">Espanhol</option></NativeSelect></Field>
      <div className="md:col-span-3"><Field label="Ou espione uma página / link da biblioteca"><Input value={f.pageUrl} onChange={(e) => set("pageUrl", e.target.value)} placeholder="https://www.facebook.com/ads/library/?... ou link da página" inputMode="url" /></Field></div>
      <Field label="Quantidade"><NativeSelect value={String(f.limit)} onChange={(e) => set("limit", Number(e.target.value))}>{[20, 50, 100, 200, 300].map((n) => <option key={n} value={n}>{n} anúncios</option>)}</NativeSelect></Field>
      <div className="flex items-end gap-2 md:col-span-4"><Button disabled={busy} className="w-full md:w-auto">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{busy ? "Minerando (até 4 min)…" : "Minerar"}</Button><p className="text-xs text-muted-foreground">Cada busca gasta crédito da Apify. Os filtros abaixo não gastam.</p></div>
    </form>
    {res.ads.length > 0 && <div className="flex flex-wrap items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-muted-foreground" /><Input aria-label="Filtrar resultados" className="sm:w-64" placeholder="Filtrar texto, página, domínio" value={text} onChange={(e) => setText(e.target.value)} /><NativeSelect aria-label="Ordenar" value={sort} onChange={(e) => setSort(e.target.value)}><option value="escala">Mais escalados</option><option value="dias">Mais tempo no ar</option><option value="recentes">Mais recentes</option></NativeSelect><NativeSelect aria-label="Temperatura" value={hot} onChange={(e) => setHot(e.target.value)}><option value="todos">Todos</option><option value="quente">Quentes</option><option value="validando">Validando</option><option value="novo">Novos</option></NativeSelect><span className="text-xs text-muted-foreground">{shown.length} de {res.ads.length} · busca “{res.q}”</span></div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{shown.map((a) => <SpyAdCard key={a.id} ad={a} niche={f.q} />)}</div>
    {!res.ads.length && !busy && <p className="border-y border-border py-10 text-center text-sm text-muted-foreground">Escolha os filtros e toque em Minerar.</p>}
  </div>;
}
