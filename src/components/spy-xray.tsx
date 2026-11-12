import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Loader2, ScanSearch } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { spyXray } from "@/lib/spy.functions";
import type { SpyAd } from "@/lib/spy";

type Xray = { gancho: string; dor: string; mecanismo: string; promessa: string; oferta: string; angulos: string[]; modelar: string[] };

/** Runs Crowley's Raio-X over the given ads (longest-running first) and shows hook, pain, mechanism, promise and how to model. */
export function SpyXrayButton({ ads, niche, label = "Raio-X com Crowley", size = "sm", variant = "outline", className = "" }: { ads: SpyAd[]; niche: string; label?: string; size?: "sm" | "default"; variant?: "outline" | "default"; className?: string }) {
  const run = useServerFn(spyXray);
  const [busy, setBusy] = useState(false);
  const [x, setX] = useState<Xray | null>(null);
  const pick = [...ads].sort((a, b) => b.days - a.days).slice(0, 5);
  const go = async () => {
    if (!pick.length) return;
    setBusy(true);
    const r = await run({ data: { niche, ads: pick.map((a) => ({ pageName: a.pageName.slice(0, 200), title: a.title.slice(0, 500), text: a.text.slice(0, 3000), link: a.link.slice(0, 1000), days: a.days, cta: a.cta.slice(0, 100), sameCreative: a.sameCreative })) } }).catch(() => ({ xray: null, error: "Falha ao chamar o Crowley." }));
    setBusy(false);
    if (!r.xray) { toast.error(r.error); return; }
    setX(r.xray);
  };
  const text = x ? `RAIO-X — ${niche}\n\nGancho: ${x.gancho}\nDor: ${x.dor}\nMecanismo único: ${x.mecanismo}\nPromessa: ${x.promessa}\nOferta: ${x.oferta}\n\nÂngulos:\n${x.angulos.map((a) => `- ${a}`).join("\n")}\n\nComo modelar:\n${x.modelar.map((a, i) => `${i + 1}. ${a}`).join("\n")}` : "";
  const Row = ({ t, v }: { t: string; v: string }) => v ? <div className="rounded-md border border-border p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t}</p><p className="mt-1 text-sm">{v}</p></div> : null;
  return <>
    <Button type="button" size={size} variant={variant} className={className} disabled={busy || !pick.length} onClick={() => void go()}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanSearch className="h-3.5 w-3.5" />}{busy ? "Analisando…" : label}</Button>
    <Dialog open={!!x} onOpenChange={(o) => { if (!o) setX(null); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Raio-X do Crowley</DialogTitle><DialogDescription>{pick.length > 1 ? `Baseado nos ${pick.length} anúncios há mais tempo no ar` : "Baseado neste anúncio"}{niche ? ` · ${niche}` : ""}</DialogDescription></DialogHeader>
        {x && <div className="space-y-2">
          <Row t="Gancho" v={x.gancho} /><Row t="Dor principal" v={x.dor} /><Row t="Mecanismo único" v={x.mecanismo} /><Row t="Promessa central" v={x.promessa} /><Row t="Oferta" v={x.oferta} />
          {x.angulos.length > 0 && <div className="rounded-md border border-border p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Ângulos para testar</p><ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{x.angulos.map((a) => <li key={a}>{a}</li>)}</ul></div>}
          {x.modelar.length > 0 && <div className="rounded-md border border-border p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Como modelar</p><ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">{x.modelar.map((a) => <li key={a}>{a}</li>)}</ol></div>}
          <Button className="w-full" onClick={() => { void navigator.clipboard.writeText(text); toast.success("Raio-X copiado"); }}><Copy className="h-4 w-4" />Copiar raio-x</Button>
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}
