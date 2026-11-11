import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bell, Play, Plus, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, Empty, Field, NativeSelect, PageHead, Stat, head } from "@/components/ui-kit";
import { AccountBar } from "@/components/account-bar";
import { PushButton } from "@/components/push-button";
import { useStore, uid } from "@/lib/store";
import { useAccount, actionValue } from "@/lib/use-account";
import { evaluate, type CampaignStats, type Decision, type IntelRule } from "@/lib/intel";
import { getObjects, updateObject } from "@/lib/meta.functions";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/inteligencia")({
  head: () => head("Inteligência de campanhas", "Agentes que vigiam gasto, vendas, CPA, ROAS e frequência e agem sozinhos ou pedem aprovação."),
  component: IntelRoute,
});

type Entry = { id: string; at: number; ruleId: string; campaignId: string; campaign: string; decision: Decision; state: "executado" | "pendente" | "recusado" | "aviso" | "erro" };
const PURCHASE = ["purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase"];

const blank = (): IntelRule => ({ id: uid(), name: "Teste de criativo", profile: "teste", campaignId: "*", maxSpendNoSale: 30, maxCpa: 0, minRoasToScale: 0, scalePercent: 20, maxDailyBudget: 0, maxFrequency: 0, hours: [0, 24], autonomy: "auto", active: true });

type LogRow = { id: string; created_at: string; target_id: string | null; campaign_name: string | null; action: string; detail: string | null; state: string; new_budget: number | null };

