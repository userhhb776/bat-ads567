import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Inbox, Pencil, Plus, QrCode, RefreshCw, Server, Smartphone, Star, Trash2, Unplug, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { waServerDelete, waServerSave, waServerTest, whatsappConnect, whatsappHook, whatsappList, whatsappRemove, type WaServerStatus } from "@/lib/channels.functions";

type Draft = { slot?: string; name: string; url: string; key: string; primary: boolean };
const EMPTY: Draft = { name: "", url: "", key: "", primary: false };

/** WhatsApp servers (Evolution API on Render: nickname, edit, test, main/backup) and the numbers on each one. */
export function WhatsappCard() {
  const list = useServerFn(whatsappList);
  const connect = useServerFn(whatsappConnect);
  const remove = useServerFn(whatsappRemove);
  const hook = useServerFn(whatsappHook);
  const save = useServerFn(waServerSave);
  const test = useServerFn(waServerTest);
  const delServer = useServerFn(waServerDelete);
  const q = useQuery({ queryKey: ["wa-list"], queryFn: () => list(), staleTime: 30000, retry: false });
  const [qr, setQr] = useState<{ name: string; img: string; code: string } | null>(null);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState("");
  const [form, setForm] = useState<Draft | null>(null);
  const [tested, setTested] = useState<Record<string, string>>({});
  const d = q.data;
  const servers = d?.servers ?? [];
  const usable = servers.filter((s) => s.ok);
  const targetSlot = target || usable[0]?.slot || servers[0]?.slot || "";

  async function run(id: string, fn: () => Promise<unknown>) {
    setBusy(id);
    try { await fn(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(""); }
  }
  const doConnect = (n: string, isNew: boolean, slot: string) => run(n, async () => {
    const r = await connect({ data: { name: n, isNew, slot: slot as never } });
    if (!r.qr && !r.pairingCode) toast.success("Esse número já está conectado.");
    setQr(r.qr || r.pairingCode ? { name: n, img: r.qr, code: r.pairingCode } : null);
    if (!r.webhook) toast.message("Crie seu link de webhook em Integrações para receber as mensagens no Suporte.");
    setName(""); void q.refetch();
  });
  const doHook = (n: string, slot: string) => run(n, async () => { await hook({ data: { name: n, slot: slot as never } }); toast.success("Pronto: as mensagens desse número chegam no Atendimento."); void q.refetch(); });
  const doRemove = (n: string, mode: "logout" | "delete", slot: string) => {
    if (!window.confirm(mode === "delete" ? `Remover ${n} do servidor?` : `Desconectar ${n}?`)) return;
    void run(n, async () => { await remove({ data: { name: n, mode, slot: slot as never } }); toast.success("Feito."); void q.refetch(); });
  };
  const doTest = (s: WaServerStatus) => run(s.slot, async () => {
    const r = await test({ data: { slot: s.slot as never } });
    setTested({ ...tested, [s.slot]: r.ok ? `No ar · ${r.ms} ms · versão ${r.version || "?"} · ${r.count} número(s)` : r.error });
    if (r.ok) toast.success(`${s.name} está funcionando.`); else toast.error(r.error);
  });
  const doSave = () => form && run("form", async () => {
    const url = form.url.trim().replace(/\/$/, "");
    if (!/^https:\/\/[^/]+/.test(url)) { toast.error("O endereço precisa começar com https://"); return; }
    if (!form.slot && !form.key.trim()) { toast.error("Informe a chave do servidor."); return; }
    const t = await test({ data: { url, key: form.key.trim() || undefined, slot: form.slot as never } });
    if (!t.ok && !window.confirm(`O teste falhou: ${t.error}\nSalvar mesmo assim?`)) return;
    await save({ data: { slot: form.slot as never, name: form.name.trim() || "Servidor", url, key: form.key.trim(), primary: form.primary } });
    toast.success(t.ok ? "Servidor salvo e funcionando." : "Servidor salvo.");
    setForm(null); void q.refetch();
  });
  const doDelete = (s: WaServerStatus) => {
    if (!window.confirm(`Remover o servidor "${s.name}" do painel? Os números dele continuam no Render.`)) return;
    void run(s.slot, async () => { await delServer({ data: { slot: s.slot as never } }); toast.success("Servidor removido."); void q.refetch(); });
  };
  const makeMain = (s: WaServerStatus) => run(s.slot, async () => { await save({ data: { slot: s.slot as never, name: s.name, url: s.url, key: "", primary: true } }); toast.success(`${s.name} agora é o principal.`); void q.refetch(); });

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-md border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Server className="h-5 w-5 text-primary" />
          <span className="font-medium">Servidores</span>
          <span className="text-[11px] text-muted-foreground">se o principal cair, o próximo assume</span>
          <Button size="icon" variant="ghost" className="ml-auto" aria-label="Atualizar servidores" onClick={() => void q.refetch()}><RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} /></Button>
        </div>
        <ul className="space-y-2">
          {servers.map((s, i) => (
            <li key={s.slot} className="space-y-1 rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${s.ok ? "bg-primary" : "bg-destructive"}`} />
                <span className="text-sm font-semibold">{s.name}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{i === 0 ? "Principal" : `Reserva ${i}`}</span>
                {s.source === "sistema" && <span className="text-[10px] text-muted-foreground">fixo</span>}
                <div className="ml-auto flex items-center">
                  <Button size="icon" variant="ghost" aria-label={`Testar ${s.name}`} disabled={busy === s.slot} onClick={() => void doTest(s)}><Activity className="h-4 w-4" /></Button>
                  {s.source === "painel" && i !== 0 && <Button size="icon" variant="ghost" aria-label={`Tornar ${s.name} principal`} disabled={busy === s.slot} onClick={() => void makeMain(s)}><Star className="h-4 w-4" /></Button>}
                  {s.source !== "sistema" && <Button size="icon" variant="ghost" aria-label={`Editar ${s.name}`} onClick={() => setForm({ slot: s.slot, name: s.name, url: s.url, key: "", primary: s.primary || s.source === "reserva" ? s.primary : false })}><Pencil className="h-4 w-4" /></Button>}
                  {s.source !== "sistema" && <Button size="icon" variant="ghost" aria-label={`Remover ${s.name}`} disabled={busy === s.slot} onClick={() => doDelete(s)}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              </div>
              <p className="break-all text-[11px] text-muted-foreground">{s.url} · chave {s.key || "—"}</p>
              <p className={`text-[11px] ${s.ok ? "text-primary" : "text-destructive"}`}>{tested[s.slot] ?? (s.ok ? `No ar · ${s.ms} ms${s.version ? ` · versão ${s.version}` : ""} · ${s.count} número(s)` : s.error)}</p>
            </li>
          ))}
          {!q.isLoading && !servers.length && <li className="text-xs text-muted-foreground">Nenhum servidor ainda. Adicione o endereço do seu Render.</li>}
          {q.isLoading && <li className="text-xs text-muted-foreground">Verificando servidores…</li>}
        </ul>
        {form ? (
          <div className="space-y-2 rounded-md border border-primary/40 p-3">
            <div className="flex items-center justify-between"><span className="text-sm font-semibold">{form.slot ? "Editar servidor" : "Novo servidor"}</span><Button size="icon" variant="ghost" aria-label="Fechar" onClick={() => setForm(null)}><X className="h-4 w-4" /></Button></div>
            <Input placeholder="Apelido (ex.: Render vendas)" maxLength={40} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="https://seu-servidor.onrender.com" inputMode="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
            <Input type="password" placeholder={form.slot ? "Chave (deixe vazio para manter a atual)" : "Chave (AUTHENTICATION_API_KEY)"} value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} />
            <label className="flex items-center gap-2 text-sm"><Switch checked={form.primary} onCheckedChange={(v) => setForm({ ...form, primary: v })} aria-label="Usar como principal" /> Usar como principal</label>
            <Button className="w-full" disabled={busy === "form"} onClick={() => void doSave()}>{busy === "form" ? "Testando…" : "Testar e salvar"}</Button>
          </div>
        ) : (
          <Button variant="outline" className="w-full" disabled={servers.filter((s) => s.source === "painel").length >= 6} onClick={() => setForm({ ...EMPTY, primary: !servers.some((s) => s.source === "painel") })}><Plus className="mr-1 h-4 w-4" /> Adicionar servidor</Button>
        )}
      </div>

      <div className="space-y-3 rounded-md border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" />
          <span className="font-medium">Números</span>
          <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] ${d?.ok ? "bg-primary/20 text-primary" : "bg-destructive/15 text-destructive"}`}>
            {q.isFetching ? "Verificando…" : d?.ok ? `${usable.length} de ${servers.length} servidor(es) no ar` : "Offline"}
          </span>
        </div>
        {d?.error && <p className="text-xs text-destructive">{d.error}</p>}
        <ul className="space-y-2">
          {(d?.instances ?? []).map((i) => (
            <li key={`${i.slot}:${i.name}`} className="flex items-center gap-3 rounded-md border border-border p-2">
              {i.pic ? <img src={i.pic} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="h-9 w-9 rounded-full bg-muted" />}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{i.profile || i.name}</div>
                <div className="truncate text-[11px] text-muted-foreground">{i.number ? `+${i.number}` : i.name} · {i.server} · {i.status === "open" ? "Conectado" : i.status === "connecting" ? "Aguardando QR" : "Desconectado"}{i.status === "open" && (i.receiving ? " · recebendo no Atendimento" : " · não recebe mensagens ainda")}</div>
              </div>
              {i.status !== "open" && <Button size="icon" variant="ghost" aria-label="Conectar com QR" disabled={busy === i.name} onClick={() => void doConnect(i.name, false, i.slot)}><QrCode className="h-4 w-4" /></Button>}
              {i.status === "open" && !i.receiving && <Button size="sm" variant="outline" disabled={busy === i.name} onClick={() => void doHook(i.name, i.slot)}><Inbox className="mr-1 h-4 w-4" /> Receber</Button>}
              {i.status === "open" && <Button size="icon" variant="ghost" aria-label="Desconectar" disabled={busy === i.name} onClick={() => doRemove(i.name, "logout", i.slot)}><Unplug className="h-4 w-4" /></Button>}
              <Button size="icon" variant="ghost" aria-label="Remover" disabled={busy === i.name} onClick={() => doRemove(i.name, "delete", i.slot)}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
          {d?.ok && !d.instances.length && <li className="text-xs text-muted-foreground">Nenhum número ainda.</li>}
        </ul>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input value={name} onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))} placeholder="Nome do novo número (ex.: vendas)" />
          {servers.length > 1 && (
            <select aria-label="Servidor do novo número" value={targetSlot} onChange={(e) => setTarget(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
              {servers.map((s) => <option key={s.slot} value={s.slot}>{s.name}{s.ok ? "" : " (offline)"}</option>)}
            </select>
          )}
          <Button disabled={name.length < 2 || !!busy || !targetSlot} onClick={() => void doConnect(name, true, targetSlot)}><Plus className="mr-1 h-4 w-4" /> Conectar</Button>
        </div>
        {qr && (
          <div className="space-y-2 rounded-md border border-primary/40 p-3 text-center">
            <div className="text-sm font-medium">Escaneie com o WhatsApp de "{qr.name}"</div>
            {qr.img && <img src={qr.img} alt="QR Code do WhatsApp" className="mx-auto w-56 rounded bg-white p-2" />}
            {qr.code && <div className="font-mono text-lg tracking-widest">{qr.code}</div>}
            <p className="text-[11px] text-muted-foreground">WhatsApp → Aparelhos conectados → Conectar aparelho. Depois toque em atualizar.</p>
            <Button size="sm" variant="secondary" onClick={() => setQr(null)}>Fechar</Button>
          </div>
        )}
      </div>
    </div>
  );
}
