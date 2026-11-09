import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Pause, Play, Plus, RotateCw, Trash2, ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, Empty, Field, NativeSelect, PageHead, Stat, head } from "@/components/ui-kit";
import { useStore, uid } from "@/lib/store";
import { TRIGGERS, runEngine, type Automation, type RunLog, type Step, type Trigger } from "@/lib/automation";
import type { Order, Product } from "@/lib/biz";
import { sendMessage } from "@/lib/channels.functions";

export const Route = createFileRoute("/automacoes")({
  head: () => head("Automações", "Recuperação de Pix e carrinho, pós-venda e mensagens por WhatsApp, e-mail e Telegram."),
  component: AutomationsRoute,
});

const TEMPLATES: { name: string; trigger: Trigger; steps: Step[] }[] = [
  { name: "Recuperar Pix não pago", trigger: "pix_nao_pago", steps: [{ type: "esperar", minutes: 15 }, { type: "whatsapp", message: "Oi {nome}! Seu Pix de R$ {valor} do {produto} ainda está aguardando. Posso ajudar a finalizar?" }, { type: "esperar", minutes: 60 }, { type: "email", message: "Seu pedido está reservado\nOlá {nome}, finalize aqui: {checkout}" }] },
  { name: "Boas-vindas pós-compra", trigger: "pagamento_aprovado", steps: [{ type: "whatsapp", message: "Parabéns {nome}! Seu acesso ao {produto}: {entrega}" }, { type: "tag", tag: "cliente" }] },
  { name: "Recusado → tentar Pix", trigger: "pagamento_recusado", steps: [{ type: "whatsapp", message: "{nome}, seu cartão foi recusado. Quer pagar por Pix? {checkout}" }] },
];

