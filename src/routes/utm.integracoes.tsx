import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Clock } from "lucide-react";
import { useAdAccounts } from "@/components/account-bar";

export const Route = createFileRoute("/utm/integracoes")({
  head: () => ({
    meta: [
      { title: "Integrações — Bat Ads" },
      { name: "description", content: "Conecte contas de anúncio e gateways de vendas." },
      { property: "og:title", content: "Integrações — Bat Ads" },
      { property: "og:description", content: "Conecte contas de anúncio e gateways de vendas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Integrations,
});

const gateways = ["Kiwify", "Hotmart", "Eduzz", "Monetizze", "Perfect Pay", "Yampi", "Cartpanda", "Shopify", "Pagar.me", "Appmax", "Ticto", "Braip"];

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
        <p className="mb-4 text-xs text-muted-foreground">Para receber as vendas dos gateways, o app precisa do seu banco de dados próprio conectado. Fica para a próxima etapa.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {gateways.map((g) => (
            <div key={g} className="flex items-center justify-between gap-2 rounded-md border border-border p-3 text-sm">
              <span className="truncate">{g}</span>
              <span className="shrink-0 text-[10px] uppercase text-muted-foreground">Em breve</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
