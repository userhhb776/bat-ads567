import { createFileRoute, Outlet } from "@tanstack/react-router";
import { head } from "@/components/ui-kit";

export const Route = createFileRoute("/met")({
  head: () => head("Operação de anúncios", "Campanhas, conjuntos e anúncios do Bat Gotham."),
  component: () => <Outlet />,
});
