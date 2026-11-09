import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Trash2, Upload, Send, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, Empty, Field, NativeSelect, PageHead, Stat, head } from "@/components/ui-kit";
import { AccountBar } from "@/components/account-bar";
import { useAccount } from "@/lib/use-account";
import { useStore, uid } from "@/lib/store";
import { money, useCurrency } from "@/lib/currency";
import { getObjects, uploadMedia } from "@/lib/meta.functions";
import { scoreAds, type CopyItem, type Creative } from "@/lib/creatives";
import type { Product } from "@/lib/biz";

export const Route = createFileRoute("/criativos")({
  head: () => head("Creative Center", "Biblioteca de criativos e copies com ranking de CTR, CPA e ROAS dos anúncios."),
  component: CreativeCenter,
});

const toBase64 = (f: File) => new Promise<string>((ok, err) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] ?? ""); r.onerror = err; r.readAsDataURL(f); });

function CreativeCenter() {
  const [tab, setTab] = useState<"biblioteca" | "desempenho" | "copies">("biblioteca");
  return (
    <div className="space-y-4 p-4 pb-24 md:p-6">
      <PageHead title="Creative Center" sub="Guarde, organize e compare seus criativos e textos." />
      <div className="flex gap-1.5">{(["biblioteca", "desempenho", "copies"] as const).map((t) => <Button key={t} size="sm" variant={tab === t ? "default" : "outline"} className="h-7 text-xs capitalize" onClick={() => setTab(t)}>{t}</Button>)}</div>
      {tab === "biblioteca" ? <Library /> : tab === "desempenho" ? <Performance /> : <Copies />}
    </div>
  );
}

