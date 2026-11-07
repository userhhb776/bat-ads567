import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/utm")({
  head: () => ({
    meta: [
      { title: "Modo UTM — Bat Ads" },
      { name: "description", content: "Métricas de vendas, lucro e ROAS." },
      { property: "og:title", content: "Modo UTM — Bat Ads" },
      { property: "og:description", content: "Métricas de vendas, lucro e ROAS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Utm,
});

function Utm() {
  return (
    <div className="p-8">
      <h1 className="font-display text-4xl tracking-wide">Dashboard — Principal</h1>
      <div className="mt-6 rounded-lg border border-border bg-card p-8 text-muted-foreground">
        O modo UTM (faturamento, ROAS, lucro e integrações de vendas) é a próxima etapa.
      </div>
    </div>
  );
}
