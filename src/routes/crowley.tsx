import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Bell, Send, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AccountBar } from "@/components/account-bar";
import { getObjects, updateObject } from "@/lib/meta.functions";
import { crowleyChat } from "@/lib/crowley.functions";
import { actionValue, brl, useAccount } from "@/lib/use-account";
import { useCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/crowley")({
  head: () => ({
    meta: [
      { title: "Crowley — Bat Gotham" },
      { name: "description", content: "Assistente que analisa e cuida das suas campanhas." },
      { property: "og:title", content: "Crowley — Bat Gotham" },
      { property: "og:description", content: "Assistente que analisa e cuida das suas campanhas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CrowleyPage,
});

type Msg = { role: "user" | "assistant"; content: string };
type Rule = { id: string; campaignId: string; name: string; maxSpend: number; active: boolean; last?: string };
const SALE = ["purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase"];

function notify(title: string, body: string) {
  toast(title, { description: body });
  if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(title, { body, icon: "/icon-192.png" });
}

function CrowleyPage() {
  useCurrency();
  const [account, setAccount] = useAccount();
  const [provider, setProvider] = useState<"deepseek" | "ollama">("deepseek");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [rules, setRules] = useState<Rule[]>([]);
  const [draft, setDraft] = useState({ campaignId: "", maxSpend: "30" });
  const end = useRef<HTMLDivElement>(null);

  const camps = useQuery({
    queryKey: ["crowley-camps", account],
    enabled: !!account,
    queryFn: () => getObjects({ data: { accountId: account, level: "campaigns", datePreset: "today" } }),
    refetchInterval: 5 * 60_000,
  });

  useEffect(() => {
    setRules(JSON.parse(localStorage.getItem("batgotham.rules") ?? "[]"));
    const p = localStorage.getItem("batgotham.provider");
    if (p === "ollama" || p === "deepseek") setProvider(p);
  }, []);
  const saveRules = (r: Rule[]) => { setRules(r); localStorage.setItem("batgotham.rules", JSON.stringify(r)); };
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [msgs]);

  // Vigia: confere as regras sempre que os números chegam (a cada 5 min com o app aberto)
  useEffect(() => {
    if (!camps.data) return;
    rules.filter((r) => r.active).forEach(async (r) => {
      const c = camps.data.find((x: any) => x.id === r.campaignId);
      if (!c || c.status !== "ACTIVE") return;
      const spend = Number(c.insights?.spend ?? 0);
      const sales = actionValue(c.insights?.actions, SALE);
      if (spend > r.maxSpend && sales === 0) {
        try {
          await updateObject({ data: { id: r.campaignId, status: "PAUSED" } });
          notify("Crowley pausou uma campanha", `${c.name} gastou ${brl(spend)} hoje sem vendas.`);
          saveRules(rules.map((x) => (x.id === r.id ? { ...x, active: false, last: `Pausada em ${new Date().toLocaleString("pt-BR")}` } : x)));
          camps.refetch();
        } catch (e) {
          notify("Crowley não conseguiu pausar", (e as Error).message);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camps.data]);

  const context = () =>
    (camps.data ?? [])
      .map((c: any) => `- ${c.name} (id ${c.id}) status ${c.status}, orçamento diário ${c.daily_budget ? Number(c.daily_budget) / 100 : "—"}, gasto hoje ${c.insights?.spend ?? 0}, vendas hoje ${actionValue(c.insights?.actions, SALE)}`)
      .join("\n");

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...msgs, { role: "user" as const, content: text }];
    setMsgs(next); setInput(""); setBusy(true);
    try {
      const r = await crowleyChat({ data: { provider, messages: next.slice(-20), context: context() } });
      if ("error" in r && r.error) toast.error(r.error);
      else setMsgs([...next, { role: "assistant", content: r.text ?? "" }]);
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  }

  async function runAction(a: { id: string; status: "ACTIVE" | "PAUSED" }) {
    try {
      await updateObject({ data: { id: a.id, status: a.status } });
      toast.success(a.status === "PAUSED" ? "Campanha pausada" : "Campanha ativada");
      camps.refetch();
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-4 p-3 pb-24 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl tracking-wide">Crowley</h1>
        <div className="flex gap-2">
          <Select value={provider} onValueChange={(v) => { setProvider(v as any); localStorage.setItem("batgotham.provider", v); }}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="deepseek">DeepSeek</SelectItem><SelectItem value="ollama">Ollama</SelectItem></SelectContent>
          </Select>
          <Button variant="secondary" size="sm" onClick={async () => {
            if (typeof Notification === "undefined") { toast.error("Este navegador não suporta notificações."); return; }
            const p = await Notification.requestPermission();
            if (p === "granted") notify("Notificações ligadas", "O Crowley vai te avisar por aqui.");
            else toast.error("Permissão negada.");
          }}><Bell className="mr-1 h-4 w-4" />Notificações</Button>
        </div>
      </div>
      <AccountBar account={account} setAccount={setAccount} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="flex h-[60vh] flex-col rounded-lg border border-border bg-card">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {!msgs.length && <p className="text-sm text-muted-foreground">Às suas ordens. Peça uma análise das campanhas de hoje, ou para pausar/ativar alguma.</p>}
            {msgs.map((m, i) => {
              const match = m.content.match(/ACAO:\s*(\{.*\})/);
              let act: any = null;
              try { act = match ? JSON.parse(match[1]!) : null; } catch {}
              return (
                <div key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-secondary"}`}>
                  {m.content.replace(/ACAO:.*$/s, "").trim()}
                  {act?.id && (
                    <Button size="sm" className="mt-2 block" onClick={() => runAction(act)}>
                      Confirmar: {act.status === "PAUSED" ? "pausar" : "ativar"} {(camps.data ?? []).find((c: any) => c.id === act.id)?.name ?? act.id}
                    </Button>
                  )}
                </div>
              );
            })}
            {busy && <div className="text-sm text-muted-foreground">Crowley está pensando…</div>}
            <div ref={end} />
          </div>
          <div className="flex gap-2 border-t border-border p-3">
            <Textarea rows={1} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Fale com o Crowley…"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} className="min-h-10 resize-none" />
            <Button onClick={send} disabled={busy}><Send className="h-4 w-4" /></Button>
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-primary" />Vigiar campanhas</h2>
          <p className="text-xs text-muted-foreground">Se a campanha gastar mais que o limite hoje sem vender, o Crowley pausa e te avisa. Confere a cada 5 minutos enquanto o app estiver aberto.</p>
          <Select value={draft.campaignId} onValueChange={(v) => setDraft({ ...draft, campaignId: v })}>
            <SelectTrigger><SelectValue placeholder="Escolha a campanha" /></SelectTrigger>
            <SelectContent>{(camps.data ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex gap-2">
            <Input type="number" value={draft.maxSpend} onChange={(e) => setDraft({ ...draft, maxSpend: e.target.value })} placeholder="Limite de gasto" />
            <Button disabled={!draft.campaignId} onClick={() => {
              const c = camps.data?.find((x: any) => x.id === draft.campaignId);
              saveRules([...rules, { id: crypto.randomUUID(), campaignId: draft.campaignId, name: c?.name ?? draft.campaignId, maxSpend: Number(draft.maxSpend), active: true }]);
            }}>Vigiar</Button>
          </div>
          <ul className="space-y-2">
            {rules.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-2 rounded-md bg-secondary p-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">Pausar se gastar {r.maxSpend} sem venda · {r.active ? "vigiando" : r.last ?? "parada"}</div>
                </div>
                <button onClick={() => saveRules(rules.filter((x) => x.id !== r.id))} className="text-muted-foreground"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