function Library() {
  const [items, setItems] = useStore<Creative[]>("creatives", []);
  const [products] = useStore<Product[]>("products", []);
  const [account, setAccount] = useAccount();
  const [q, setQ] = useState(""); const [tag, setTag] = useState(""); const [busy, setBusy] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const toMeta = useServerFn(uploadMedia);
  const shown = items.filter((c) => (!q || `${c.name} ${c.notes} ${c.category}`.toLowerCase().includes(q.toLowerCase())) && (!tag || c.tags.includes(tag)));
  const tags = [...new Set(items.flatMap((c) => c.tags))];
  useEffect(() => {
    const missing = shown.filter((c) => !urls[c.id]);
    if (!missing.length) return;
    void supabase.storage.from("creatives").createSignedUrls(missing.map((c) => c.path), 3600).then(({ data }) => {
      if (data) setUrls((u) => ({ ...u, ...Object.fromEntries(data.map((d, i) => [missing[i]!.id, d.signedUrl ?? ""])) }));
    });
  }, [shown.map((c) => c.id).join()]);
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const added: Creative[] = [];
    for (const f of [...files]) {
      const id = uid(); const path = `${u.user!.id}/${id}-${f.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from("creatives").upload(path, f, { contentType: f.type });
      if (error) { toast.error(`${f.name}: ${error.message}`); continue; }
      added.push({ id, name: f.name, kind: f.type.startsWith("video") ? "video" : "image", path, size: f.size, tags: [], category: "", productId: "", campaignId: "", adIds: [], notes: "", createdAt: Date.now() });
    }
    setItems([...added, ...items]); setBusy(false);
    if (added.length) toast.success(`${added.length} arquivo(s) guardado(s).`);
  }
  const patch = (id: string, p: Partial<Creative>) => setItems(items.map((c) => (c.id === id ? { ...c, ...p } : c)));
  async function remove(c: Creative) {
    if (!confirm(`Apagar ${c.name}?`)) return;
    const { error } = await supabase.storage.from("creatives").remove([c.path]);
    if (error) return toast.error(error.message);
    setItems(items.filter((x) => x.id !== c.id));
  }
  async function sendToMeta(c: Creative) {
    if (!account) return toast.error("Escolha a conta de anúncios.");
    setBusy(true);
    try {
      const blob = await (await fetch(urls[c.id]!)).blob();
      if (blob.size > 25_000_000) throw new Error("Arquivo grande demais para envio direto (máx. 25 MB).");
      const r: any = await toMeta({ data: { accountId: account, kind: c.kind, base64: await toBase64(new File([blob], c.name)), name: c.name } });
      patch(c.id, { metaHash: String(r.hash ?? r.id ?? "") });
      toast.success("Enviado para a biblioteca da conta.");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-3">
      <AccountBar account={account} setAccount={setAccount} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"><Upload className="h-4 w-4" />{busy ? "Enviando…" : "Enviar imagens/vídeos"}<input type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => upload(e.target.files)} /></label>
        <Input placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <NativeSelect value={tag} onChange={(e) => setTag(e.target.value)}><option value="">Todas as tags</option>{tags.map((t) => <option key={t}>{t}</option>)}</NativeSelect>
      </div>
      {!shown.length ? <Empty>Nenhum criativo guardado.</Empty> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((c) => (
            <Card key={c.id} className="space-y-2 p-3">
              <div className="aspect-video overflow-hidden rounded-md bg-muted">
                {urls[c.id] && (c.kind === "video" ? <video src={urls[c.id]} controls className="h-full w-full object-contain" /> : <img src={urls[c.id]} alt={c.name} className="h-full w-full object-contain" />)}
              </div>
              <Input value={c.name} onChange={(e) => patch(c.id, { name: e.target.value })} className="h-8 text-xs" />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Categoria" value={c.category} onChange={(e) => patch(c.id, { category: e.target.value })} className="h-8 text-xs" />
                <NativeSelect value={c.productId} onChange={(e) => patch(c.id, { productId: e.target.value })} className="h-8 text-xs"><option value="">Produto</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</NativeSelect>
              </div>
              <Input placeholder="Tags separadas por vírgula" defaultValue={c.tags.join(", ")} onBlur={(e) => patch(c.id, { tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} className="h-8 text-xs" />
              <Input placeholder="IDs dos anúncios vinculados" defaultValue={c.adIds.join(", ")} onBlur={(e) => patch(c.id, { adIds: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} className="h-8 text-xs" />
              <Textarea placeholder="Observações / histórico de testes" value={c.notes} onChange={(e) => patch(c.id, { notes: e.target.value })} className="min-h-14 text-xs" />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{(c.size / 1e6).toFixed(1)} MB · {new Date(c.createdAt).toLocaleDateString("pt-BR")}{c.metaHash ? " · na Meta" : ""}</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" disabled={busy || !urls[c.id]} onClick={() => sendToMeta(c)} title="Enviar à conta de anúncios"><Send className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(c)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Performance() {
  useCurrency();
  const [account, setAccount] = useAccount();
  const [preset, setPreset] = useState("last_7d");
  const [opts, setOpts] = useStore("creative-thresholds", { minSpend: 30, targetCpa: 0, minRoas: 0 });
  const [library] = useStore<Creative[]>("creatives", []);
  const ads = useQuery({ queryKey: ["creative-ads", account, preset], enabled: !!account, queryFn: () => getObjects({ data: { accountId: account, level: "ads", datePreset: preset } }), staleTime: 300000 });
  const scored = useMemo(() => scoreAds(ads.data ?? [], { minSpend: opts.minSpend, targetCpa: opts.targetCpa || undefined, minRoas: opts.minRoas || undefined }), [ads.data, opts]);
  const [sort, setSort] = useState<"ctr" | "cpa" | "roas">("roas");
  const sorted = [...scored].filter((s) => s.spend > 0).sort((a, b) => sort === "ctr" ? b.ctr - a.ctr : sort === "roas" ? (b.roas ?? -1) - (a.roas ?? -1) : (a.cpa ?? 1e9) - (b.cpa ?? 1e9));
  const m = (v: number) => money(v);
  return (
    <div className="space-y-3">
      <AccountBar account={account} setAccount={setAccount} />
      <div className="grid gap-2 sm:grid-cols-5">
        <Field label="Período"><NativeSelect value={preset} onChange={(e) => setPreset(e.target.value)}><option value="today">Hoje</option><option value="yesterday">Ontem</option><option value="last_7d">7 dias</option><option value="last_14d">14 dias</option><option value="last_30d">30 dias</option><option value="maximum">Tudo</option></NativeSelect></Field>
        <Field label="Ordenar"><NativeSelect value={sort} onChange={(e) => setSort(e.target.value as never)}><option value="roas">Melhor ROAS</option><option value="cpa">Melhor CPA</option><option value="ctr">Melhor CTR</option></NativeSelect></Field>
        <Field label="Gasto mínimo p/ julgar"><Input inputMode="decimal" value={opts.minSpend} onChange={(e) => setOpts({ ...opts, minSpend: Number(e.target.value) || 0 })} /></Field>
        <Field label="CPA alvo (0 = sem)"><Input inputMode="decimal" value={opts.targetCpa} onChange={(e) => setOpts({ ...opts, targetCpa: Number(e.target.value) || 0 })} /></Field>
        <Field label="ROAS mínimo (0 = sem)"><Input inputMode="decimal" value={opts.minRoas} onChange={(e) => setOpts({ ...opts, minRoas: Number(e.target.value) || 0 })} /></Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Vencedores" value={scored.filter((s) => s.verdict === "vencedor").length} />
        <Stat label="Ruins" value={scored.filter((s) => s.verdict === "ruim").length} />
        <Stat label="Em teste" value={scored.filter((s) => s.verdict === "em teste" && s.spend > 0).length} />
      </div>
      {ads.isLoading ? <Empty>Carregando anúncios…</Empty> : ads.error ? <Empty>{(ads.error as Error).message}</Empty> : !sorted.length ? <Empty>Sem gasto no período.</Empty> : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {sorted.map((s) => {
            const lib = library.find((c) => c.adIds.includes(s.id));
            return (
              <div key={s.id} className="flex items-center gap-3 p-3 text-sm">
                {s.thumb ? <img src={s.thumb} alt="" className="h-12 w-12 rounded object-cover" /> : <div className="h-12 w-12 rounded bg-muted" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 truncate font-medium">{s.verdict === "vencedor" && <Trophy className="h-3 w-3 text-primary" />}{s.name}</div>
                  <div className="text-xs text-muted-foreground">Gasto {m(s.spend)} · CTR {s.ctr.toFixed(2)}% · CPA {s.cpa ? m(s.cpa) : "—"} · ROAS {s.roas?.toFixed(2) ?? "—"} · {s.purchases} compras · {s.leads} leads{lib ? ` · biblioteca: ${lib.name}` : ""}</div>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] ${s.verdict === "vencedor" ? "border-primary text-primary" : s.verdict === "ruim" ? "border-destructive text-destructive" : "border-border text-muted-foreground"}`}>{s.verdict}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Copies() {
  const [items, setItems] = useStore<CopyItem[]>("copies", []);
  const [products] = useStore<Product[]>("products", []);
  const [q, setQ] = useState(""); const [kind, setKind] = useState("");
  const shown = items.filter((c) => (!kind || c.kind === kind) && (!q || `${c.name} ${c.text} ${c.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase())));
  const patch = (id: string, p: Partial<CopyItem>) => setItems(items.map((c) => (c.id === id ? { ...c, ...p } : c)));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setItems([{ id: uid(), name: "Nova copy", kind: "texto", text: "", cta: "", url: "", productId: "", tags: [], createdAt: Date.now() }, ...items])}>+ Nova</Button>
        <Input placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <NativeSelect value={kind} onChange={(e) => setKind(e.target.value)}><option value="">Todos</option><option value="texto">Textos</option><option value="titulo">Títulos</option><option value="descricao">Descrições</option><option value="referencia">Referências</option></NativeSelect>
      </div>
      {!shown.length ? <Empty>Nenhuma copy guardada.</Empty> : shown.map((c) => (
        <Card key={c.id} className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-4">
            <Input value={c.name} onChange={(e) => patch(c.id, { name: e.target.value })} />
            <NativeSelect value={c.kind} onChange={(e) => patch(c.id, { kind: e.target.value as never })}><option value="texto">Texto principal</option><option value="titulo">Título</option><option value="descricao">Descrição</option><option value="referencia">Referência</option></NativeSelect>
            <NativeSelect value={c.productId} onChange={(e) => patch(c.id, { productId: e.target.value })}><option value="">Produto</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</NativeSelect>
            <Input placeholder="Chamada (CTA)" value={c.cta} onChange={(e) => patch(c.id, { cta: e.target.value })} />
          </div>
          <Textarea value={c.text} onChange={(e) => patch(c.id, { text: e.target.value })} placeholder="Texto" />
          <div className="flex gap-2">
            <Input placeholder="Link de referência" value={c.url} onChange={(e) => patch(c.id, { url: e.target.value })} />
            <Input placeholder="Tags" defaultValue={c.tags.join(", ")} onBlur={(e) => patch(c.id, { tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} />
            <Button size="sm" variant="ghost" onClick={async () => { await navigator.clipboard.writeText(c.text); toast.success("Copiado"); }}><Copy className="h-3 w-3" /></Button>
            <Button size="sm" variant="ghost" onClick={() => setItems(items.filter((x) => x.id !== c.id))}><Trash2 className="h-3 w-3" /></Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
