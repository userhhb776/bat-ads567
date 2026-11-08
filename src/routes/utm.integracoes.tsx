import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useSession, useWebhookToken, useGatewayEvents } from "@/lib/sales";
import { CheckCircle2, Clock } from "lucide-react";
import { useAdAccounts } from "@/components/account-bar";

export const Route = createFileRoute("/utm/integracoes")({
  head: () => ({
    meta: [
      { title: "Integrações — Bat Gotham" },
      { name: "description", content: "Conecte contas de anúncio e gateways de vendas." },
      { property: "og:title", content: "Integrações — Bat Gotham" },
      { property: "og:description", content: "Conecte contas de anúncio e gateways de vendas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Integrations,
});

const gateways = ["Kiwify", "Hotmart", "Eduzz", "Monetizze", "Perfect Pay", "Yampi", "Cartpanda", "Shopify", "Pagar.me", "Appmax", "Ticto", "Braip"];

function GatewayLinks() {
  const session = useSession();
  const token = useWebhookToken(!!session.data);
  const events = useGatewayEvents(!!session.data, 7);
  if (!session.data) return <p className="text-xs text-muted-foreground">Entre na sua conta (<Link to="/entrar" className="text-primary underline">entrar</Link>) para gerar seus links secretos de webhook.</p>;
  const base = "https://bat-ads567.lovable.app";
  const link = (g: string) => `${base}/api/public/webhooks/${g.toLowerCase().replace(/[^a-z0-9]/g, "")}?token=${token.data ?? "..."}`;
  const count = (g: string) => events.data?.filter((e) => e.platform === g.toLowerCase().replace(/[^a-z0-9]/g, "")).length ?? 0;
  return (
    <>
      <p className="mb-4 text-xs text-muted-foreground">Cole o link do gateway no campo "Webhook / Postback" da plataforma, marcando todos os eventos (aprovado, Pix gerado, recusado, reembolso). Não compartilhe: ele dá acesso de escrita às suas vendas. Use o endereço do app publicado.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {gateways.map((g) => (
          <div key={g} className="min-w-0 rounded-md border border-border p-3 text-sm">
            <div className="flex items-center justify-between"><span className="font-medium">{g}</span><span className="text-[10px] uppercase text-muted-foreground">{count(g)} eventos 7d</span></div>
            <div className="mt-2 flex gap-2">
              <input readOnly value={link(g)} className="min-w-0 flex-1 truncate rounded border border-border bg-background px-2 py-1 text-[11px]" />
              <button className="shrink-0 rounded bg-primary px-2 text-xs text-primary-foreground" onClick={() => { navigator.clipboard.writeText(link(g)); toast.success("Link copiado"); }}>Copiar</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Integrations() {
  const { status, accounts } = useAdAccounts();
  return (
    <div className="space-y-5 p-3 pb-24 sm:p-6">
      <h1 className="font-display text-3xl tracking-wide sm:text-4xl">Integrações</h1>

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 text-sm font-semibold">Plataformas de anúncio</div>
        <div className="flex items-center gap-3">
          {status.data?.connected ? <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" /> : <Clock className="h-5 w-5 shrink-0 text-muted-foreground" />}
          <div className="min-w-0">
            <div className="font-medium">Facebook / Instagram</div>
            <div className="truncate text-xs text-muted-foreground">
              {status.data?.connected ? `${status.data.name} · ${accounts.data?.length ?? 0} contas de anúncio` : "Não conectado"}
            </div>
          </div>
        </div>
        {accounts.data && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.data.map((a) => (
              <div key={a.id} className="min-w-0 rounded-md border border-border p-3 text-sm">
                <div className="truncate font-medium">{a.name}</div>
                <div className="truncate text-xs text-muted-foreground">{a.business} · {a.currency} · {a.account_status === 1 ? "Ativa" : "Inativa"}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-1 text-sm font-semibold">Gateways de vendas</div>
        <GatewayLinks />
      </section>
    </div>
  );
}
