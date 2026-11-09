import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { whatsappStatus } from "@/lib/channels.functions";

/** Shows the live status reported by the user's Render WhatsApp server. */
export function WhatsappCard() {
  const q = useQuery({ queryKey: ["wa-status"], queryFn: () => whatsappStatus(), staleTime: 60000, retry: false });
  const d = q.data;
  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Smartphone className="h-5 w-5 text-primary" />
        <span className="font-medium">WhatsApp (servidor Render)</span>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] ${d?.ok ? "bg-primary/20 text-primary" : "bg-destructive/15 text-destructive"}`}>
          {q.isLoading ? "Verificando…" : d?.ok ? `Online · ${d.ms} ms` : "Offline"}
        </span>
        <Button size="icon" variant="ghost" aria-label="Verificar de novo" onClick={() => void q.refetch()}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      {d?.body && <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-[11px]">{d.body}</pre>}
      <p className="text-xs text-muted-foreground">Os números conectados, o QR Code para conectar um novo e a desconexão ficam no seu servidor do Render. Para gerenciar daqui, o servidor precisa expor as rotas de listar, conectar e desconectar.</p>
    </div>
  );
}
