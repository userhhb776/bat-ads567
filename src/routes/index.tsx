import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/met" });
  },
  head: () => ({
    meta: [
      { title: "Bat Ads" },
      { name: "description", content: "Gerenciador pessoal de anúncios e métricas." },
      { property: "og:title", content: "Bat Ads" },
      { property: "og:description", content: "Gerenciador pessoal de anúncios e métricas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
