import { MessageCircle } from "lucide-react";
import { Card, Field, NativeSelect } from "@/components/ui-kit";
import { Switch } from "@/components/ui/switch";
import { useStore } from "@/lib/store";
import type { Product } from "@/lib/biz";

export type WaAutoReply = { enabled: boolean; productId: string };

/** WhatsApp support agent: answers customers with the chosen product's knowledge base; a human can take over any conversation. */
export function WhatsappAutoReply() {
  const [cfg, setCfg] = useStore<WaAutoReply>("wa-autoreply", { enabled: false, productId: "" });
  const [products] = useStore<Product[]>("products", []);
  const prod = products.find((p) => p.id === cfg.productId);
  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-primary" />
        <span className="font-medium">Agente de IA no WhatsApp</span>
        <Switch className="ml-auto" checked={cfg.enabled} disabled={!cfg.productId} onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })} aria-label="Ligar respostas automáticas no WhatsApp" />
      </div>
      <Field label="Produto que ele atende (usa a Base de Conhecimento do produto)">
        <NativeSelect value={cfg.productId} onChange={(e) => setCfg({ ...cfg, productId: e.target.value, enabled: e.target.value ? cfg.enabled : false })}>
          <option value="">Escolha um produto</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </NativeSelect>
      </Field>
      <p className="text-xs text-muted-foreground">
        {cfg.enabled ? `Ligado: responde sozinho pelo produto "${prod?.name ?? ""}". Se o cliente pedir humano, reembolso ou estiver irritado, ele passa para você e o celular apita.` : "Desligado: as mensagens só chegam aqui para você responder."}
        {prod && !prod.knowledge?.trim() && " Atenção: esse produto está sem Base de Conhecimento — preencha em Produtos para ele saber o que responder."}
      </p>
      <p className="text-[11px] text-muted-foreground">Para as mensagens chegarem, o número precisa estar com "recebendo no Atendimento" em Configurações → WhatsApp.</p>
    </Card>
  );
}
