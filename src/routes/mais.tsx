import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, BarChart3, FileText, LayoutGrid, Link2, Package, Plug, PlusSquare, Radar, Users, Workflow, Zap, MessagesSquare, Gauge, Settings, Eye, ShieldCheck } from "lucide-react";
import { PageHead, head } from "@/components/ui-kit";

export const Route = createFileRoute("/mais")({
  head: () => head("Módulos", "Todos os módulos do Bat Gotham."),
  component: MoreRoute,
});

const items = [
  { to: "/", label: "Central", icon: Gauge },
  { to: "/met", label: "Campanhas", icon: LayoutGrid },
  { to: "/met/criar", label: "Criar campanha", icon: PlusSquare },
  { to: "/utm", label: "Métricas", icon: BarChart3 },
  { to: "/utm/links", label: "Links UTM", icon: Link2 },
  { to: "/produtos", label: "Produtos e vendas", icon: Package },
  { to: "/paginas", label: "Páginas", icon: FileText },
  { to: "/funis", label: "Funis", icon: Workflow },
  { to: "/automacoes", label: "Automações", icon: Zap },
  { to: "/crm", label: "CRM", icon: Users },
  { to: "/suporte", label: "Atendimento", icon: MessagesSquare },
  { to: "/inteligencia", label: "Inteligência", icon: Radar },
  { to: "/crowley", label: "Crowley", icon: Bot },
  { to: "/agentes", label: "Agentes ADS", icon: ShieldCheck },
  { to: "/ofertas", label: "Radar de ofertas", icon: Eye },
  { to: "/ativos", label: "Contas e ativos", icon: Plug },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
  { to: "/utm/integracoes", label: "Integrações", icon: Plug },
] as const;

function MoreRoute() {
  return (
    <div className="space-y-4 p-4 pb-24 md:p-6">
      <PageHead title="Módulos" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((i) => (
          <Link key={i.to} to={i.to} className="metric-card flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
            <i.icon className="h-6 w-6 text-primary" /><span className="font-medium">{i.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
