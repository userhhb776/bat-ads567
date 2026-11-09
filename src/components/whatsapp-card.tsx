import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, QrCode, RefreshCw, Smartphone, Trash2, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { whatsappConnect, whatsappList, whatsappRemove } from "@/lib/channels.functions";

/** Manages the WhatsApp numbers on the user's Render (Evolution API) server: list, connect by QR, disconnect, remove. */
export function WhatsappCard() {
  const list = useServerFn(whatsappList);
  const connect = useServerFn(whatsappConnect);
  const remove = useServerFn(whatsappRemove);
  const q = useQuery({ queryKey: ["wa-list"], queryFn: () => list(), staleTime: 30000, retry: false });
  const [qr, setQr] = useState<{ name: string; img: string; code: string } | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState("");
  const d = q.data;

  async function doConnect(n: string, isNew: boolean) {
    setBusy(n);
    try {
      const r = await connect({ data: { name: n, isNew } });
      if (!r.qr && !r.pairingCode) toast.success("Esse número já está conectado.");
      setQr(r.qr || r.pairingCode ? { name: n, img: r.qr, code: r.pairingCode } : null);
      if (!r.webhook) toast.message("Crie seu link de webhook em Integrações para receber as mensagens no Suporte.");
      setName("");
      void q.refetch();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(""); }
  }
  async function doRemove(n: string, mode: "logout" | "delete") {
    if (!window.confirm(mode === "delete" ? `Remover ${n} do servidor?` : `Desconectar ${n}?`)) return;
    setBusy(n);
    try { await remove({ data: { name: n, mode } }); toast.success("Feito."); void q.refetch(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(""); }
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Smartphone className="h-5 w-5 text-primary" />
        <span className="font-medium">WhatsApp</span>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] ${d?.ok ? "bg-primary/20 text-primary" : "bg-destructive/15 text-destructive"}`}>
          {q.isFetching ? "Verificando…" : d?.ok ? `Servidor online · ${d.ms} ms` : "Offline"}
        </span>
        <Button size="icon" variant="ghost" aria-label="Atualizar" onClick={() => void q.refetch()}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      {d?.error && <p className="text-xs text-destructive">{d.error}</p>}
      <ul className="space-y-2">
        {(d?.instances ?? []).map((i) => (
          <li key={i.name} className="flex items-center gap-3 rounded-md border border-border p-2">
            {i.pic ? <img src={i.pic} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="h-9 w-9 rounded-full bg-muted" />}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{i.profile || i.name}</div>
              <div className="truncate text-[11px] text-muted-foreground">{i.number ? `+${i.number}` : i.name} · {i.status === "open" ? "Conectado" : i.status === "connecting" ? "Aguardando QR" : "Desconectado"}</div>
            </div>
            {i.status !== "open" && <Button size="icon" variant="ghost" aria-label="Conectar com QR" disabled={busy === i.name} onClick={() => void doConnect(i.name, false)}><QrCode className="h-4 w-4" /></Button>}
            {i.status === "open" && <Button size="icon" variant="ghost" aria-label="Desconectar" disabled={busy === i.name} onClick={() => void doRemove(i.name, "logout")}><Unplug className="h-4 w-4" /></Button>}
            <Button size="icon" variant="ghost" aria-label="Remover" disabled={busy === i.name} onClick={() => void doRemove(i.name, "delete")}><Trash2 className="h-4 w-4" /></Button>
          </li>
        ))}
        {d?.ok && !d.instances.length && <li className="text-xs text-muted-foreground">Nenhum número ainda.</li>}
      </ul>
      <div className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))} placeholder="Nome do novo número (ex.: vendas)" />
        <Button disabled={name.length < 2 || !!busy} onClick={() => void doConnect(name, true)}><Plus className="mr-1 h-4 w-4" /> Conectar</Button>
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
  );
}
