import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Bookmark, ExternalLink, Flame, Wand2, Radar, Copy, Download, Eye } from "lucide-react";
import { SpyDetail } from "@/components/spy-detail";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useStore, uid } from "@/lib/store";
import { heat, mediaDownload, type SpyAd } from "@/lib/spy";

type Offer = { id: string; name: string; niche: string; status: string; library: string; page: string; creative: string; angle: string; price: string; notes: string };

/** One mined ad with the spy actions: save, send to Radar, model page, ask Crowley. */
export function SpyAdCard({ ad, niche = "", compact = false }: { ad: SpyAd; niche?: string; compact?: boolean }) {
  const nav = useNavigate();
  const [saved, setSaved] = useStore<SpyAd[]>("spy-saved", []);
  const [offers, setOffers] = useStore<Offer[]>("offers", []);
  const isSaved = saved.some((s) => s.id === ad.id);
  const h = heat(ad);
  const [open, setOpen] = useState(false);
  const toRadar = () => { setOffers([...offers, { id: uid(), name: ad.title || ad.pageName, niche, status: "Modelar", library: ad.libraryUrl, page: ad.link, creative: ad.video || ad.image, angle: ad.text.slice(0, 300), price: "", notes: `Minerado no Bat Spy · ${ad.pageName} · ${ad.sameCreative} anúncios · ${ad.days} dias` }]); toast.success("Enviado ao Radar de ofertas"); };
  const media = ad.video || ad.image;
  return <><SpyDetail ad={open ? ad : null} onClose={() => setOpen(false)} onRadar={toRadar} /><article className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
    <div className="flex items-center gap-2 p-3">
      {ad.avatar ? <img src={ad.avatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" /> : <div className="h-8 w-8 shrink-0 rounded-full bg-muted" />}
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{ad.pageName}</p><p className="truncate text-xs text-muted-foreground">{ad.days}d no ar · {ad.active ? "ativo" : "parado"}</p></div>
      <span className={`${compact ? "hidden sm:inline-flex" : "inline-flex"} shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${h === "quente" ? "bg-destructive/15 text-destructive" : h === "validando" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}><Flame className="h-3 w-3" />{h}</span>
    </div>
    {ad.video ? <video src={ad.video} poster={ad.image} controls preload="none" className="aspect-square w-full bg-muted object-cover" /> : ad.image ? <img src={ad.image} alt={ad.title || ad.pageName} loading="lazy" className="aspect-square w-full bg-muted object-cover" /> : <div className="aspect-square w-full bg-muted" />}
    <div className="flex flex-1 flex-col gap-2 p-3">
      <p className="text-xs text-muted-foreground">{ad.sameCreative > 1 ? `${ad.sameCreative} anúncios com este criativo` : "1 anúncio"}{ad.platforms.length ? ` · ${ad.platforms.join(", ").toLowerCase()}` : ""}</p>
      {ad.title && <p className="text-sm font-semibold">{ad.title}</p>}
      <p className={`whitespace-pre-wrap text-sm ${compact ? "line-clamp-3 sm:line-clamp-5" : "line-clamp-5"}`}>{ad.text}</p>
      <div className="mt-auto grid grid-cols-2 gap-1.5 pt-2">
        <Button size="sm" onClick={() => setOpen(true)}><Eye className="h-3.5 w-3.5" />Espionar</Button>
        {media ? <Button asChild size="sm" variant="outline"><a href={mediaDownload(media, `${ad.pageName}-${ad.id}`)} download><Download className="h-3.5 w-3.5" />Baixar</a></Button> : <span />}
      </div>
      <div className={`${compact ? "hidden sm:grid" : "grid"} grid-cols-2 gap-1.5 min-[400px]:grid-cols-3 [&>*]:min-w-0`}>
        <Button size="sm" variant={isSaved ? "default" : "outline"} onClick={() => { setSaved(isSaved ? saved.filter((s) => s.id !== ad.id) : [ad, ...saved]); toast.success(isSaved ? "Removido do swipe file" : "Salvo no swipe file"); }}><Bookmark className="h-3.5 w-3.5" />{isSaved ? "Salvo" : "Salvar"}</Button>
        <Button size="sm" variant="outline" onClick={toRadar}><Radar className="h-3.5 w-3.5" />Radar</Button>
        {ad.link && <Button size="sm" variant="outline" onClick={() => { sessionStorage.setItem("batspy.model", ad.link); void nav({ to: "/paginas" }); }}><Wand2 className="h-3.5 w-3.5" />Modelar</Button>}
        <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(`Crowley, faça um raio-x deste anúncio (gancho, promessa, mecanismo único, oferta e como eu modelo):\n\n${ad.title}\n${ad.text}\nLink: ${ad.link}`); toast.success("Copiado — cole no Crowley"); }}><Copy className="h-3.5 w-3.5" />Raio-X</Button>
        <Button asChild size="sm" variant="ghost"><a href={ad.libraryUrl} target="_blank" rel="noreferrer">Biblioteca<ExternalLink className="h-3 w-3" /></a></Button>
        {ad.link && <Button asChild size="sm" variant="ghost"><a href={ad.link} target="_blank" rel="noreferrer">Página<ExternalLink className="h-3 w-3" /></a></Button>}
      </div>
    </div>
  </article></>;
}
