import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Eye, Monitor, Smartphone, X, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHead, head } from "@/components/ui-kit";
import { ForgePreview } from "@/components/forge-preview";
import { ALL_TEMPLATES, templateCode, templateHasAdmin, type TemplateId } from "@/lib/page-templates";
import { fillPlaceholders, loadPages, savePages, type SalesPage } from "@/lib/pages";
import { newStoreKey, storeConnection } from "@/lib/sites";

export const Route = createFileRoute("/sites/modelos")({ head: () => head("Bat Dev V-0 · Modelos prontos", "Sites completos por nicho, prontos para editar no chat e publicar."), component: Templates });

function Templates() {
  const nav = useNavigate();
  const [demo, setDemo] = useState<TemplateId | null>(null);
  const [mobile, setMobile] = useState(true);
  const [brand, setBrand] = useState("");
  const groups = useMemo(() => { const m = new Map<string, typeof ALL_TEMPLATES>(); for (const t of ALL_TEMPLATES) m.set(t.niche, [...(m.get(t.niche) ?? []), t]); return [...m.entries()]; }, []);
  const demoCode = useMemo(() => (demo ? fillPlaceholders(templateCode(demo, brand), { checkoutUrl: "", pixelId: "" }) : ""), [demo, brand]);

  const use = (id: TemplateId) => {
    const t = ALL_TEMPLATES.find((x) => x.id === id)!;
    const code = templateCode(id, brand);
    const name = brand.trim() || t.name;
    const p: SalesPage = { id: crypto.randomUUID(), name, product: brand.trim(), checkoutUrl: "", pixelId: "", versions: [{ at: Date.now(), html: code, note: `Modelo: ${t.name}` }], chat: [{ role: "model", text: `Comecei pelo modelo "${t.name}". Troque os textos entre colchetes pelos seus dados reais — toque no lápis para editar direto na prévia ou me peça mudanças aqui.` }], code, template: id, updatedAt: Date.now(), ...(templateHasAdmin(code) ? { storeKey: newStoreKey(name) } : {}) };
    savePages([p, ...loadPages()]);
    toast.success("Site criado a partir do modelo");
    void nav({ to: "/paginas", search: { site: p.id } });
  };

  return <div className="space-y-5 p-4 pb-28 sm:p-7">
    <PageHead title="Modelos prontos" sub="Sites completos, pensados primeiro para celular. Escolha, veja e comece a editar." />
    <div className="max-w-sm"><Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Nome da marca ou profissional (opcional)" /></div>
    {groups.map(([niche, list]) => <section key={niche} className="space-y-2">
      <h2 className="font-display text-xl tracking-wide">{niche}</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{list.map((t) => <article key={t.id} className="overflow-hidden rounded-xl border border-border bg-card">
        <button type="button" className="block w-full text-left" onClick={() => setDemo(t.id)}><img src={t.image} alt={t.name} loading="lazy" className="aspect-video w-full object-cover" /></button>
        <div className="space-y-2 p-3">
          <div className="flex items-center gap-2"><p className="font-semibold">{t.name}</p>{t.admin && <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary"><ShieldCheck className="h-3 w-3" />com admin</span>}</div>
          <p className="text-xs text-muted-foreground">{t.description}</p>
          <div className="grid grid-cols-2 gap-1.5"><Button size="sm" variant="outline" onClick={() => setDemo(t.id)}><Eye className="h-3.5 w-3.5" />Ver demonstração</Button><Button size="sm" onClick={() => use(t.id)}>Usar este modelo</Button></div>
        </div>
      </article>)}</div>
    </section>)}
    {demo && <div className="fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-label="Demonstração do modelo">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <p className="font-display text-xl">{ALL_TEMPLATES.find((x) => x.id === demo)?.name}</p>
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant={mobile ? "default" : "outline"} onClick={() => setMobile(true)} aria-label="Celular"><Smartphone className="h-4 w-4" /></Button>
          <Button size="sm" variant={mobile ? "outline" : "default"} onClick={() => setMobile(false)} aria-label="Computador"><Monitor className="h-4 w-4" /></Button>
          <Button size="sm" onClick={() => { const d = demo; setDemo(null); use(d); }}>Usar este modelo</Button>
          <Button size="sm" variant="ghost" onClick={() => setDemo(null)} aria-label="Fechar"><X className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 justify-center bg-muted/30 p-2 pb-20 md:pb-2"><div className={`h-full w-full overflow-hidden rounded-lg border border-border ${mobile ? "max-w-[390px]" : ""}`}><ForgePreview code={demoCode} connection={storeConnection(demoCode)} onRepair={() => {}} busy={false} /></div></div>
    </div>}
  </div>;
}
