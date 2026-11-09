import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, Empty, Field, NativeSelect, PageHead, Stat, head } from "@/components/ui-kit";
import { useStore, uid, toCsv, fromCsv, download } from "@/lib/store";
import { STAGES, type Contact, type Order } from "@/lib/biz";

type CrmTask = { id: string; title: string; due: string; owner: string; contactId: string; status: "aberta" | "feita"; createdAt: number };

export const Route = createFileRoute("/crm")({
  head: () => head("CRM", "Leads e clientes com tags, funil de vendas, notas e listas inteligentes."),
  component: CrmRoute,
});

function CrmRoute() {
  const [contacts, setContacts] = useStore<Contact[]>("contacts", []);
  const [orders] = useStore<Order[]>("orders", []);
  const [q, setQ] = useState("");
  const [list, setList] = useState("todos");
  const [view, setView] = useState<"lista" | "pipeline">("lista");
  const [sel, setSel] = useState("");
  const [note, setNote] = useState("");
  const [tasks, setTasks] = useStore<CrmTask[]>("crm-tasks", []);
  const [task, setTask] = useState({ title: "", due: "", owner: "" });
  const [msgs] = useStore<{ contactId: string; text: string; at: number; from: string; channel: string }[]>("messages", []);
  const spent = (c: Contact) => orders.filter((o) => o.status === "aprovado" && ((c.email && o.email === c.email) || (c.phone && o.phone === c.phone)));
  const smart: Record<string, (c: Contact) => boolean> = {
    todos: () => true,
    clientes: (c) => spent(c).length > 0,
    recorrentes: (c) => spent(c).length > 1,
    pix_pendente: (c) => orders.some((o) => o.status === "pix_gerado" && (o.email === c.email || o.phone === c.phone)),
    sem_compra: (c) => spent(c).length === 0,
  };
  const filtered = useMemo(() => contacts.filter((c) => smart[list]!(c) && (`${c.name} ${c.email} ${c.phone} ${c.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase()))), [contacts, q, list, orders]);
  const c = contacts.find((x) => x.id === sel);
  const patch = (p: Partial<Contact>) => c && setContacts(contacts.map((x) => (x.id === c.id ? { ...x, ...p } : x)));
  const add = () => { const n: Contact = { id: uid(), name: "Novo contato", email: "", phone: "", source: "manual", tags: [], stage: "Novo", fields: {}, notes: [], createdAt: Date.now() }; setContacts([n, ...contacts]); setSel(n.id); };
  const importCsv = async (f: File) => {
    const rows = fromCsv(await f.text());
    setContacts([...rows.map((r) => ({ id: uid(), name: r["nome"] || r["name"] || "", email: r["email"] || "", phone: r["telefone"] || r["phone"] || "", source: r["origem"] || "importado", tags: (r["tags"] || "").split(/[|]/).filter(Boolean), stage: "Novo", fields: {}, notes: [], createdAt: Date.now() })), ...contacts]);
  };
  const syncFromOrders = () => {
    const known = new Set(contacts.map((x) => x.email || x.phone));
    const fresh = orders.filter((o) => (o.email || o.phone) && !known.has(o.email || o.phone)).map((o) => { known.add(o.email || o.phone); return { id: uid(), name: o.customer, email: o.email, phone: o.phone, source: o.utm_source || o.gateway, tags: [o.status], stage: o.status === "aprovado" ? "Cliente" : "Checkout", fields: { campanha: o.utm_campaign }, notes: [], createdAt: o.at } as Contact; });
    setContacts([...fresh, ...contacts]);
  };

  return (
    <div className="space-y-4 p-4 pb-24 md:p-6">
      <PageHead title="CRM" sub="Leads, clientes e conversas em um só lugar.">
        <Button onClick={add}><Plus className="h-4 w-4" /> Contato</Button>
        <Button variant="outline" onClick={syncFromOrders}>Puxar dos pedidos</Button>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"><Upload className="h-4 w-4" /> Importar<input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} /></label>
        <Button variant="outline" onClick={() => download("contatos.csv", toCsv(contacts.map((x) => ({ nome: x.name, email: x.email, telefone: x.phone, origem: x.source, tags: x.tags.join("|"), etapa: x.stage }))))}><Download className="h-4 w-4" /> Exportar</Button>
      </PageHead>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Contatos" value={contacts.length} />
        <Stat label="Clientes" value={contacts.filter(smart["clientes"]!).length} />
        <Stat label="Recorrentes" value={contacts.filter(smart["recorrentes"]!).length} />
        <Stat label="Pix pendente" value={contacts.filter(smart["pix_pendente"]!).length} />
      </div>
      {tasks.some((t) => t.status === "aberta") && <Card className="space-y-1"><div className="text-xs font-medium">Tarefas abertas ({tasks.filter((t) => t.status === "aberta").length})</div>{tasks.filter((t) => t.status === "aberta").sort((a, b) => (a.due || "9").localeCompare(b.due || "9")).slice(0, 8).map((t) => <button key={t.id} onClick={() => setSel(t.contactId)} className="flex w-full justify-between text-left text-xs"><span>{t.title} · {contacts.find((x) => x.id === t.contactId)?.name}</span><span className={t.due && t.due < new Date().toISOString().slice(0, 10) ? "text-destructive" : "text-muted-foreground"}>{t.due || "sem prazo"}{t.owner ? ` · ${t.owner}` : ""}</span></button>)}</Card>}
      <div className="flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Buscar nome, tag, telefone…" value={q} onChange={(e) => setQ(e.target.value)} />
        <NativeSelect value={list} onChange={(e) => setList(e.target.value)}>
          <option value="todos">Todos</option><option value="clientes">Clientes</option><option value="recorrentes">Recorrentes</option><option value="pix_pendente">Pix pendente</option><option value="sem_compra">Sem compra</option>
        </NativeSelect>
        <Button variant="outline" onClick={() => setView(view === "lista" ? "pipeline" : "lista")}>{view === "lista" ? "Ver pipeline" : "Ver lista"}</Button>
      </div>
      {view === "pipeline" ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {STAGES.map((s) => (
            <div key={s} className="w-60 shrink-0 space-y-2 rounded-xl border border-border bg-card/50 p-2"
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const id = e.dataTransfer.getData("id"); setContacts(contacts.map((x) => (x.id === id ? { ...x, stage: s } : x))); }}>
              <div className="px-1 text-xs uppercase text-muted-foreground">{s} · {filtered.filter((x) => x.stage === s).length}</div>
              {filtered.filter((x) => x.stage === s).map((x) => (
                <div key={x.id} draggable onDragStart={(e) => e.dataTransfer.setData("id", x.id)} onClick={() => setSel(x.id)} className="cursor-grab rounded-lg border border-border bg-card p-2 text-sm">{x.name || x.phone}</div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          {filtered.length === 0 ? <Empty>Nenhum contato.</Empty> : (
            <Card className="divide-y divide-border p-0">
              {filtered.map((x) => (
                <button key={x.id} onClick={() => setSel(x.id)} className={`flex w-full items-center justify-between gap-2 p-3 text-left text-sm ${sel === x.id ? "bg-primary/10" : ""}`}>
                  <div className="min-w-0"><div className="truncate font-medium">{x.name || "—"}</div><div className="truncate text-xs text-muted-foreground">{x.phone} {x.email}</div></div>
                  <div className="flex flex-wrap justify-end gap-1">{x.tags.slice(0, 3).map((t) => <span key={t} className="rounded bg-primary/15 px-1.5 text-[10px] text-primary">{t}</span>)}</div>
                </button>
              ))}
            </Card>
          )}
          {c && (
            <Card className="space-y-2">
              <Field label="Nome"><Input value={c.name} onChange={(e) => patch({ name: e.target.value })} /></Field>
              <Field label="E-mail"><Input value={c.email} onChange={(e) => patch({ email: e.target.value })} /></Field>
              <Field label="WhatsApp"><Input value={c.phone} onChange={(e) => patch({ phone: e.target.value })} /></Field>
              <Field label="Origem"><Input value={c.source} onChange={(e) => patch({ source: e.target.value })} /></Field>
              <Field label="Etapa"><NativeSelect value={c.stage} onChange={(e) => patch({ stage: e.target.value })}>{STAGES.map((s) => <option key={s}>{s}</option>)}</NativeSelect></Field>
              <Field label="Tags (vírgula)"><Input value={c.tags.join(", ")} onChange={(e) => patch({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} /></Field>
              <Field label="Campos personalizados (chave=valor por linha)">
                <Textarea value={Object.entries(c.fields).map(([k, v]) => `${k}=${v}`).join("\n")} onChange={(e) => patch({ fields: Object.fromEntries(e.target.value.split("\n").filter((l) => l.includes("=")).map((l) => [l.split("=")[0]!.trim(), l.split("=").slice(1).join("=").trim()])) })} />
              </Field>
              <div className="text-xs text-muted-foreground">Compras: {spent(c).length} · {spent(c).reduce((s, o) => s + o.amount, 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
              <div className="flex gap-2"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nova nota/atividade" /><Button onClick={() => { if (note) { patch({ notes: [{ at: Date.now(), text: note }, ...c.notes] }); setNote(""); } }}>Salvar</Button></div>
              {c.notes.map((n) => <div key={n.at} className="text-xs"><span className="text-muted-foreground">{new Date(n.at).toLocaleString("pt-BR")}</span> — {n.text}</div>)}
              <Field label="Responsável"><Input value={c.fields["responsavel"] ?? ""} onChange={(e) => patch({ fields: { ...c.fields, responsavel: e.target.value } })} /></Field>
              <div className="border-t border-border pt-2 text-xs font-medium">Tarefas</div>
              <div className="flex gap-1"><Input className="h-8 text-xs" placeholder="Tarefa" value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} /><Input className="h-8 w-32 text-xs" type="date" value={task.due} onChange={(e) => setTask({ ...task, due: e.target.value })} /><Button size="sm" onClick={() => { if (!task.title) return; setTasks([{ id: uid(), title: task.title, due: task.due, owner: task.owner || c.fields["responsavel"] || "", contactId: c.id, status: "aberta", createdAt: Date.now() }, ...tasks]); setTask({ title: "", due: "", owner: "" }); }}>+</Button></div>
              {tasks.filter((t) => t.contactId === c.id).map((t) => <label key={t.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={t.status === "feita"} onChange={(e) => setTasks(tasks.map((x) => x.id === t.id ? { ...x, status: e.target.checked ? "feita" : "aberta" } : x))} /><span className={t.status === "feita" ? "line-through text-muted-foreground" : ""}>{t.title}</span><span className="ml-auto text-muted-foreground">{t.due}</span></label>)}
              <div className="border-t border-border pt-2 text-xs font-medium">Histórico de atividades</div>
              <div className="max-h-48 space-y-1 overflow-y-auto">{[...spent(c).map((o) => ({ at: o.at, text: `Compra aprovada R$ ${o.amount.toFixed(2)}` })), ...msgs.filter((m) => m.contactId === c.id).map((m) => ({ at: m.at, text: `${m.channel} · ${m.from}: ${m.text.slice(0, 80)}` })), ...c.notes].sort((a, b) => b.at - a.at).slice(0, 40).map((n, i) => <div key={i} className="text-[11px]"><span className="text-muted-foreground">{new Date(n.at).toLocaleString("pt-BR")}</span> — {n.text}</div>)}</div>
              <Button variant="ghost" onClick={() => { setContacts(contacts.filter((x) => x.id !== c.id)); setSel(""); }}><Trash2 className="h-4 w-4" /> Excluir</Button>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
