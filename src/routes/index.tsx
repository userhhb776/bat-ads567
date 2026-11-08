import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/met" });
  },
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