function CloudWatch() {
  const update = useServerFn(updateObject);
  const log = useQuery({
    queryKey: ["watch-log"], refetchInterval: 60_000,
    queryFn: async () => ((await supabase.from("watch_log").select("*").order("created_at", { ascending: false }).limit(50)).data ?? []) as unknown as LogRow[],
  });
  const setState = async (id: string, state: string) => { await supabase.from("watch_log").update({ state }).eq("id", id); log.refetch(); };
  async function approve(r: LogRow) {
    try {
      if (!r.target_id) return;
      if (r.action === "pausar") await update({ data: { id: r.target_id, status: "PAUSED" } });
      if (r.action === "ativar") await update({ data: { id: r.target_id, status: "ACTIVE" } });
      if ((r.action === "escalar" || r.action === "reduzir") && r.new_budget) await update({ data: { id: r.target_id, daily_budget: Number(r.new_budget) } });
      await setState(r.id, "executado"); toast.success("Feito, chefe.");
    } catch (e) { toast.error(String(e)); await setState(r.id, "erro"); }
  }
  const pend = log.data?.filter((r) => r.state === "pendente").length ?? 0;
  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between"><div className="font-semibold">Vigia 24h na nuvem</div><span className="text-xs text-muted-foreground">{pend} aguardando aprovação</span></div>
      {!log.data?.length ? <p className="text-xs text-muted-foreground">Nenhuma decisão da nuvem ainda. Ela começa assim que o agendador externo estiver chamando a vigia.</p> : (
        <div className="divide-y divide-border">
          {log.data.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
              <span className="font-medium">{r.campaign_name}</span><span className="text-primary">{r.action}</span>
              <span className="text-muted-foreground">{r.detail}</span><span className="ml-auto text-xs uppercase">{r.state}</span>
              {r.state === "pendente" && <>
                <Button size="icon" variant="ghost" onClick={() => approve(r)}><Check className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => setState(r.id, "recusado")}><X className="h-4 w-4" /></Button>
              </>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function IntelRoute() {
  const [account, setAccount] = useAccount();
  const [rules, setRules] = useStore<IntelRule[]>("intel-rules", []);
  const [history, setHistory] = useStore<Entry[]>("intel-history", []);
  const [interval, setIntervalMin] = useStore<number>("intel-interval", 15);
  const [campaigns, setCampaigns] = useState<CampaignStats[]>([]);
  const [watching, setWatching] = useState(false);
  const [last, setLast] = useState<number>(0);
  const fetchObjects = useServerFn(getObjects);
  const update = useServerFn(updateObject);
  const ref = useRef<() => void>(() => {});

  const notify = (title: string, body: string) => {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") navigator.serviceWorker?.ready.then((r) => r.showNotification(title, { body, icon: "/icon-192.png" })).catch(() => new Notification(title, { body }));
  };

  async function apply(e: Entry) {
    try {
      if (e.decision.kind === "pausar") await update({ data: { id: e.campaignId, status: "PAUSED" } });
      if (e.decision.kind === "escalar" && e.decision.newBudget) await update({ data: { id: e.campaignId, daily_budget: e.decision.newBudget } });
      return "executado" as const;
    } catch { return "erro" as const; }
  }

  async function check() {
    if (!account) return;
    const raw: any[] = await fetchObjects({ data: { accountId: account, level: "campaigns", datePreset: "today" } }).catch(() => []);
    const stats: CampaignStats[] = raw.map((c) => ({
      id: c.id, accountId: account, name: c.name, status: c.effective_status ?? c.status, dailyBudget: Number(c.daily_budget ?? 0),
      spend: Number(c.insights?.spend ?? 0), frequency: Number(c.insights?.frequency ?? 0),
      purchases: actionValue(c.insights?.actions, PURCHASE), revenue: actionValue(c.insights?.action_values, PURCHASE),
    }));
    setCampaigns(stats); setLast(Date.now());
    const hour = new Date().getHours();
    const fresh: Entry[] = [];
    for (const r of rules) for (const c of stats) {
      const d = evaluate(r, c, hour);
      if (!d) continue;
      const recent = history.some((h) => h.ruleId === r.id && h.campaignId === c.id && h.decision.kind === d.kind && Date.now() - h.at < 6 * 3600e3 && h.state !== "erro");
      if (recent) continue;
      const e: Entry = { id: uid(), at: Date.now(), ruleId: r.id, campaignId: c.id, campaign: c.name, decision: d, state: "pendente" };
      if (d.kind === "alerta" || r.autonomy === "avisar") e.state = "aviso";
      else if (r.autonomy === "auto") e.state = await apply(e);
      fresh.push(e);
      notify(`Crowley · ${c.name}`, `${d.kind === "pausar" ? "Pausar" : d.kind === "escalar" ? "Escalar" : "Alerta"}: ${d.reason} (${e.state})`);
    }
    if (fresh.length) setHistory((h) => [...fresh, ...h].slice(0, 300));
  }
  ref.current = check;
  useEffect(() => {
    if (!watching) return;
    ref.current();
    const t = setInterval(() => ref.current(), Math.max(5, interval) * 60000);
    return () => clearInterval(t);
  }, [watching, interval, account]);

  const patch = (id: string, p: Partial<IntelRule>) => setRules(rules.map((r) => (r.id === id ? { ...r, ...p } : r)));
  return (
    <div className="space-y-4 p-4 pb-24 md:p-6">
      <PageHead title="Inteligência" sub="Perfis de teste, escala e manutenção com limites, horários e autonomia.">
        <PushButton />
        <Button onClick={() => setWatching(!watching)} variant={watching ? "outline" : "default"}><Play className="h-4 w-4" /> {watching ? "Parar vigia" : "Iniciar vigia"}</Button>
      </PageHead>
      <AccountBar account={account} setAccount={setAccount} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Regras ativas" value={rules.filter((r) => r.active).length} />
        <Stat label="Campanhas vigiadas" value={campaigns.filter((c) => c.status === "ACTIVE").length} />
        <Stat label="Ações hoje" value={history.filter((h) => h.state === "executado" && Date.now() - h.at < 864e5).length} />
        <Stat label="Última checagem" value={last ? new Date(last).toLocaleTimeString("pt-BR") : "—"} />
      </div>
      <Card className="flex flex-wrap items-center gap-2 text-sm">
        Checar a cada <Input type="number" className="w-20" value={interval} onChange={(e) => setIntervalMin(Number(e.target.value))} /> minutos.
        <Button size="sm" variant="outline" onClick={check}>Checar agora</Button>
        <span className="text-xs text-muted-foreground">Com o app aberto, checa no intervalo acima. Com o app fechado, a vigia 24h na nuvem usa as mesmas regras e a conta selecionada.</span>
      </Card>
      <CloudWatch />

      <div className="flex items-center justify-between"><h2 className="font-display text-2xl">Regras</h2><Button size="sm" onClick={() => setRules([{ ...blank(), accountId: account, name: "Nova estratégia", maxSpendNoSale: 0, autonomy: "aprovar", active: false }, ...rules])}><Plus className="h-4 w-4" /> Regra manual</Button></div>
      {rules.length === 0 && <Empty>Ex.: “Se a campanha X gastar R$ 30 e não vender, pausar.” Toque em “Regra”.</Empty>}
      {rules.map((r) => (
        <Card key={r.id} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Nome"><Input value={r.name} onChange={(e) => patch(r.id, { name: e.target.value })} /></Field>
          <Field label="Perfil"><NativeSelect value={r.profile} onChange={(e) => patch(r.id, { profile: e.target.value as any })}><option value="teste">Teste de criativo</option><option value="escala">Escala</option><option value="manutencao">Manutenção</option></NativeSelect></Field>
          <Field label="Campanha"><NativeSelect value={r.campaignId} onChange={(e) => patch(r.id, { campaignId: e.target.value })}><option value="*">Todas ativas</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></Field>
          <Field label="Autonomia"><NativeSelect value={r.autonomy} onChange={(e) => patch(r.id, { autonomy: e.target.value as any })}><option value="auto">Agir sozinho</option><option value="aprovar">Pedir aprovação</option><option value="avisar">Só avisar</option></NativeSelect></Field>
          <Field label="Pausar se gastar sem vender (moeda da conta)"><Input type="number" value={r.maxSpendNoSale} onChange={(e) => patch(r.id, { maxSpendNoSale: Number(e.target.value) })} /></Field>
          <Field label="Pausar se CPA acima de"><Input type="number" value={r.maxCpa} onChange={(e) => patch(r.id, { maxCpa: Number(e.target.value) })} /></Field>
          <Field label="Alerta se frequência acima de"><Input type="number" value={r.maxFrequency} onChange={(e) => patch(r.id, { maxFrequency: Number(e.target.value) })} /></Field>
          <Field label="Horário (de/até)"><div className="flex gap-1"><Input type="number" value={r.hours[0]} onChange={(e) => patch(r.id, { hours: [Number(e.target.value), r.hours[1]] })} /><Input type="number" value={r.hours[1]} onChange={(e) => patch(r.id, { hours: [r.hours[0], Number(e.target.value)] })} /></div></Field>
          {r.profile === "escala" && <>
            <Field label="Escalar se ROAS ≥"><Input type="number" value={r.minRoasToScale} onChange={(e) => patch(r.id, { minRoasToScale: Number(e.target.value) })} /></Field>
            <Field label="Aumento de orçamento (%)"><Input type="number" value={r.scalePercent} onChange={(e) => patch(r.id, { scalePercent: Number(e.target.value) })} /></Field>
            <Field label="Teto diário (centavos da conta)"><Input type="number" value={r.maxDailyBudget} onChange={(e) => patch(r.id, { maxDailyBudget: Number(e.target.value) })} /></Field>
          </>}
          <div className="flex items-end gap-2">
            <Button size="sm" variant={r.active ? "default" : "outline"} onClick={() => patch(r.id, { active: !r.active })}>{r.active ? "Ativa" : "Pausada"}</Button>
            <Button size="icon" variant="ghost" onClick={() => setRules(rules.filter((x) => x.id !== r.id))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </Card>
      ))}
      <h2 className="font-display text-2xl">Histórico de decisões</h2>
      {history.length === 0 ? <Empty>Nenhuma decisão ainda.</Empty> : (
        <Card className="divide-y divide-border p-0">
          {history.slice(0, 100).map((h) => (
            <div key={h.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
              <span className="text-xs text-muted-foreground">{new Date(h.at).toLocaleString("pt-BR")}</span>
              <span className="font-medium">{h.campaign}</span>
              <span className="text-primary">{h.decision.kind}</span>
              <span className="text-muted-foreground">{h.decision.reason}</span>
              <span className="ml-auto text-xs uppercase">{h.state}</span>
              {h.state === "pendente" && <>
                <Button size="icon" variant="ghost" onClick={async () => { const s = await apply(h); setHistory(history.map((x) => (x.id === h.id ? { ...x, state: s } : x))); }}><Check className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => setHistory(history.map((x) => (x.id === h.id ? { ...x, state: "recusado" } : x)))}><X className="h-4 w-4" /></Button>
              </>}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
