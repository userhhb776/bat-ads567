import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Download, FileText, Globe, Plus, Sparkles, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { generatePage, publishPage } from "@/lib/pages.functions";
import { finalizeHtml, loadPages, savePages, type SalesPage } from "@/lib/pages";

export const Route = createFileRoute("/paginas")({
  head: () => ({
    meta: [
      { title: "Páginas de vendas — Bat Gotham" },
      { name: "description", content: "Crie, edite e publique páginas de vendas com IA, pixel e UTMs." },
      { property: "og:title", content: "Páginas de vendas — Bat Gotham" },
      { property: "og:description", content: "Construtor de páginas com IA integrado aos anúncios." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PagesRoute,
});

function PagesRoute() {
  const [pages, setPages] = useState<SalesPage[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const gen = useServerFn(generatePage);
  const pub = useServerFn(publishPage);

  useEffect(() => { const p = loadPages(); setPages(p); setSel(p[0]?.id ?? null); }, []);
  const update = (next: SalesPage[]) => { setPages(next); savePages(next); };
  const page = pages.find((p) => p.id === sel);
  const html = page?.versions[0]?.html ?? "";
  const final = useMemo(() => (page ? finalizeHtml(page, html) : ""), [page, html]);
  const patch = (c: Partial<SalesPage>) => page && update(pages.map((p) => (p.id === page.id ? { ...p, ...c } : p)));
  const addVersion = (h: string, note: string) => page && patch({ versions: [{ at: Date.now(), html: h, note }, ...page.versions].slice(0, 20) });

  const create = () => {
    const p: SalesPage = { id: crypto.randomUUID(), name: "Nova página", product: "", checkoutUrl: "", pixelId: "", versions: [] };
    update([p, ...pages]); setSel(p.id);
  };
  const run = async () => {
    if (!page || prompt.trim().length < 3) return;
    setBusy(true);
    const ctx = page.product ? `Produto: ${page.product}. ` : "";
    const r = await gen({ data: { prompt: ctx + prompt, current: html || undefined } }).catch(() => ({ html: "", error: "Falha ao gerar." }));
    setBusy(false);
    if (r.error) return toast.error(r.error);
    addVersion(r.html, prompt.slice(0, 80)); setPrompt(""); toast.success("Página atualizada");
  };
  const publish = async () => {
    if (!page || !html) return;
    setBusy(true);
    const r = await pub({ data: { name: page.name, html: final } }).catch(() => ({ url: "", error: "Falha ao publicar." }));
    setBusy(false);
    if (r.error) return toast.error(r.error);
    patch({ publishedUrl: r.url }); toast.success("Publicada: " + r.url);
  };
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([final], { type: "text/html" }));
    a.download = (page?.name || "pagina") + ".html"; a.click();
  };

  return (
    <div className="space-y-4 p-4 pb-24 md:p-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-3xl tracking-wide">Páginas de vendas</h1>
        <Button onClick={create}><Plus className="h-4 w-4" /> Nova</Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <div className="space-y-2">
          {pages.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma página ainda. Toque em “Nova”.</p>}
          {pages.map((p) => (
            <button key={p.id} onClick={() => setSel(p.id)} className={`flex w-full items-center gap-2 rounded-lg border p-3 text-left text-sm ${p.id === sel ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
              <FileText className="h-4 w-4 text-primary" /> <span className="truncate">{p.name}</span>
              {p.publishedUrl && <Globe className="ml-auto h-3 w-3 text-primary" />}
            </button>
          ))}
        </div>
        {page && (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Input value={page.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Nome da página" />
              <Input value={page.product} onChange={(e) => patch({ product: e.target.value })} placeholder="Produto (ex.: Curso X, R$ 97)" />
              <Input value={page.checkoutUrl} onChange={(e) => patch({ checkoutUrl: e.target.value })} placeholder="Link do checkout ou WhatsApp" />
              <Input value={page.pixelId} onChange={(e) => patch({ pixelId: e.target.value.trim() })} placeholder="ID do pixel (opcional)" inputMode="numeric" />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={html ? "O que mudar? Ex.: deixe o topo mais forte e adicione depoimentos" : "Descreva a página: público, oferta, tom, cores…"} className="min-h-20" />
              <Button onClick={run} disabled={busy} className="sm:self-stretch"><Sparkles className="h-4 w-4" /> {busy ? "Aguarde…" : html ? "Editar com IA" : "Gerar com IA"}</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setTab(tab === "preview" ? "code" : "preview")}>{tab === "preview" ? "Ver código" : "Ver prévia"}</Button>
              <Button variant="outline" size="sm" disabled={page.versions.length < 2} onClick={() => patch({ versions: page.versions.slice(1) })}><Undo2 className="h-4 w-4" /> Desfazer</Button>
              <Button variant="outline" size="sm" onClick={() => { const c = { ...page, id: crypto.randomUUID(), name: page.name + " (cópia)", publishedUrl: undefined }; update([c, ...pages]); setSel(c.id); }}><Copy className="h-4 w-4" /> Duplicar</Button>
              <Button variant="outline" size="sm" disabled={!html} onClick={download}><Download className="h-4 w-4" /> Baixar</Button>
              <Button size="sm" disabled={!html || busy} onClick={publish}><Globe className="h-4 w-4" /> Publicar</Button>
              <Button variant="ghost" size="sm" onClick={() => { const n = pages.filter((p) => p.id !== page.id); update(n); setSel(n[0]?.id ?? null); }}><Trash2 className="h-4 w-4" /></Button>
            </div>
            {page.publishedUrl && <a href={page.publishedUrl} target="_blank" rel="noreferrer" className="block text-sm text-primary underline">{page.publishedUrl}</a>}
            {tab === "preview" ? (
              html ? <iframe title="Prévia" srcDoc={final} sandbox="allow-scripts" className="h-[70vh] w-full rounded-lg border border-border bg-background" />
                : <div className="grid h-60 place-items-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">Descreva a página e toque em “Gerar com IA”.</div>
            ) : (
              <Textarea value={html} onChange={(e) => patch({ versions: [{ ...page.versions[0]!, html: e.target.value }, ...page.versions.slice(1)] })} className="h-[70vh] font-mono text-xs" disabled={!html} />
            )}
            {page.versions.length > 0 && <p className="text-xs text-muted-foreground">{page.versions.length} versão(ões) salvas. Última: {page.versions[0]!.note}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
