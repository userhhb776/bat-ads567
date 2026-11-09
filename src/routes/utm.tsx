import { createFileRoute, Outlet } from "@tanstack/react-router";
import { head } from "@/components/ui-kit";

export const Route = createFileRoute("/utm")({
  head: () => head("Análise de tráfego", "Origens, links e desempenho de tráfego no Bat Gotham."),
  component: () => <Outlet />,
});
