import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bot, Send, User, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, Empty, NativeSelect, PageHead, Stat, head } from "@/components/ui-kit";
import { useStore, uid } from "@/lib/store";
import type { Contact, Conversation, Message, Product } from "@/lib/biz";
import { sendMessage, supportReply } from "@/lib/channels.functions";
import { SupportBots } from "@/components/support-bots";
import { WhatsappAutoReply } from "@/components/whatsapp-autoreply";

export const Route = createFileRoute("/suporte")({
  head: () => head("Atendimento", "Caixa de entrada unificada com agentes de IA por produto e passagem para humano."),
  component: SupportRoute,
});

function SupportRoute() {
  const [contacts] = useStore<Contact[]>("contacts", []);
  const [products] = useStore<Product[]>("products", []);
  const [msgs, setMsgs] = useStore<Message[]>("messages", []);
  const [convs, setConvs] = useStore<Conversation[]>("conversations", []);
  const [sel, setSel] = useState("");
  const [text, setText] = useState("");
  const [as, setAs] = useState<"cliente" | "humano">("humano");
  const [busy, setBusy] = useState(false);
  const reply = useServerFn(supportReply);
  const send = useServerFn(sendMessage);
  const conv = convs.find((c) => c.contactId === sel);
  const contact = contacts.find((c) => c.id === sel);
  const thread = msgs.filter((m) => m.contactId === sel).sort((a, b) => a.at - b.at);
  const ensureConv = (): Conversation => conv ?? { contactId: sel, productId: products[0]?.id ?? "", mode: "ia", status: "aberta", category: "" };
  const upConv = (p: Partial<Conversation>) => { const c = { ...ensureConv(), ...p }; setConvs([c, ...convs.filter((x) => x.contactId !== sel)]); };
  const botId = (contact?.fields as Record<string, string> | undefined)?.["botId"];
  const channel: Message["channel"] = contact?.source === "telegram" || botId ? "telegram" : contact?.phone ? "whatsapp" : contact?.email ? "email" : "telegram";
  const dest = botId ? `bot:${botId}|${contact?.phone}` : contact?.phone || contact?.email || "-";

  async function post() {
    if (!text || !contact) return;
    const m: Message = { id: uid(), contactId: sel, channel, from: as, text, at: Date.now() };
    const next = [...msgs, m]; setMsgs(next); setText("");
    if (as === "humano") {
      const r = await send({ data: { channel, to: dest, text: m.text } });
      if (!r.ok) toast.error(r.error);
      return;
    }
    const c = ensureConv();
    if (c.mode !== "ia") return;
    setBusy(true);
    const prod = products.find((p) => p.id === c.productId);
    const r = await reply({ data: { product: prod?.name ?? "", knowledge: prod?.knowledge ?? "", history: [...thread, m].slice(-20).map((x) => ({ from: x.from, text: x.text })) } });
    setBusy(false);
    if (r.error) { toast.error(r.error); return; }
    setMsgs([...next, { id: uid(), contactId: sel, channel, from: "ia", text: r.text, at: Date.now() }]);
    upConv({ category: r.category, mode: r.handoff ? "humano" : "ia" });
    if (r.handoff) toast.message("Crowley passou esta conversa para você.");
    const s = await send({ data: { channel, to: dest, text: r.text } });
    if (!s.ok) toast.error("Resposta gerada, mas não enviada: " + s.error);
  }

  const open = convs.filter((c) => c.status === "aberta");
  const cats = convs.reduce<Record<string, number>>((acc, c) => { if (c.category) acc[c.category] = (acc[c.category] ?? 0) + 1; return acc; }, {});
  return (
    <div className="space-y-4 p-4 pb-24 md:p-6">
      <PageHead title="Atendimento" sub="WhatsApp, Telegram e e-mail com agente de IA por produto." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Abertas" value={open.length} />
        <Stat label="Com humano" value={convs.filter((c) => c.mode === "humano" && c.status === "aberta").length} />
        <Stat label="Resolvidas" value={convs.filter((c) => c.status === "resolvida").length} />
        <Stat label="Principal assunto" value={Object.entries(cats).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2"><WhatsappAutoReply /><SupportBots /></div>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="max-h-[70vh] divide-y divide-border overflow-y-auto p-0">
          {contacts.length === 0 && <div className="p-4 text-sm text-muted-foreground">Adicione contatos no CRM para conversar.</div>}
          {contacts.map((c) => {
            const cv = convs.find((x) => x.contactId === c.id);
            const last = msgs.filter((m) => m.contactId === c.id).at(-1);
            return (
              <button key={c.id} onClick={() => setSel(c.id)} className={`block w-full p-3 text-left text-sm ${sel === c.id ? "bg-primary/10" : ""}`}>
                <div className="flex items-center justify-between"><span className="truncate font-medium">{c.name || c.phone}</span>{cv && <span className="text-[10px] uppercase text-muted-foreground">{cv.mode === "ia" ? "IA" : "humano"}</span>}</div>
                <div className="truncate text-xs text-muted-foreground">{last?.text ?? "sem mensagens"}</div>
              </button>
            );
          })}
        </Card>
        {!contact ? <Empty>Escolha uma conversa.</Empty> : (
          <Card className="flex h-[70vh] flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{contact.name}</span>
              <NativeSelect value={ensureConv().productId} onChange={(e) => upConv({ productId: e.target.value })}><option value="">Sem produto</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</NativeSelect>
              <Button size="sm" variant="outline" onClick={() => upConv({ mode: ensureConv().mode === "ia" ? "humano" : "ia" })}>{ensureConv().mode === "ia" ? <><Bot className="h-4 w-4" /> IA atendendo</> : <><User className="h-4 w-4" /> Você atendendo</>}</Button>
              <Button size="sm" variant="ghost" onClick={() => upConv({ status: ensureConv().status === "aberta" ? "resolvida" : "aberta" })}><CheckCircle2 className="h-4 w-4" /> {ensureConv().status === "aberta" ? "Resolver" : "Reabrir"}</Button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto">
              {thread.map((m) => (
                <div key={m.id} className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.from === "cliente" ? "bg-muted" : "ml-auto bg-primary/15"}`}>
                  <div className="text-[10px] uppercase text-muted-foreground">{m.from} · {m.channel}</div>{m.text}
                </div>
              ))}
              {busy && <div className="text-xs text-muted-foreground">Agente respondendo…</div>}
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex">
              <NativeSelect value={as} onChange={(e) => setAs(e.target.value as any)}><option value="humano">Enviar como eu</option><option value="cliente">Registrar msg do cliente</option></NativeSelect>
              <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && post()} placeholder="Mensagem" />
              <Button onClick={post} disabled={busy}><Send className="h-4 w-4" /></Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Mensagens recebidas chegam automaticamente quando o servidor de WhatsApp (Render) e o bot do Telegram estiverem conectados; até lá, registre a mensagem do cliente para testar o agente.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
