import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Code2, Download, Eye, Globe, Monitor, Pencil, Plus, RotateCw, Send, Smartphone, Sparkles, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { publishPage } from "@/lib/pages.functions";
import { loadPages, savePages, type SalesPage } from "@/lib/pages";
import { applyEdits, downloadZip, parseDecisions, previewHtml, wantsBuild, type Msg, type VisualEdit } from "@/lib/forge";
import { validateGeneration } from "@/lib/forge-validation";
import { ForgePreview } from "@/components/forge-preview";
import { BlockEditor, DEFAULT_STYLE } from "@/components/block-editor";
import { blocksToHtml } from "@/lib/page-blocks";
import { finalizeHtml } from "@/lib/pages";

export const Route = createFileRoute("/paginas")({
  head: () => ({
    meta: [
      { title: "Páginas de vendas — Bat Gotham" },
      { name: "description", content: "Crie páginas de vendas com IA em tempo real, prévia ao vivo, pixel e UTMs." },
      { property: "og:title", content: "Páginas de vendas — Bat Gotham" },
      { property: "og:description", content: "Estúdio de páginas com IA, prévia ao vivo e publicação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PagesRoute,
});

const QUICK = ["Criar página VSL", "Mais agressiva", "Adicionar FAQ", "Mais depoimentos", "Deixar mais premium"];

/** Replaces panel placeholders so preview, ZIP and publish carry the real checkout and pixel. */
function fill(code: string, p: SalesPage) {
  return code.split("{{CHECKOUT_URL}}").join(p.checkoutUrl || "#").split("{{PIXEL_ID}}").join(/^\d{5,20}$/.test(p.pixelId) ? p.pixelId : "");
}

function PagesRoute() {
  const [pages, setPages] = useState<SalesPage[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState("");
  const [tab, setTab] = useState<"preview" | "code" | "blocks">("preview");
  const [device, setDevice] = useState<"mobile" | "desktop">("desktop");
  const [editing, setEditing] = useState(false);
  const [reload, setReload] = useState(0);
  const [side, setSide] = useState<"chat" | "preview">("chat");
  const abort = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const pub = useServerFn(publishPage);

  useEffect(() => { const p = loadPages(); setPages(p); setSel(p[0]?.id ?? null); }, []);
  const page = pages.find((p) => p.id === sel);
  const chat = page?.chat ?? [];
  const code = page?.code ?? "";
  const filled = useMemo(() => (page && code ? fill(code, page) : ""), [page, code]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [live, chat.length]);

  const save = (next: SalesPage[]) => { setPages(next); savePages(next); };
  const patchPage = (id: string, c: Partial<SalesPage>) =>
    setPages((all) => { const next = all.map((p) => (p.id === id ? { ...p, ...c } : p)); savePages(next); return next; });

  const create = () => {
    const p: SalesPage = { id: crypto.randomUUID(), name: "Nova página", product: "", checkoutUrl: "", pixelId: "", versions: [], chat: [] };
    save([p, ...pages]); setSel(p.id);
  };
  const remove = () => { if (!page || !confirm("Apagar esta página?")) return; const n = pages.filter((p) => p.id !== page.id); save(n); setSel(n[0]?.id ?? null); };

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!page || text.length < 2 || busy) return;
    const id = page.id;
    const userText = page.product && !code ? `Produto: ${page.product}. ${text}` : text;
    const history: Msg[] = [...chat, { role: "user", text: userText }];
    const mode = wantsBuild(text, !!code) || !code ? "build" : "chat";
    patchPage(id, { chat: history }); setPrompt(""); setBusy(true); setLive("");
    const { data: s } = await supabase.auth.getSession();
    const ctrl = new AbortController(); abort.current = ctrl;
    let out = "";
    try {
      const res = await fetch("/api/generate", {
        method: "POST", signal: ctrl.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.session?.access_token ?? ""}` },
        body: JSON.stringify({ mode, code, history }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader(), dec = new TextDecoder();
      for (;;) { const { done, value } = await reader.read(); if (done) break; out += dec.decode(value, { stream: true }); setLive(out); }
    } catch (e) {
      if (!ctrl.signal.aborted) toast.error(e instanceof Error && e.message ? e.message.slice(0, 200) : "Falha na geração.");
    }
    setBusy(false); setLive(""); abort.current = null;
    if (!out) return;
    const msgs: Msg[] = [...history, { role: "model", text: out }];
    if (mode === "build" && /```/.test(out)) {
      const v = validateGeneration(out);
      if (v.code) {
        patchPage(id, { chat: msgs, code: v.code, versions: [{ at: Date.now(), html: v.code, note: text.slice(0, 80) }, ...page.versions].slice(0, 20) });
        setTab("preview"); setSide("preview"); toast.success("Página atualizada");
        return;
      }
      toast.error(v.error);
    }
    patchPage(id, { chat: msgs });
  };

  const onEdit = (e: VisualEdit) => page && patchPage(page.id, { code: applyEdits(code, [e]).code });
  const publish = async () => {
    if (!page || !filled) return;
    setBusy(true);
    const html = previewHtml(filled).replace("(window,true)", "(window,false)");
    const r = await pub({ data: { name: page.name, html } }).catch(() => ({ url: "", error: "Falha ao publicar." }));
    setBusy(false);
    if (r.error) { toast.error(r.error); return; }
    patchPage(page.id, { publishedUrl: r.url }); toast.success("Publicada: " + r.url);
  };

  const strip = (t: string) => t.replace(/```decis[oõ]es[\s\S]*?(```|$)/gi, "").replace(/```[\s\S]*?(```|$)/g, "\n[código da página]\n").trim();
  const decisions = useMemo(() => [...chat.filter((m) => m.role === "model").flatMap((m) => parseDecisions(m.text)), ...parseDecisions(live)].slice(-14), [chat, live]);

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col gap-3 p-3 pb-20 md:h-dvh md:p-4 md:pb-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-2xl tracking-wide">Estúdio de páginas</h1>
        <select value={sel ?? ""} onChange={(e) => setSel(e.target.value)} className="h-9 min-w-0 flex-1 rounded-md border border-border bg-card px-2 text-sm md:max-w-xs">
          {pages.length === 0 && <option value="">Nenhuma página</option>}
          {pages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <Button size="sm" onClick={create}><Plus className="h-4 w-4" /> Nova</Button>
        {page && <Button size="sm" variant="ghost" onClick={remove} aria-label="Apagar"><Trash2 className="h-4 w-4" /></Button>}
      </div>

      {!page ? (
        <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">Toque em “Nova” para começar.</div>
      ) : (
        <>
          <div className="flex gap-1 md:hidden">
            <Button size="sm" className="flex-1" variant={side === "chat" ? "default" : "outline"} onClick={() => setSide("chat")}><Sparkles className="h-4 w-4" /> Chat</Button>
            <Button size="sm" className="flex-1" variant={side === "preview" ? "default" : "outline"} onClick={() => setSide("preview")}><Eye className="h-4 w-4" /> Prévia</Button>
          </div>
          <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[minmax(320px,400px)_1fr]">
            {/* Left: chat & control */}
            <section className={`${side === "chat" ? "flex" : "hidden"} min-h-0 flex-col rounded-xl border border-border bg-card md:flex`}>
              <details className="border-b border-border p-3 text-sm">
                <summary className="cursor-pointer text-muted-foreground">Dados da página (nome, produto, checkout, pixel)</summary>
                <div className="mt-2 grid gap-2">
                  <Input value={page.name} onChange={(e) => patchPage(page.id, { name: e.target.value })} placeholder="Nome" />
                  <Input value={page.product} onChange={(e) => patchPage(page.id, { product: e.target.value })} placeholder="Produto / oferta" />
                  <Input value={page.checkoutUrl} onChange={(e) => patchPage(page.id, { checkoutUrl: e.target.value })} placeholder="Link do checkout (botão de compra)" />
                  <Input value={page.pixelId} onChange={(e) => patchPage(page.id, { pixelId: e.target.value })} placeholder="ID do Pixel" inputMode="numeric" />
                </div>
              </details>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 text-sm">
                {chat.length === 0 && !live && <p className="text-muted-foreground">Descreva a oferta ou use um atalho abaixo. A IA monta a página completa: título, vídeo, benefícios, depoimentos, oferta, garantia e perguntas.</p>}
                {chat.map((m, i) => (
                  <div key={i} className={`whitespace-pre-wrap rounded-lg p-2.5 ${m.role === "user" ? "ml-8 bg-primary/15" : "mr-4 bg-muted/40"}`}>{m.role === "user" ? m.text : strip(m.text)}</div>
                ))}
                {live && <div className="mr-4 whitespace-pre-wrap rounded-lg bg-muted/40 p-2.5">{strip(live)}<span className="animate-pulse">▍</span></div>}
                {decisions.length > 0 && (
                  <div className="rounded-lg border border-border p-2.5">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Decisões da IA</p>
                    <ol className="relative space-y-2 border-l border-primary/40 pl-3">
                      {decisions.map((d, i) => (
                        <li key={i} className="text-xs"><span className="absolute -left-[4px] mt-1 h-2 w-2 rounded-full bg-primary" /><b className="text-primary">{d.kind}</b> — {d.text}</li>
                      ))}
                    </ol>
                  </div>
                )}
                <div ref={endRef} />
              </div>
              <div className="space-y-2 border-t border-border p-3">
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {QUICK.map((q) => <button key={q} disabled={busy} onClick={() => send(q)} className="shrink-0 rounded-full border border-border px-3 py-1 text-xs hover:bg-muted disabled:opacity-50">{q}</button>)}
                </div>
                <div className="flex gap-2">
                  <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} placeholder="Peça uma página ou uma mudança…" className="min-h-0 resize-none"
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(prompt); } }} />
                  {busy ? <Button variant="outline" onClick={() => abort.current?.abort()} aria-label="Parar"><Square className="h-4 w-4" /></Button>
                    : <Button onClick={() => send(prompt)} aria-label="Enviar"><Send className="h-4 w-4" /></Button>}
                </div>
              </div>
            </section>

            {/* Right: preview & code */}
            <section className={`${side === "preview" ? "flex" : "hidden"} min-h-0 flex-col rounded-xl border border-border bg-card md:flex`}>
              <div className="flex flex-wrap items-center gap-1 border-b border-border p-2">
                <Button size="sm" variant={tab === "preview" ? "default" : "ghost"} onClick={() => setTab("preview")}><Eye className="h-4 w-4" /> Prévia interativa</Button>
                <Button size="sm" variant={tab === "code" ? "default" : "ghost"} onClick={() => setTab("code")}><Code2 className="h-4 w-4" /> Código gerado</Button>
                <Button size="sm" variant={tab === "blocks" ? "default" : "ghost"} onClick={() => setTab("blocks")}>Blocos</Button>
                <div className="ml-auto flex flex-wrap gap-1">
                  <Button size="icon" variant={device === "mobile" ? "secondary" : "ghost"} onClick={() => setDevice("mobile")} aria-label="Celular"><Smartphone className="h-4 w-4" /></Button>
                  <Button size="icon" variant={device === "desktop" ? "secondary" : "ghost"} onClick={() => setDevice("desktop")} aria-label="Computador"><Monitor className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setReload((n) => n + 1)} aria-label="Recarregar"><RotateCw className="h-4 w-4" /></Button>
                  <Button size="icon" variant={editing ? "secondary" : "ghost"} disabled={!code} onClick={() => setEditing((v) => !v)} aria-label="Edição visual"><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" disabled={!filled} onClick={() => downloadZip(filled)}><Download className="h-4 w-4" /> ZIP</Button>
                  <Button size="sm" disabled={!filled || busy} onClick={publish}><Globe className="h-4 w-4" /> Publicar</Button>
                </div>
              </div>
              {editing && <p className="border-b border-border bg-primary/10 px-3 py-1 text-xs">Edição visual: toque num texto para editar ou numa imagem para trocar.</p>}
              {page.publishedUrl && <a href={page.publishedUrl} target="_blank" rel="noreferrer" className="truncate border-b border-border px-3 py-1 text-xs text-primary underline">{page.publishedUrl}</a>}
              <div className="min-h-0 flex-1 overflow-auto bg-muted/30 p-2">
                {tab === "blocks" ? (
                  <div className="grid gap-3 xl:grid-cols-2">
                    <BlockEditor blocks={page.blocks ?? []} style={page.style ?? DEFAULT_STYLE} onChange={(b, st) => patchPage(page.id, { blocks: b, style: st })}
                      onApply={() => { patchPage(page.id, { versions: [{ at: Date.now(), html: blocksToHtml(page.blocks ?? [], page.style ?? DEFAULT_STYLE, page.name), note: "Editor de blocos" }, ...page.versions].slice(0, 20) }); toast.success("Versão salva"); }} />
                    <iframe title="Prévia dos blocos" srcDoc={finalizeHtml(page, blocksToHtml(page.blocks ?? [], page.style ?? DEFAULT_STYLE, page.name))} sandbox="allow-scripts" className="h-[70vh] w-full rounded-lg border border-border bg-card" />
                  </div>
                ) : tab === "code" ? (
                  <pre className="h-full overflow-auto rounded-lg bg-background p-3 text-xs"><code>{code || "Nenhum código ainda."}</code></pre>
                ) : filled ? (
                  <div className={`mx-auto h-full overflow-hidden rounded-lg border border-border ${device === "mobile" ? "w-[375px] max-w-full" : "w-full"}`}>
                    <ForgePreview key={reload} code={filled} busy={busy} editing={editing} onEdit={onEdit} onRepair={(err) => send(`Corrija este erro da prévia: ${err}`)} />
                  </div>
                ) : page.versions[0]?.html?.includes("<html") ? (
                  <iframe title="prévia antiga" sandbox="allow-scripts" srcDoc={finalizeHtml(page, page.versions[0].html)} className="h-full w-full rounded-lg bg-card" />
                ) : (
                  <div className="grid h-full place-items-center text-sm text-muted-foreground">{busy ? "Criando a página ao vivo…" : "A prévia aparece aqui."}</div>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
