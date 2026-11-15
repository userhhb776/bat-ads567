import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlarmClock, KeyRound, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cronDeleteKey, cronSaveKey, cronStatus, cronSync, cronToggle } from "@/lib/cronjob.functions";

const ago = (unix: number) => {
  if (!unix) return "nunca";
  const m = Math.max(0, Math.round((Date.now() / 1000 - unix) / 60));
  return m < 1 ? "agora" : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} d`;
};

/** Keep-awake ping on cron-job.org: key, tasks with last result, pause/resume and "point to the main server". */
export function CronPingCard() {
  const status = useServerFn(cronStatus);
  const saveKey = useServerFn(cronSaveKey);
  const delKey = useServerFn(cronDeleteKey);
  const sync = useServerFn(cronSync);
  const toggle = useServerFn(cronToggle);
  const q = useQuery({ queryKey: ["cron-status"], queryFn: () => status(), staleTime: 300000, refetchOnWindowFocus: false, retry: false });
  const [key, setKey] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState("");
  const d = q.data;

  async function run(id: string, fn: () => Promise<unknown>) {
    setBusy(id);
    try { await fn(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(""); }
  }
  const doSave = () => run("key", async () => { const r = await saveKey({ data: { key: key.trim() } }); toast.success(r.text); setKey(""); setEditing(false); void q.refetch(); });
  const doDel = () => { if (window.confirm("Remover a chave do cron-job.org do painel? Os pings que já existem lá continuam rodando.")) void run("del", async () => { await delKey(); toast.success("Chave removida."); void q.refetch(); }); };
  const doSync = () => run("sync", async () => { const r = await sync(); toast.success(r.text); void q.refetch(); });
  const doToggle = (id: number, enabled: boolean) => run(String(id), async () => { await toggle({ data: { jobId: id, enabled } }); toast.success(enabled ? "Retomado." : "Pausado."); void q.refetch(); });

  const showForm = editing || (d && !d.configured);
  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <AlarmClock className="h-5 w-5 text-primary" />
        <span className="font-medium">Manter acordado</span>
        {d?.configured && <span className={`rounded-full px-2 py-0.5 text-[11px] ${d.pingOk ? "bg-primary/20 text-primary" : "bg-destructive/15 text-destructive"}`}>{d.pingOk ? "Ativo" : "Precisa ajustar"}</span>}
        <Button size="icon" variant="ghost" className="ml-auto" aria-label="Atualizar pings" onClick={() => void q.refetch()}><RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} /></Button>
      </div>
      <p className="text-[11px] text-muted-foreground">O cron-job.org dá um toque no servidor principal a cada 10 minutos para ele não dormir. Quando você troca o principal, o toque muda sozinho; as reservas ficam sem toque para não gastar as horas grátis.</p>
      {q.isLoading && <p className="text-xs text-muted-foreground">Verificando…</p>}
      {d?.error && <p className="text-xs text-destructive">{d.error}</p>}
      {d?.configured && (
        <>
          <ul className="space-y-2">
            {d.jobs.map((j) => (
              <li key={j.id} className="flex items-center gap-3 rounded-md border border-border p-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${!j.enabled ? "bg-muted-foreground" : j.lastOk ? "bg-primary" : "bg-destructive"}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{j.label}{j.primary && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">Principal</span>}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{j.enabled ? `${j.every ? `a cada ${j.every} min` : "horário próprio"} · último toque ${ago(j.last)} · ${j.lastText}` : "Pausado"}</div>
                </div>
                <Switch checked={j.enabled} disabled={busy === String(j.id)} onCheckedChange={(v) => void doToggle(j.id, v)} aria-label={j.enabled ? `Pausar ${j.label}` : `Retomar ${j.label}`} />
              </li>
            ))}
            {!d.jobs.length && !d.error && <li className="text-xs text-muted-foreground">Nenhuma tarefa no cron-job.org ainda.</li>}
          </ul>
          <Button variant="outline" className="w-full" disabled={busy === "sync" || !d.primary} onClick={() => void doSync()}>
            <RefreshCw className="mr-1 h-4 w-4" /> {d.primary ? `Apontar o toque para ${d.primary}` : "Cadastre um servidor primeiro"}
          </Button>
          {!showForm && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <KeyRound className="h-3.5 w-3.5" /> Chave {d.key}
              <Button size="sm" variant="ghost" className="ml-auto h-7" onClick={() => setEditing(true)}>Trocar</Button>
              {d.source === "painel" && <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Remover chave" disabled={busy === "del"} onClick={doDel}><Trash2 className="h-3.5 w-3.5" /></Button>}
            </div>
          )}
        </>
      )}
      {showForm && (
        <div className="space-y-2 rounded-md border border-primary/40 p-3">
          <p className="text-[11px] text-muted-foreground">No cron-job.org: Configurações → API → Criar chave. Cole aqui.</p>
          <Input type="password" placeholder="Chave da API do cron-job.org" value={key} onChange={(e) => setKey(e.target.value)} />
          <div className="flex gap-2">
            <Button className="flex-1" disabled={key.trim().length < 20 || busy === "key"} onClick={() => void doSave()}>{busy === "key" ? "Testando…" : "Testar e salvar"}</Button>
            {editing && <Button variant="ghost" onClick={() => { setEditing(false); setKey(""); }}>Cancelar</Button>}
          </div>
        </div>
      )}
    </div>
  );
}
