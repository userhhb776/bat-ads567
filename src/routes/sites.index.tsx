import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, Download, ExternalLink, Globe, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Empty, PageHead, head } from "@/components/ui-kit";
import { fillPlaceholders, loadPages, savePages, type SalesPage } from "@/lib/pages";
import { downloadZip } from "@/lib/forge";
import { ALL_TEMPLATES } from "@/lib/page-templates";
import { newStoreKey, storeConnection } from "@/lib/sites";

export const Route = createFileRoute("/sites/")({ head: () => head("Bat Dev V-0 · Meus sites", "Todos os sites e páginas criados: editar, duplicar, baixar e ver publicação."), component: MySites });

const when = (t?: number) => (t ? new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

function MySites() {
  const [pages, setPages] = useState<SalesPage[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => { setPages(loadPages()); }, []);
  const save = (next: SalesPage[]) => { setPages(next); savePages(next); };
  const duplicate = (p: SalesPage) => {
    const copy: SalesPage = { ...p, id: crypto.randomUUID(), name: `${p.name} (cópia)`, slug: "", publishedUrl: undefined, adminUrl: undefined, domains: [], storeKey: p.storeKey ? newStoreKey(p.name) : undefined, updatedAt: Date.now(), versions: p.versions.slice(0, 3) };
    save([copy, ...pages]); toast.success("Cópia criada — o endereço e a publicação ficam livres para a nova versão.");
  };
  const remove = (p: SalesPage) => { if (!confirm(`Apagar "${p.name}"? O site publicado continua no ar até você removê-lo da hospedagem.`)) return; save(pages.filter((x) => x.id !== p.id)); toast.success("Apagado do painel"); };
  const zip = (p: SalesPage) => { if (!p.code) { toast.error("Esse site ainda não tem código."); return; } void downloadZip(fillPlaceholders(p.code, p), storeConnection(p.code)); };
  const list = [...pages].filter((p) => !q.trim() || `${p.name} ${p.product} ${p.publishedUrl ?? ""}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

  return <div className="space-y-4 p-4 pb-28 sm:p-7">
    <PageHead title="Meus sites" sub="Tudo o que você criou no Bat Dev V-0."><Button asChild><Link to="/sites/modelos"><Plus className="h-4 w-4" />Novo a partir de modelo</Link></Button><Button asChild variant="outline"><Link to="/paginas">Abrir estúdio</Link></Button></PageHead>
    {pages.length > 3 && <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar site" className="sm:max-w-xs" />}
    {!list.length ? <Empty>{pages.length ? "Nenhum site com esse nome." : <span>Nenhum site ainda. <Link className="text-primary underline" to="/sites/modelos">Escolha um modelo</Link> ou crie no estúdio.</span>}</Empty> :
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{list.map((p) => {
        const tpl = ALL_TEMPLATES.find((t) => t.id === p.template);
        return <article key={p.id} className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
          {tpl ? <img src={tpl.image} alt="" loading="lazy" className="aspect-[16/7] w-full object-cover" /> : <div className="grid aspect-[16/7] w-full place-items-center bg-muted text-xs text-muted-foreground">{p.code ? "Criado no chat" : "Em branco"}</div>}
          <div className="flex flex-1 flex-col gap-2 p-3">
            <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="truncate font-semibold">{p.name}</p><p className="text-xs text-muted-foreground">{tpl?.name ?? "Personalizado"} · editado {when(p.updatedAt)}</p></div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.publishedUrl ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>{p.publishedUrl ? "No ar" : "Rascunho"}</span></div>
            {p.publishedUrl && <a href={p.publishedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 truncate text-xs text-primary underline">{p.publishedUrl.replace(/^https:\/\//, "")}<ExternalLink className="h-3 w-3 shrink-0" /></a>}
            {p.adminUrl && <a href={p.adminUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 truncate text-xs text-primary underline">Admin: {p.adminUrl.replace(/^https:\/\//, "")}<ExternalLink className="h-3 w-3 shrink-0" /></a>}
            {(p.domains ?? []).map((d) => <a key={d} href={`https://${d}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 truncate text-xs text-primary underline"><Globe className="h-3 w-3" />{d}</a>)}
            <div className="mt-auto grid grid-cols-2 gap-1.5 pt-2">
              <Button asChild size="sm"><Link to="/paginas" search={{ site: p.id }}><Pencil className="h-3.5 w-3.5" />Editar</Link></Button>
              <Button size="sm" variant="outline" onClick={() => duplicate(p)}><Copy className="h-3.5 w-3.5" />Duplicar</Button>
              <Button size="sm" variant="outline" disabled={!p.code} onClick={() => zip(p)}><Download className="h-3.5 w-3.5" />ZIP</Button>
              <Button size="sm" variant="ghost" onClick={() => remove(p)}><Trash2 className="h-3.5 w-3.5" />Apagar</Button>
            </div>
          </div>
        </article>;
      })}</div>}
  </div>;
}
