import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Pause, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, Empty, Field, NativeSelect, PageHead, Stat, head } from "@/components/ui-kit";
import { AccountBar } from "@/components/account-bar";
import { useAccount } from "@/lib/use-account";
import { getObjects } from "@/lib/meta.functions";
import { createJob, listJobs, setJobStatus } from "@/lib/ops.functions";

export const Route = createFileRoute("/agendamentos")({
  head: () => head("Agendamentos", "Lançar, pausar ou mudar orçamento de campanhas em data e hora marcadas, mensagens e lembretes."),
  component: Schedules,
});

const STATUS: Record<string, string> = { queued: "Na fila", running: "Executando", done: "Concluída", failed: "Falhou", cancelled: "Cancelada", paused: "Pausada" };
const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

function Schedules() {
  const qc = useQueryClient();
  const [account, setAccount] = useAccount();
  const jobs = useQuery({ queryKey: ["jobs"], queryFn: () => listJobs(), refetchInterval: 30000 });
  const camps = useQuery({ queryKey: ["sched-camps", account], enabled: !!account, queryFn: () => getObjects({ data: { accountId: account, level: "campaigns", datePreset: "today" } }), staleTime: 300000 });
  const [kind, setKind] = useState<"meta_update" | "message" | "notify">("meta_update");
  const [when, setWhen] = useState(local(new Date(Date.now() + 3600000)));
  const [target, setTarget] = useState({ id: "", action: "ACTIVE", budget: "" });
  const [msg, setMsg] = useState({ channel: "whatsapp" as "whatsapp" | "telegram" | "email", to: "", text: "" });
  const [note, setNote] = useState({ title: "", body: "" });
  const [busy, setBusy] = useState(false);

  async function schedule() {
    setBusy(true);
    try {
      const runAt = new Date(when).toISOString();
      let job: Parameters<typeof createJob>[0]["data"]["job"];
      if (kind === "meta_update") {
        const c = (camps.data ?? []).find((x: any) => x.id === target.id);
        if (!c) throw new Error("Escolha a campanha.");
        const budget = target.action === "BUDGET" ? Math.round(Number(target.budget) * 100) : undefined;
        if (target.action === "BUDGET" && !(budget! > 0)) throw new Error("Informe o novo orçamento diário.");
        const label = target.action === "BUDGET" ? `Orçamento de ${c.name} → ${target.budget}` : `${target.action === "ACTIVE" ? "Ativar" : "Pausar"} ${c.name}`;
        job = { kind: "meta_update", payload: { id: c.id, label, ...(budget ? { daily_budget: budget } : { status: target.action as "ACTIVE" | "PAUSED" }) } };
      } else if (kind === "message") job = { kind: "message", payload: { ...msg, label: `${msg.channel} para ${msg.to}` } };
      else job = { kind: "notify", payload: note };
      await createJob({ data: { job, runAt } });
      toast.success("Agendado. Roda no servidor mesmo com o app fechado.");
      await qc.invalidateQueries({ queryKey: ["jobs"] });
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  async function status(id: string, s: "cancelled" | "paused" | "queued") {
    try { await setJobStatus({ data: { id, status: s } }); await qc.invalidateQueries({ queryKey: ["jobs"] }); } catch (e) { toast.error((e as Error).message); }
  }
  const list = jobs.data ?? [];
  return (
    <div className="space-y-5 p-4 pb-24 md:p-6">
      <PageHead title="Agendamentos" sub="Executados pelo servidor a cada passada do executor 24h (com novas tentativas e sem repetir)." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Na fila" value={list.filter((j) => j.status === "queued").length} />
        <Stat label="Concluídas" value={list.filter((j) => j.status === "done").length} />
        <Stat label="Falhas" value={list.filter((j) => j.status === "failed").length} />
        <Stat label="Pausadas" value={list.filter((j) => j.status === "paused").length} />
      </div>
      <Card className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tipo"><NativeSelect value={kind} onChange={(e) => setKind(e.target.value as never)}><option value="meta_update">Campanha (ativar, pausar, orçamento)</option><option value="message">Mensagem</option><option value="notify">Lembrete</option></NativeSelect></Field>
          <Field label="Quando"><Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
        </div>
        {kind === "meta_update" && (
          <div className="space-y-3">
            <AccountBar account={account} setAccount={setAccount} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Campanha"><NativeSelect value={target.id} onChange={(e) => setTarget({ ...target, id: e.target.value })}><option value="">{camps.isLoading ? "Carregando…" : "Escolha"}</option>{(camps.data ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.effective_status})</option>)}</NativeSelect></Field>
              <Field label="Ação"><NativeSelect value={target.action} onChange={(e) => setTarget({ ...target, action: e.target.value })}><option value="ACTIVE">Ativar / lançar</option><option value="PAUSED">Pausar</option><option value="BUDGET">Mudar orçamento diário</option></NativeSelect></Field>
              {target.action === "BUDGET" && <Field label="Novo orçamento (moeda da conta)"><Input inputMode="decimal" value={target.budget} onChange={(e) => setTarget({ ...target, budget: e.target.value })} /></Field>}
            </div>
            <p className="text-xs text-muted-foreground">Para lançar amanhã: crie a campanha pausada em Criar campanha e agende "Ativar" aqui.</p>
          </div>
        )}
        {kind === "message" && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Canal"><NativeSelect value={msg.channel} onChange={(e) => setMsg({ ...msg, channel: e.target.value as never })}><option value="whatsapp">WhatsApp</option><option value="telegram">Telegram</option><option value="email">E-mail</option></NativeSelect></Field>
            <Field label="Para"><Input value={msg.to} onChange={(e) => setMsg({ ...msg, to: e.target.value })} /></Field>
            <Field label="Mensagem"><Textarea value={msg.text} onChange={(e) => setMsg({ ...msg, text: e.target.value })} /></Field>
          </div>
        )}
        {kind === "notify" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Título"><Input value={note.title} onChange={(e) => setNote({ ...note, title: e.target.value })} /></Field>
            <Field label="Detalhe"><Input value={note.body} onChange={(e) => setNote({ ...note, body: e.target.value })} /></Field>
          </div>
        )}
        <Button onClick={schedule} disabled={busy}><CalendarClock className="h-4 w-4" />{busy ? "Agendando…" : "Agendar"}</Button>
      </Card>
      {jobs.isLoading ? <Empty>Carregando…</Empty> : !list.length ? <Empty>Nada agendado.</Empty> : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {list.map((j) => (
            <div key={j.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
              <span className={`rounded-full border px-2 py-0.5 text-[11px] ${j.status === "failed" ? "border-destructive text-destructive" : j.status === "done" ? "border-primary text-primary" : "border-border"}`}>{STATUS[j.status] ?? j.status}</span>
              <span className="font-medium">{(j.payload as any)?.label ?? (j.payload as any)?.title ?? j.kind}</span>
              <span className="text-xs text-muted-foreground">{new Date(j.run_at).toLocaleString("pt-BR")} · tentativas {j.attempts}/{j.max_attempts}</span>
              {j.last_error && <span className="w-full text-xs text-destructive">{j.last_error}</span>}
              <div className="ml-auto flex gap-1">
                {j.status === "queued" && <Button size="sm" variant="ghost" onClick={() => status(j.id, "paused")}><Pause className="h-3 w-3" /></Button>}
                {(j.status === "paused" || j.status === "failed") && <Button size="sm" variant="ghost" onClick={() => status(j.id, "queued")}><Play className="h-3 w-3" /></Button>}
                {(j.status === "queued" || j.status === "paused") && <Button size="sm" variant="ghost" onClick={() => status(j.id, "cancelled")}><X className="h-3 w-3" /></Button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
