import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, Empty, PageHead, head } from "@/components/ui-kit";
import { PushButton } from "@/components/push-button";
import { listNotifications, markNotifications } from "@/lib/ops.functions";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/notificacoes")({
  head: () => head("Notificações", "Vendas, campanhas, falhas, tarefas concluídas e aprovações pendentes."),
  component: Notifications,
});

const KINDS: Record<string, string> = { campanha: "Campanhas", tarefa: "Tarefas", falha: "Falhas", venda: "Vendas", sistema: "Sistema", aprovacao: "Aprovações" };

function Notifications() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["notifications"], queryFn: () => listNotifications({ data: { limit: 300 } }) });
  const [filter, setFilter] = useState("todas");
  const [prefs, setPrefs] = useStore<Record<string, boolean>>("notification-prefs", {});
  const rows = (q.data ?? []).filter((n) => (filter === "todas" || n.kind === filter) && prefs[n.kind] !== false);
  const act = async (d: { ids?: string[]; clear?: boolean }) => { try { await markNotifications({ data: d }); await qc.invalidateQueries({ queryKey: ["notifications"] }); } catch (e) { toast.error((e as Error).message); } };
  return (
    <div className="space-y-4 p-4 pb-24 md:p-6">
      <PageHead title="Notificações" sub="Tudo que os agentes, automações e tarefas registraram.">
        <Button variant="outline" size="sm" onClick={() => act({})}><CheckCheck className="h-4 w-4" />Marcar lidas</Button>
        <Button variant="outline" size="sm" onClick={() => act({ clear: true })}><Trash2 className="h-4 w-4" />Limpar lidas</Button>
      </PageHead>
      <div className="flex flex-wrap gap-1.5">
        {["todas", ...Object.keys(KINDS)].map((k) => <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} className="h-7 text-xs" onClick={() => setFilter(k)}>{k === "todas" ? "Todas" : KINDS[k]}</Button>)}
      </div>
      {q.isLoading ? <Empty>Carregando…</Empty> : q.error ? <Empty>{(q.error as Error).message}</Empty> : !rows.length ? <Empty>Nenhuma notificação.</Empty> : (
        <div className="space-y-2">
          {rows.map((n) => (
            <Card key={n.id} className={`flex items-start gap-3 py-3 ${n.read_at ? "opacity-60" : ""}`}>
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.kind === "falha" ? "bg-destructive" : n.read_at ? "bg-muted-foreground" : "bg-primary"}`} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{n.title}</div>
                {n.body && <div className="text-xs text-muted-foreground">{n.body}</div>}
                <div className="mt-1 text-[11px] text-muted-foreground">{KINDS[n.kind] ?? n.kind} · {new Date(n.created_at).toLocaleString("pt-BR")}</div>
              </div>
              {n.link && <Link to={n.link} onClick={() => !n.read_at && act({ ids: [n.id] })} className="text-xs text-primary">Abrir</Link>}
              {!n.read_at && <button className="text-xs text-muted-foreground" onClick={() => act({ ids: [n.id] })}>Lida</button>}
            </Card>
          ))}
        </div>
      )}
      <Card className="space-y-3">
        <div className="text-sm font-medium">Preferências</div>
        <div className="flex flex-wrap gap-3">
          {Object.entries(KINDS).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={prefs[k] !== false} onChange={(e) => setPrefs({ ...prefs, [k]: e.target.checked })} />{label}</label>
          ))}
        </div>
        <div className="text-xs text-muted-foreground">Avisos no celular (app instalado):</div>
        <PushButton />
      </Card>
    </div>
  );
}
