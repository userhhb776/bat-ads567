import { createFileRoute } from "@tanstack/react-router";
import { OperationsDashboard } from '@/components/operations-dashboard';

export const Route = createFileRoute("/")({
  component: OperationsDashboard,
  head: () => ({
    meta: [
      { title: "Bat Gotham" },
      { name: "description", content: "Central de operações: anúncios, métricas, funis e o assistente Crowley." },
      { property: "og:title", content: "Bat Gotham" },
      { property: "og:description", content: "Central de operações: anúncios, métricas, funis e o assistente Crowley." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
