import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Bot, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, Field, NativeSelect } from "@/components/ui-kit";
import { useStore } from "@/lib/store";
import type { Product } from "@/lib/biz";
import { createBot, deleteBot, listBots, updateBotProduct } from "@/lib/bots.functions";

/** Telegram support agents: each one has its own BotFather token and answers for one product. */
export function SupportBots() {
  const qc = useQueryClient();
  const [products] = useStore<Product[]>("products", []);
  const bots = useQuery({ queryKey: ["support-bots"], queryFn: () => listBots() });
  const [form, setForm] = useState({ name: "", productId: "", token: "" });
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  async function add() {
    setBusy(true);
    try {
      const r = await createBot({ data: form });
      toast.success(r.webhook ? `@${r.username} está atendendo.` : `@${r.username} salvo, mas o Telegram não aceitou o endereço. Publique o app e recrie.`);
      setForm({ name: "", productId: "", token: "" }); setOpen(false);
      await qc.invalidateQueries({ queryKey: ["support-bots"] });
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0"><div className="font-medium">Agentes no Telegram</div><p className="text-xs text-muted-foreground">Cada agente tem o próprio bot e responde sobre um produto.</p></div>
        <Button size="sm" onClick={() => setOpen(!open)}><Plus className="h-4 w-4" />Novo agente</Button>
      </div>
      {open && (
        <div className="space-y-2 rounded-md border border-border p-3">
          <ol className="list-decimal space-y-0.5 pl-4 text-xs text-muted-foreground">
            <li>No Telegram, abra o <b>@BotFather</b> e envie <b>/newbot</b>.</li>
            <li>Escolha nome e usuário do bot. Ele te devolve um token.</li>
            <li>Cole o token aqui e escolha o produto que o agente atende.</li>
          </ol>
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="Nome do agente"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Suporte Curso X" /></Field>
            <Field label="Produto"><NativeSelect value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}><option value="">Sem produto</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</NativeSelect></Field>
            <Field label="Token do bot"><Input type="password" value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} placeholder="123456:ABC…" /></Field>
          </div>
          <Button disabled={busy || !form.name || !form.token} onClick={add}>{busy ? "Conectando…" : "Conectar agente"}</Button>
        </div>
      )}
      {bots.error && <p className="text-xs text-destructive">{(bots.error as Error).message}</p>}
      {bots.data?.length === 0 && !open && <p className="text-xs text-muted-foreground">Nenhum agente ainda.</p>}
      <div className="space-y-2">
        {bots.data?.map((b) => (
          <div key={b.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2 text-sm">
            <Bot className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1"><div className="truncate font-medium">{b.name}</div><a className="text-xs text-muted-foreground underline" href={`https://t.me/${b.username}`} target="_blank" rel="noreferrer">@{b.username}</a></div>
            <NativeSelect value={b.product_id} onChange={async (e) => { await updateBotProduct({ data: { id: b.id, productId: e.target.value } }); await qc.invalidateQueries({ queryKey: ["support-bots"] }); toast.success("Produto do agente atualizado."); }}><option value="">Sem produto</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</NativeSelect>
            <Button size="icon" variant="ghost" aria-label="Remover agente" onClick={async () => { if (!confirm(`Remover ${b.name}? O bot para de responder.`)) return; try { await deleteBot({ data: { id: b.id } }); await qc.invalidateQueries({ queryKey: ["support-bots"] }); } catch (e) { toast.error((e as Error).message); } }}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
