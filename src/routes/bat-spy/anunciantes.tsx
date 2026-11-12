import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ExternalLink, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHead, head } from "@/components/ui-kit";
import { useStore, uid } from "@/lib/store";
import { toast } from "sonner";
import { advertisers, DEFAULT_FILTERS, type SpyAd, type SpyFilters, type SpySentinel } from "@/lib/spy";

export const Route = createFileRoute("/bat-spy/anunciantes")({ head: () => head("Bat Spy — Anunciantes", "Ranking de anunciantes por anúncios ativos e tempo no ar."), component: Ads });

function Ads() {
  const [res] = useStore<{ ads: SpyAd[]; at: string; q: string }>("spy-results", { ads: [], at: "", q: "" });
  const [f, setF] = useStore<SpyFilters>("spy-filters", DEFAULT_FILTERS);
  const [watch, setWatch] = useStore<{ pageId: string; pageName: string; pageUrl: string }[]>("spy-watch", []);
  const [sentinels, setSentinels] = useStore<SpySentinel[]>("spy-sentinels", []);
  const [tab, setTab] = useState<"ranking" | "vigiados">("ranking");
  const list = advertisers(res.ads);
  return <div className="space-y-5 p-4 pb-24 sm:p-7">
    <PageHead title="Anunciantes" sub="Quem está escalando na última mineração. Vigie páginas para espionar de novo."><Button asChild variant="outline"><Link to="/bat-spy">Minerar</Link></Button></PageHead>
    <div className="flex gap-2">{(["ranking", "vigiados"] as const).map((t) => <Button key={t} size="sm" variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)}>{t === "ranking" ? `Ranking (${list.length})` : `Vigiados (${watch.length})`}</Button>)}</div>
    {tab === "ranking" ? <div className="divide-y divide-border rounded-lg border border-border bg-card">{list.map((a, i) => <div key={a.pageId || a.pageName} className="flex flex-wrap items-center gap-3 p-3">
      <span className="w-6 text-sm text-muted-foreground">{i + 1}</span>
      {a.avatar ? <img src={a.avatar} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="h-9 w-9 rounded-full bg-muted" />}
      <div className="min-w-0 flex-1"><p className="truncate font-semibold">{a.pageName}</p><p className="text-xs text-muted-foreground">{a.active} ativos · {a.ads} no total · até {a.oldestDays} dias no ar · {a.links.length} página(s) de destino</p></div>
      <Button size="sm" variant="outline" onClick={() => { if (!watch.some((w) => w.pageId === a.pageId)) setWatch([...watch, { pageId: a.pageId, pageName: a.pageName, pageUrl: a.pageUrl }]); }}><Eye className="h-3.5 w-3.5" />Vigiar</Button>
      {a.links[0] && <Button asChild size="sm" variant="ghost"><a href={a.links[0]} target="_blank" rel="noreferrer">Oferta<ExternalLink className="h-3 w-3" /></a></Button>}
    </div>)}{!list.length && <p className="p-8 text-center text-sm text-muted-foreground">Minere primeiro para ver o ranking.</p>}</div>
    : <div className="divide-y divide-border rounded-lg border border-border bg-card">{watch.map((w) => <div key={w.pageId} className="flex items-center gap-3 p-3"><p className="flex-1 font-semibold">{w.pageName}</p>
      <Button size="sm" asChild onClick={() => setF({ ...f, q: "", pageUrl: `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&view_all_page_id=${w.pageId}` })}><Link to="/bat-spy">Espionar de novo</Link></Button>
      <Button size="sm" variant="outline" onClick={() => { setSentinels([...sentinels, { id: uid(), label: w.pageName, q: "", pageUrl: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&view_all_page_id=${w.pageId}`, country: "ALL", minDays: 15, everyHours: 24, whatsapp: "", active: true }]); toast.success("Sentinela ligada para esta página"); }}>Sentinela</Button>
      <Button size="sm" variant="ghost" onClick={() => setWatch(watch.filter((x) => x.pageId !== w.pageId))}>Remover</Button></div>)}{!watch.length && <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma página vigiada.</p>}</div>}
  </div>;
}
