import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { OctagonX, Play, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, Empty, NativeSelect, PageHead, Stat, head } from "@/components/ui-kit";
import { getHealth, getKillSwitch, listAudit, setKillSwitch } from "@/lib/ops.functions";
import { download, toCsv } from "@/lib/store";

export const Route = createFileRoute("/sistema")({
  head: () => head("Atividades e saúde", "Histórico de operações, saúde dos serviços e botão para parar todas as automações."),
  component: SystemPage,
});

const MODULES = ["", "meta", "campanhas", "tarefas", "sistema", "products", "orders", "contacts", "automations", "monitor_rules", "offer_radar", "sales_pages", "creatives", "copies"];

function SystemPage() {
  const qc = useQueryClient();
  const [module, setModule] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const health = useQuery({ queryKey: ["health"], queryFn: () => getHealth(), refetchInterval: 60000 });
  const kill = useQuery({ queryKey: ["kill"], queryFn: () => getKillSwitch() });
  const audit = useQuery({ queryKey: ["audit", module], queryFn: () => listAudit({ data: { module: module || undefined, limit: 300 } }) });
  const hb = health.data?.heartbeat;
  const minutes = hb ? Math.round((Date.now() - new Date(hb.at).getTime()) / 60000) : null;
  async function toggle() {
    const stopped = !kill.data?.stopped;
    if (stopped && !confirm("Parar TODAS as automações, agentes e tarefas agendadas até você retomar?")) return;
    try { await setKillSwitch({ data: { stopped } }); await qc.invalidateQueries({ queryKey: ["kill"] }); toast.success(stopped ? "Tudo parado." : "Retomado."); } catch (e) { toast.error((e as Error).message); }
  }
  return (
    <div className="space-y-5 p-4 pb-24 md:p-6">
      <PageHead title="Atividades e saúde" sub="Quem fez o quê, quando, e se os serviços estão vivos.">
        <Button variant="outline" size="sm" onClick={() => { void health.refetch(); void audit.refetch(); }}><RefreshCw className="h-4 w-4" />Atualizar</Button>
        <Button size="sm" variant={kill.data?.stopped ? "default" : "destructive"} onClick={toggle} disabled={kill.isLoading}>
          {kill.data?.stopped ? <><Play className="h-4 w-4" />Retomar tudo</> : <><OctagonX className="h-4 w-4" />Parar tudo</>}
        </Button>
      </PageHead>
      {kill.data?.stopped && <Card className="border-destructive text-sm text-destructive">Parada geral ativa: agentes, automações e agendamentos não executam nada.</Card>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Executor 24h" value={minutes === null ? "Sem sinal" : minutes <= 20 ? "Ativo" : "Atrasado"} hint={hb ? `última passada há ${minutes} min` : "aguardando a primeira passada"} />
        <Stat label="Tarefas na fila" value={health.data?.queued ?? "—"} />
        <Stat label="Tarefas com falha" value={health.data?.failedJobs ?? "—"} />
        <Stat label="Falhas em 24h" value={health.data?.failures24h ?? "—"} />
      </div>
      <Card>
        <div className="mb-2 text-sm font-medium">Integrações configuradas</div>
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(health.data?.channels ?? {}).map(([k, v]) => <span key={k} className={`rounded-full border px-2 py-0.5 ${v ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{k}: {v ? "ok" : "não configurado"}</span>)}
        </div>
      </Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-2xl">Histórico de operações</h2>
        <div className="flex gap-2">
          <NativeSelect value={module} onChange={(e) => setModule(e.target.value)}>{MODULES.map((m) => <option key={m} value={m}>{m || "Todos os módulos"}</option>)}</NativeSelect>
          <Button variant="outline" size="sm" onClick={() => download("auditoria.csv", toCsv((audit.data ?? []).map((a) => ({ data: a.created_at, ator: a.actor, modulo: a.module, acao: a.action, alvo: a.target ?? "", resultado: a.result, erro: a.error ?? "" }))))}>Exportar CSV</Button>
        </div>
      </div>
      {audit.isLoading ? <Empty>Carregando…</Empty> : !(audit.data ?? []).length ? <Empty>Nenhuma operação registrada.</Empty> : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {(audit.data ?? []).map((a) => (
            <div key={a.id} className="p-3 text-sm">
              <button className="flex w-full flex-wrap items-center gap-2 text-left" onClick={() => setOpen(open === a.id ? null : a.id)}>
                <span className={`h-2 w-2 rounded-full ${a.result === "ok" ? "bg-primary" : "bg-destructive"}`} />
                <span className="font-medium">{a.action}</span><span className="text-muted-foreground">{a.module}</span>
                <span className="truncate text-xs text-muted-foreground">{a.target}</span>
                <span className="ml-auto text-xs text-muted-foreground">{a.actor} · {new Date(a.created_at).toLocaleString("pt-BR")}</span>
              </button>
              {a.error && <div className="mt-1 text-xs text-destructive">{a.error}</div>}
              {open === a.id && (
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <pre className="max-h-60 overflow-auto rounded bg-muted p-2 text-[11px]">Antes: {JSON.stringify(a.before, null, 2)}</pre>
                  <pre className="max-h-60 overflow-auto rounded bg-muted p-2 text-[11px]">Depois: {JSON.stringify(a.after, null, 2)}</pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
