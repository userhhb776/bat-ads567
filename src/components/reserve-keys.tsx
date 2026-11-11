import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listGatewayCreds, saveGatewayCred, deleteGatewayCred } from "@/lib/integrations.functions";

const DS = [["deepseek-2", "Reserva 1"], ["deepseek-3", "Reserva 2"], ["deepseek-4", "Reserva 3"]] as const;

/** Reserve keys: DeepSeek takes over when the main key runs out; the Render reserve takes over when the main server fails. */
export function ReserveKeys() {
  const list = useServerFn(listGatewayCreds), save = useServerFn(saveGatewayCred), del = useServerFn(deleteGatewayCred);
  const q = useQuery({ queryKey: ["reserve-creds"], queryFn: () => list(), staleTime: 60000, retry: false });
  const [d, setD] = useState<Record<string, string>>({});
  const has = (p: string) => q.data?.find((x) => x.platform === p);
  const put = async (platform: string, token: string, secret = "") => { await save({ data: { platform, token, secret } }); toast.success("Salvo"); setD({}); void q.refetch(); };
  const rm = async (platform: string) => { if (!window.confirm("Remover?")) return; await del({ data: { platform } }); void q.refetch(); };
  return <section className="space-y-4 border-b border-border pb-6">
    <div><h2 className="font-display text-2xl">Chaves reservas da DeepSeek</h2><p className="text-xs text-muted-foreground">Se a chave principal acabar o crédito, o Crowley passa sozinho para a próxima.</p></div>
    <div className="grid gap-3 sm:grid-cols-3">{DS.map(([slot, label]) => <div key={slot} className="space-y-2 rounded-md border border-border bg-card p-3">
      <div className="flex items-center justify-between"><span className="text-sm font-semibold">{label}</span>{has(slot) && <Button size="icon" variant="ghost" aria-label={`Remover ${label}`} onClick={() => void rm(slot)}><Trash2 className="h-4 w-4" /></Button>}</div>
      {has(slot) ? <p className="text-xs text-muted-foreground">Salva: {has(slot)!.token}</p> :
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const v = (d[slot] ?? "").trim(); if (!/^sk-/.test(v)) { toast.error("A chave começa com sk-"); return; } void put(slot, v); }}><Input type="password" placeholder="sk-…" value={d[slot] ?? ""} onChange={(e) => setD({ ...d, [slot]: e.target.value })} /><Button>Salvar</Button></form>}
    </div>)}</div>
    <div><h2 className="font-display text-2xl">Servidor reserva do WhatsApp</h2><p className="text-xs text-muted-foreground">Se o servidor principal cair ou expirar, as mensagens passam por este.</p></div>
    {has("render-2") ? <div className="flex items-center justify-between rounded-md border border-border bg-card p-3 text-sm"><span className="min-w-0 truncate">Reserva salva: {has("render-2")!.token}</span><Button size="icon" variant="ghost" aria-label="Remover servidor reserva" onClick={() => void rm("render-2")}><Trash2 className="h-4 w-4" /></Button></div> :
      <form className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(e) => { e.preventDefault(); const u = (d["url"] ?? "").trim(), k = (d["key"] ?? "").trim(); if (!/^https:\/\//.test(u) || !k) { toast.error("Preencha o endereço https:// e a chave"); return; } void put("render-2", u, k); }}>
        <Input placeholder="https://seu-servidor.onrender.com" value={d["url"] ?? ""} onChange={(e) => setD({ ...d, url: e.target.value })} inputMode="url" />
        <Input type="password" placeholder="Chave (AUTHENTICATION_API_KEY)" value={d["key"] ?? ""} onChange={(e) => setD({ ...d, key: e.target.value })} />
        <Button>Salvar</Button></form>}
    <details className="rounded-md border border-border bg-card p-3 text-sm">
      <summary className="cursor-pointer font-semibold">Manual: como criar um novo servidor de WhatsApp no Render</summary>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground">
        <li>Entre em <b>render.com</b> → <b>New +</b> → <b>Postgres</b>. Nome: <code>evolution-db</code>, plano Free. Depois de criado, copie a <b>Internal Database URL</b>. (O banco grátis do Render expira em 30 dias — anote para recriar.)</li>
        <li><b>New +</b> → <b>Web Service</b> → <b>Existing image</b> e cole: <code>evoapicloud/evolution-api:latest</code> (a imagem antiga <code>atendai/…</code> não recebe mais atualização).</li>
        <li>Região: a mesma do banco. Plano: Free funciona mas dorme após 15 min sem uso; Starter fica sempre ligado.</li>
        <li>Em <b>Environment</b>, adicione:
          <pre className="mt-2 overflow-x-auto whitespace-pre rounded bg-muted p-2 text-[11px] text-foreground">{`SERVER_URL=https://SEU-NOME.onrender.com
SERVER_PORT=8080
AUTHENTICATION_API_KEY=crie-uma-senha-longa-aqui
DATABASE_ENABLED=true
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=(Internal Database URL do passo 1)
DATABASE_CONNECTION_CLIENT_NAME=evolution
DATABASE_SAVE_DATA_INSTANCE=true
DATABASE_SAVE_DATA_NEW_MESSAGE=true
DATABASE_SAVE_DATA_CONTACTS=true
DATABASE_SAVE_DATA_CHATS=true
CACHE_REDIS_ENABLED=false
CACHE_LOCAL_ENABLED=true
CONFIG_SESSION_PHONE_CLIENT=Bat Gotham
CONFIG_SESSION_PHONE_NAME=Chrome
LOG_LEVEL=ERROR,WARN
DEL_INSTANCE=false`}</pre></li>
        <li>Em <b>Settings → Health Check Path</b> coloque <code>/</code>. Clique em <b>Deploy</b> e espere aparecer “Live”.</li>
        <li>Abra o endereço no navegador: deve mostrar uma mensagem de boas-vindas da Evolution. Pronto.</li>
        <li>Aqui em cima, cole o endereço (<code>https://SEU-NOME.onrender.com</code>) e o valor de <code>AUTHENTICATION_API_KEY</code> e toque em Salvar.</li>
        <li>No card WhatsApp, conecte o número pelo QR Code e toque em <b>Receber</b> para as mensagens chegarem no Atendimento.</li>
      </ol>
      <p className="mt-3 text-xs text-muted-foreground">Dica: para o servidor grátis não dormir, use um serviço de “ping” (ex.: cron-job.org) chamando o endereço a cada 10 minutos.</p>
    </details>
  </section>;
}
