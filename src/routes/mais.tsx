import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHead, head } from "@/components/ui-kit";
import { NAV_GROUPS } from "@/lib/nav";

export const Route = createFileRoute("/mais")({
  head: () => head("Módulos", "Todos os módulos do Bat Gotham."),
  component: MoreRoute,
});

function MoreRoute() {
  return (
    <div className="space-y-5 p-4 pb-24 md:p-6">
      <PageHead title="Módulos" />
      {NAV_GROUPS.map((g) => (
        <section key={g.title} className="space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{g.title}</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {g.items.map((i) => (
              <Link key={i.to} to={i.to} className="metric-card flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
                <i.icon className="h-6 w-6 text-primary" /><span className="font-medium">{i.label}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
