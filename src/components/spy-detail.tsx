import { useNavigate } from "@tanstack/react-router";
import { Download, ExternalLink, Flame, Radar, Wand2, Copy, CalendarDays, Layers, Globe } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { heat, mediaDownload, type SpyAd } from "@/lib/spy";

/** Full "Espionar" view of a mined ad: big creative, download, timing, scale, copy and destination. */
export function SpyDetail({ ad, onClose, onRadar }: { ad: SpyAd | null; onClose: () => void; onRadar: (a: SpyAd) => void }) {
  const nav = useNavigate();
  if (!ad) return null;
  const media = ad.video || ad.image;
  const fname = `${ad.pageName}-${ad.id}`;
  const start = ad.start ? new Date(ad.start).toLocaleDateString("pt-BR") : "—";
  const Info = ({ icon: I, label, value }: { icon: typeof Flame; label: string; value: string }) => <div className="rounded-md border border-border p-3"><p className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground"><I className="h-3 w-3" />{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>;
  return <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
    <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
      <DialogHeader><DialogTitle className="flex items-center gap-2">{ad.avatar && <img src={ad.avatar} alt="" className="h-8 w-8 rounded-full" />}{ad.pageName}</DialogTitle><DialogDescription>{ad.active ? "Anúncio ativo" : "Anúncio parado"} · {ad.days} dias no ar</DialogDescription></DialogHeader>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          {ad.video ? <video src={ad.video} poster={ad.image} controls playsInline className="w-full rounded-md bg-muted" /> : ad.image ? <img src={ad.image} alt={ad.title || ad.pageName} className="w-full rounded-md bg-muted" /> : <div className="aspect-square rounded-md bg-muted" />}
          {media && <Button asChild className="w-full"><a href={mediaDownload(media, fname)} download><Download className="h-4 w-4" />Baixar {ad.video ? "vídeo" : "imagem"}</a></Button>}
          {ad.video && ad.image && <Button asChild variant="outline" className="w-full"><a href={mediaDownload(ad.image, `${fname}-capa`)} download><Download className="h-4 w-4" />Baixar capa</a></Button>}
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Info icon={CalendarDays} label="Tempo ativo" value={`${ad.days} dias`} />
            <Info icon={CalendarDays} label="Começou em" value={start} />
            <Info icon={Layers} label="Anúncios com este criativo" value={String(ad.sameCreative)} />
            <Info icon={Flame} label="Temperatura" value={heat(ad)} />
          </div>
          {ad.platforms.length > 0 && <p className="flex items-center gap-1 text-xs text-muted-foreground"><Globe className="h-3 w-3" />{ad.platforms.join(", ").toLowerCase()}</p>}
          {ad.title && <p className="font-semibold">{ad.title}</p>}
          <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">{ad.text || "Sem texto."}</p>
          {ad.cta && <p className="text-xs text-muted-foreground">Botão: <b>{ad.cta}</b></p>}
          {ad.link && <p className="break-all text-xs">Destino: <a className="text-primary underline" href={ad.link} target="_blank" rel="noreferrer">{ad.link}</a></p>}
          <div className="flex flex-wrap gap-2 pt-1">
            {ad.link && <Button size="sm" onClick={() => { sessionStorage.setItem("batspy.model", ad.link); void nav({ to: "/paginas" }); }}><Wand2 className="h-3.5 w-3.5" />Modelar página</Button>}
            <Button size="sm" variant="outline" onClick={() => onRadar(ad)}><Radar className="h-3.5 w-3.5" />Radar</Button>
            <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(`Crowley, faça um raio-x deste anúncio (gancho, promessa, mecanismo único, oferta e como eu modelo):\n\n${ad.title}\n${ad.text}\nLink: ${ad.link}`); toast.success("Copiado — cole no Crowley"); }}><Copy className="h-3.5 w-3.5" />Raio-X</Button>
            <Button asChild size="sm" variant="ghost"><a href={ad.libraryUrl} target="_blank" rel="noreferrer">Biblioteca<ExternalLink className="h-3 w-3" /></a></Button>
            {ad.pageUrl && <Button asChild size="sm" variant="ghost"><a href={ad.pageUrl} target="_blank" rel="noreferrer">Perfil<ExternalLink className="h-3 w-3" /></a></Button>}
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}
