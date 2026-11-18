import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, ExternalLink, Globe, Loader2, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Empty, PageHead, head } from "@/components/ui-kit";
import { loadPages, savePages, type SalesPage } from "@/lib/pages";
import { cleanDomain, isApex, siteProject } from "@/lib/sites";
import { addSiteDomain, checkSiteDomain } from "@/lib/sites.functions";

export const Route = createFileRoute("/sites/dominios")({ head: () => head("Bat Dev V-0 · Publicação e domínios", "Sites no ar, painéis admin e domínio próprio com passo a passo."), component: Domains });

type St = { verified: boolean; misconfigured: boolean; verification: { type: string; domain: string; value: string }[]; error: string };

function Records({ domain, st }: { domain: string; st?: St | undefined }) {
  const apex = isApex(domain);
  const rows: [string, string, string][] = [apex ? ["A", "@", "76.76.21.21"] : ["CNAME", domain.split(".")[0]!, "cname.vercel-dns.com"], ...(st?.verification ?? []).map((v): [string, string, string] => [v.type, v.domain, v.value])];
  return <div className="overflow-x-auto rounded-md border border-border"><table className="w-full text-xs"><thead className="bg-muted/50 text-left"><tr><th className="p-2">Tipo</th><th className="p-2">Nome</th><th className="p-2">Valor</th></tr></thead>
    <tbody>{rows.map(([t, n, v]) => <tr key={t + n + v} className="border-t border-border"><td className="p-2 font-semibold">{t}</td><td className="p-2">{n}</td><td className="break-all p-2"><button type="button" className="text-left underline decoration-dotted" onClick={() => { void navigator.clipboard.writeText(v); toast.success("Copiado"); }}>{v}</button></td></tr>)}</tbody></table></div>;
}

function Domains() {
  const add = useServerFn(addSiteDomain), check = useServerFn(checkSiteDomain);
  const [pages, setPages] = useState<SalesPage[]>([]);
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState<Record<string, St>>({});
  useEffect(() => { setPages(loadPages()); }, []);
  const patch = (id: string, c: Partial<SalesPage>) => { const next = pages.map((p) => (p.id === id ? { ...p, ...c } : p)); setPages(next); savePages(next); };
  const live = pages.filter((p) => p.publishedUrl);

  const link = async (p: SalesPage) => {
    const domain = cleanDomain(typed[p.id] ?? "");
    if (!domain) { toast.error("Digite um domínio válido, ex.: meusite.com.br"); return; }
    setBusy(domain);
    const r = await add({ data: { project: siteProject(p), domain } }).catch(() => ({ ok: false, verified: false, misconfigured: true, verification: [], error: "Falha ao conectar o domínio." }));
    setBusy("");
    if (r.error) { toast.error(r.error); return; }
    patch(p.id, { domains: [...new Set([...(p.domains ?? []), domain])] }); setTyped({ ...typed, [p.id]: "" }); setStatus({ ...status, [domain]: r });
    toast.success("Domínio ligado ao site. Agora crie os registros abaixo no seu provedor de domínio.");
  };
  const verify = async (p: SalesPage, domain: string) => {
    setBusy(domain);
    const r = await check({ data: { project: siteProject(p), domain } }).catch(() => ({ ok: false, verified: false, misconfigured: true, verification: [], error: "Falha ao verificar." }));
    setBusy(""); setStatus({ ...status, [domain]: r });
    if (r.error) toast.error(r.error); else toast[r.verified && !r.misconfigured ? "success" : "message"](r.verified && !r.misconfigured ? "Domínio funcionando" : "Ainda não apontou — pode levar de minutos a algumas horas.");
  };

  return <div className="space-y-4 p-4 pb-28 sm:p-7">
    <PageHead title="Publicação e domínios" sub="Sites no ar, painéis admin das lojas e seu domínio próprio." />
    <details className="rounded-xl border border-border bg-card p-4 text-sm"><summary className="cursor-pointer font-semibold">Como usar um domínio próprio (passo a passo)</summary>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
        <li>Publique o site no estúdio (botão Publicar).</li>
        <li>Aqui, digite o domínio que você comprou (Registro.br, Hostinger, GoDaddy…) e toque em Conectar.</li>
        <li>No painel onde comprou o domínio, abra a parte de DNS e crie os registros que aparecem na tabela.</li>
        <li>Domínio raiz (meusite.com.br) usa registro A. Subdomínio (loja.meusite.com.br) usa CNAME.</li>
        <li>Toque em Verificar. Pode levar de minutos a algumas horas; o cadeado (https) é criado sozinho.</li>
      </ol></details>
    {!live.length ? <Empty><span>Nenhum site publicado ainda. <Link to="/sites" className="text-primary underline">Abra seus sites</Link> e publique pelo estúdio.</span></Empty> :
      <div className="grid gap-3 lg:grid-cols-2">{live.map((p) => <article key={p.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="font-semibold">{p.name}</p>
          <a href={p.publishedUrl} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 truncate text-xs text-primary underline">{p.publishedUrl!.replace(/^https:\/\//, "")}<ExternalLink className="h-3 w-3 shrink-0" /></a>
          {p.adminUrl && <a href={p.adminUrl} target="_blank" rel="noreferrer" className="flex max-w-full items-center gap-1 truncate text-xs text-primary underline">Admin: {p.adminUrl.replace(/^https:\/\//, "")}<ExternalLink className="h-3 w-3 shrink-0" /></a>}</div>
          <Button asChild size="sm" variant="outline"><Link to="/paginas" search={{ site: p.id }}><Pencil className="h-3.5 w-3.5" />Editar</Link></Button></div>
        {(p.domains ?? []).map((d) => { const st = status[d]; const okd = st && st.verified && !st.misconfigured; return <div key={d} className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex flex-wrap items-center gap-2"><Globe className="h-4 w-4 text-primary" /><a className="text-sm font-semibold underline" href={`https://${d}`} target="_blank" rel="noreferrer">{d}</a>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${okd ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>{okd ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}{!st ? "Não verificado" : okd ? "Funcionando" : "Aguardando DNS"}</span>
            <div className="ml-auto flex gap-1"><Button size="sm" variant="outline" disabled={busy === d} onClick={() => void verify(p, d)}>{busy === d ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}Verificar</Button>
              <Button size="icon" variant="ghost" aria-label="Tirar do painel" onClick={() => patch(p.id, { domains: (p.domains ?? []).filter((x) => x !== d) })}><Trash2 className="h-3.5 w-3.5" /></Button></div></div>
          {!okd && <Records domain={d} st={st} />}
          {st?.error && <p className="text-xs text-destructive">{st.error}</p>}
        </div>; })}
        <div className="flex gap-2"><Input value={typed[p.id] ?? ""} onChange={(e) => setTyped({ ...typed, [p.id]: e.target.value })} placeholder="meusite.com.br" inputMode="url" /><Button disabled={!!busy} onClick={() => void link(p)}>Conectar</Button></div>
        {p.adminUrl && <p className="text-[11px] text-muted-foreground">Para o admin com domínio próprio, use um subdomínio (ex.: admin.meusite.com.br) depois de publicar.</p>}
      </article>)}</div>}
  </div>;
}