function AutomationsRoute() {
  const [autos, setAutos] = useStore<Automation[]>("automations", []);
  const [logs, setLogs] = useStore<RunLog[]>("automation-logs", []);
  const [orders] = useStore<Order[]>("orders", []);
  const [products] = useStore<Product[]>("products", []);
  const [contacts, setContacts] = useStore<any[]>("contacts", []);
  const [sel, setSel] = useState("");
  const [running, setRunning] = useState(false);
  const send = useServerFn(sendMessage);
  const a = autos.find((x) => x.id === sel) ?? autos[0];
  const patch = (p: Partial<Automation>) => a && setAutos(autos.map((x) => (x.id === a.id ? { ...x, ...p } : x)));
  const setStep = (i: number, s: Step) => a && patch({ steps: a.steps.map((x, j) => (j === i ? s : x)) });

  async function runAll(only?: { automationId: string; key: string }) {
    setRunning(true);
    const { out, tags } = await runEngine({ autos, orders, products, logs, only, newId: uid, send: async (channel, to, text) => send({ data: { channel, to, text } }) });
    if (tags.length) setContacts((cs: any[]) => cs.map((c) => { const add = tags.filter((t) => (t.phone && c.phone === t.phone) || (t.email && c.email === t.email)).map((t) => t.tag); return add.length ? { ...c, tags: [...new Set([...(c.tags ?? []), ...add])] } : c; }));
    setLogs([...out, ...logs.filter((l) => !out.some((o) => o.automationId === l.automationId && o.key === l.key))].slice(0, 500));
    setRunning(false);
    toast.success(`${out.length} execução(ões) processadas`);
  }

  const ok = logs.filter((l) => l.status === "ok").length;
  const fail = logs.filter((l) => l.status === "falhou").length;
  return (
    <div className="space-y-4 p-4 pb-24 md:p-6">
      <PageHead title="Automações" sub="Gatilhos, condições, esperas e mensagens. Rodam sozinhas 24h no servidor, mesmo com o app fechado. Executar agora força uma passada.">
        <Button onClick={() => runAll()} disabled={running}><Play className="h-4 w-4" /> {running ? "Executando…" : "Executar agora"}</Button>
      </PageHead>
      <div className="grid grid-cols-3 gap-3"><Stat label="Automações ativas" value={autos.filter((x) => x.active).length} /><Stat label="Sucesso" value={ok} /><Stat label="Falhas" value={fail} /></div>
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <div className="space-y-2">
          <Button className="w-full" onClick={() => { const n: Automation = { id: uid(), name: "Nova automação", trigger: "pix_nao_pago", productId: "", steps: [], active: false }; setAutos([n, ...autos]); setSel(n.id); }}><Plus className="h-4 w-4" /> Em branco</Button>
          {TEMPLATES.map((t) => <Button key={t.name} variant="outline" className="w-full justify-start text-xs" onClick={() => { const n: Automation = { id: uid(), name: t.name, trigger: t.trigger, productId: "", steps: t.steps, active: false }; setAutos([n, ...autos]); setSel(n.id); }}>+ {t.name}</Button>)}
          {autos.map((x) => (
            <button key={x.id} onClick={() => setSel(x.id)} className={`flex w-full items-center gap-2 rounded-lg border p-3 text-left text-sm ${a?.id === x.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
              <span className={`h-2 w-2 rounded-full ${x.active ? "bg-primary" : "bg-muted-foreground"}`} /><span className="truncate">{x.name}</span>
            </button>
          ))}
        </div>
        {!a ? <Empty>Escolha um modelo ou crie uma automação.</Empty> : (
          <div className="space-y-3">
            <Card className="grid gap-3 sm:grid-cols-3">
              <Field label="Nome"><Input value={a.name} onChange={(e) => patch({ name: e.target.value })} /></Field>
              <Field label="Gatilho"><NativeSelect value={a.trigger} onChange={(e) => patch({ trigger: e.target.value as Trigger })}>{Object.entries(TRIGGERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect></Field>
              <Field label="Produto"><NativeSelect value={a.productId} onChange={(e) => patch({ productId: e.target.value })}><option value="">Todos</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</NativeSelect></Field>
            </Card>
            <div className="mx-auto w-fit rounded-full border-2 border-primary bg-primary/15 px-4 py-2 text-sm font-medium">⚡ Quando: {TRIGGERS[a.trigger]}</div>
            {a.steps.map((s, i) => (
              <div key={i}>
              <div className="flex flex-col items-center">
                <span className="h-4 w-0.5 bg-primary/50" />
                <button title="Inserir etapa aqui" className="grid h-6 w-6 place-items-center rounded-full border border-primary/60 text-xs text-primary hover:bg-primary/20" onClick={() => patch({ steps: [...a.steps.slice(0, i), { type: "esperar", minutes: 30 }, ...a.steps.slice(i)] })}>+</button>
                <span className="h-4 w-0.5 bg-primary/50" />
              </div>
              <Card className={`space-y-2 border-l-4 ${s.type === "esperar" ? "border-l-muted-foreground" : s.type === "condicao" ? "border-l-chart-4" : s.type === "tag" || s.type === "webhook" ? "border-l-chart-2" : "border-l-primary"}`}>
                <div className="flex items-center gap-2">
                  <span className="font-display text-lg text-primary">{i + 1}</span>
                  <NativeSelect value={s.type} onChange={(e) => {
                    const t = e.target.value as Step["type"];
                    setStep(i, t === "esperar" ? { type: t, minutes: 30 } : t === "condicao" ? { type: t, field: "valor", op: ">", value: "0", else: "parar" } : t === "webhook" ? { type: t, url: "https://" } : t === "tag" ? { type: t, tag: "" } : { type: t, message: "" });
                  }}>
                    <option value="esperar">Esperar</option><option value="condicao">Condição</option><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option><option value="telegram">Telegram</option><option value="webhook">Webhook</option><option value="tag">Adicionar tag</option>
                  </NativeSelect>
                  <div className="ml-auto flex">
                    <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => { const st = [...a.steps]; [st[i - 1], st[i]] = [st[i]!, st[i - 1]!]; patch({ steps: st }); }}><ArrowUp className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" disabled={i === a.steps.length - 1} onClick={() => { const st = [...a.steps]; [st[i + 1], st[i]] = [st[i]!, st[i + 1]!]; patch({ steps: st }); }}><ArrowDown className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => patch({ steps: a.steps.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                {s.type === "esperar" && <Field label="Minutos"><Input type="number" value={s.minutes} onChange={(e) => setStep(i, { ...s, minutes: Number(e.target.value) })} /></Field>}
                {s.type === "condicao" && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <NativeSelect value={s.field} onChange={(e) => setStep(i, { ...s, field: e.target.value })}>{["valor", "metodo", "status", "produto", "utm_campaign"].map((f) => <option key={f}>{f}</option>)}</NativeSelect>
                    <NativeSelect value={s.op} onChange={(e) => setStep(i, { ...s, op: e.target.value as any })}>{["=", "!=", ">", "<", "contem"].map((f) => <option key={f}>{f}</option>)}</NativeSelect>
                    <Input value={s.value} onChange={(e) => setStep(i, { ...s, value: e.target.value })} />
                    <NativeSelect value={s.else} onChange={(e) => setStep(i, { ...s, else: e.target.value as any })}><option value="parar">Se falso: parar</option><option value="continuar">Se falso: continuar</option></NativeSelect>
                  </div>
                )}
                {(s.type === "whatsapp" || s.type === "email" || s.type === "telegram") && <Textarea value={s.message} onChange={(e) => setStep(i, { ...s, message: e.target.value })} placeholder="Use {nome} {valor} {produto} {checkout} {entrega}" />}
                {s.type === "webhook" && <Input value={s.url} onChange={(e) => setStep(i, { ...s, url: e.target.value })} />}
                {s.type === "tag" && <Input value={s.tag} onChange={(e) => setStep(i, { ...s, tag: e.target.value })} placeholder="nome da tag" />}
                {s.type === "condicao" && <p className="text-xs text-muted-foreground">✔ Verdadeiro → segue para a próxima etapa · ✖ Falso → {s.else === "parar" ? "encerra o fluxo" : "pula esta verificação e segue"}</p>}
              </Card>
              </div>
            ))}
            <div className="flex justify-center"><span className="h-4 w-0.5 bg-primary/50" /></div>
            <div className="mx-auto w-fit rounded-full border border-border px-4 py-1 text-xs text-muted-foreground">Fim do fluxo</div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => patch({ steps: [...a.steps, { type: "whatsapp", message: "" }] })}><Plus className="h-4 w-4" /> Etapa</Button>
              <Button variant={a.active ? "outline" : "default"} onClick={() => patch({ active: !a.active })}>{a.active ? <><Pause className="h-4 w-4" /> Pausar</> : <><Play className="h-4 w-4" /> Ativar</>}</Button>
              <Button variant="ghost" onClick={() => { setAutos(autos.filter((x) => x.id !== a.id)); setSel(""); }}><Trash2 className="h-4 w-4" /> Excluir</Button>
            </div>
            <Card className="space-y-1">
              <h2 className="font-display text-xl">Histórico</h2>
              {logs.filter((l) => l.automationId === a.id).length === 0 && <p className="text-sm text-muted-foreground">Sem execuções ainda.</p>}
              {logs.filter((l) => l.automationId === a.id).slice(0, 50).map((l) => (
                <div key={l.id} className="flex items-center gap-2 text-xs">
                  <span className={l.status === "ok" ? "text-primary" : l.status === "falhou" ? "text-destructive" : "text-muted-foreground"}>{l.status}</span>
                  <span className="text-muted-foreground">{new Date(l.at).toLocaleString("pt-BR")} · pedido {l.key.slice(0, 6)} · tentativa {l.attempts}</span>
                  <span className="truncate">{l.detail}</span>
                  {l.status === "falhou" && <Button size="sm" variant="ghost" className="ml-auto h-6" onClick={() => runAll({ automationId: a.id, key: l.key })}><RotateCw className="h-3 w-3" /></Button>}
                </div>
              ))}
            </Card>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{contacts.length} contatos no CRM recebem as tags aplicadas aqui.</p>
    </div>
  );
}
