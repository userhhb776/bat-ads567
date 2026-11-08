import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
const FunnelBuilder = lazy(() => import("@/components/funnel/FunnelBuilder"));

export const Route = createFileRoute("/funis")({
  head: () => ({
    meta: [
      { title: "Funis — Bat Gotham" },
      { name: "description", content: "Monte e simule funis de anúncio, página, VSL, checkout e WhatsApp." },
      { property: "og:title", content: "Funis — Bat Gotham" },
      { property: "og:description", content: "Monte e simule funis de vendas visualmente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FunisPage,
});

function FunisPage() { return <ClientOnly fallback={<div className="p-6 text-muted-foreground">Carregando funil…</div>}><Suspense fallback={<div className="p-6 text-muted-foreground">Carregando funil…</div>}><FunnelBuilder /></Suspense></ClientOnly>; }
