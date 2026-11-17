import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ChevronDown, KeyRound, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { metaTokenDelete, metaTokenSave, metaTokenStatus } from "@/lib/meta-token.functions";

const SOURCE: Record<string, string> = { painel: "Token próprio (salvo aqui)", servidor: "Token do servidor", nativa: "Conexão nativa atual" };
const STEPS: [string, string][] = [
  ["Abra as configurações da sua BM", "No computador, entre em business.facebook.com → Configurações do negócio. Escolha a BM dona das contas de anúncio."],
  ["Crie um usuário do sistema", "Usuários → Usuários do sistema → Adicionar. Dê um nome (ex.: Bat Gotham) e escolha a função Administrador."],
  ["Dê acesso às contas e páginas", "Com o usuário selecionado, clique em Atribuir ativos. Marque as contas de anúncio (controle total), as páginas e os pixels que o painel vai usar."],
  ["Gere o token", "Clique em Gerar novo token, escolha seu aplicativo, validade Nunca e marque: ads_management, ads_read, business_management, pages_show_list e pages_read_engagement."],
  ["Cole aqui", "Copie o token e cole no campo abaixo. O painel testa na hora e mostra quantas contas encontrou."],
];

/** Native Meta connection by access token (works on any domain where the panel is hosted). */
export function MetaConnectionCard() {
  const status = useServerFn(metaTokenStatus), save = useServerFn(metaTokenSave), del = useServerFn(metaTokenDelete);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["meta-token-status"], queryFn: () => status(), staleTime: 60_000, retry: false });
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [guide, setGuide] = useState(false);
  const s = q.data;
  const refresh = () => { void q.refetch(); void qc.invalidateQueries({ queryKey: ["meta-status"] }); void qc.invalidateQueries({ queryKey: ["accounts"] }); };
  return <section className="space-y-4 border-b border-border pb-6">
    <div className="flex items-start justify-between gap-3">
      <div><h2 className="font-display text-2xl">Conexão Meta</h2><p className="text-xs text-muted-foreground">Conecte qualquer BM ou conta de anúncios com um token de usuário do sistema. Funciona em qualquer domínio onde o painel estiver.</p></div>
      <Button variant="ghost" size="icon" aria-label="Testar conexão" onClick={() => void q.refetch()}><RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} /></Button>
    </div>
    <div className="rounded-md border border-border bg-card p-3 text-sm">
      {q.isLoading ? <p className="text-muted-foreground">Testando conexão…</p>
        : s?.name ? <div className="space-y-1">
          <p className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-4 w-4 text-primary" />Conectado como {s.name}</p>
          <p className="text-xs text-muted-foreground">{SOURCE[s.source ?? ""] ?? "—"}{s.masked && s.source === "painel" ? ` · ${s.masked}` : ""} · {s.accounts ?? 0} conta(s) de anúncio visíveis</p>
          {!!s.missing.length && <p className="flex items-center gap-1 text-xs text-destructive"><TriangleAlert className="h-3.5 w-3.5" />Faltam permissões: {s.missing.join(", ")}. Gere o token de novo marcando todas.</p>}
        </div>
        : <p className="flex items-center gap-2 text-destructive"><TriangleAlert className="h-4 w-4" />{s?.error ?? "Sem conexão."}</p>}
    </div>
    <form className="flex flex-col gap-2 sm:flex-row" onSubmit={async (e) => {
      e.preventDefault(); if (!token.trim()) return; setBusy(true);
      try { const r = await save({ data: { token: token.trim() } }); setToken(""); toast.success(`Conectado como ${r.name} · ${r.accounts} conta(s)`); refresh(); }
      catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
    }}>
      <Input type="password" autoComplete="off" placeholder={s?.source === "painel" ? "Colar novo token para trocar" : "Cole o token de acesso da Meta"} value={token} onChange={(e) => setToken(e.target.value)} />
      <Button disabled={busy || !token.trim()}><KeyRound className="h-4 w-4" />{busy ? "Testando…" : "Testar e salvar"}</Button>
      {s?.source === "painel" && <Button type="button" variant="outline" onClick={async () => { if (!window.confirm("Remover o token salvo? O painel volta a usar a conexão do servidor, se houver.")) return; await del(); toast.success("Token removido"); refresh(); }}><Trash2 className="h-4 w-4" />Remover</Button>}
    </form>
    <button type="button" className="flex items-center gap-1 text-sm font-medium text-primary" onClick={() => setGuide(!guide)} aria-expanded={guide}><ChevronDown className={`h-4 w-4 transition ${guide ? "rotate-180" : ""}`} />Como gerar o token (passo a passo)</button>
    {guide && <ol className="space-y-3">{STEPS.map(([t, d], i) => <li key={t} className="flex gap-3 rounded-md border border-border bg-card p-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span><div><p className="text-sm font-semibold">{t}</p><p className="text-xs text-muted-foreground">{d}</p></div></li>)}
      <li className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">Nova BM ou conta? Basta atribuir a conta ao mesmo usuário do sistema (passo 3) — o token continua o mesmo e a conta aparece no painel. Para outra BM, crie um usuário do sistema nela e cole o token novo aqui. O token fica guardado só no servidor, nunca no navegador.</li>
    </ol>}
  </section>;
}
