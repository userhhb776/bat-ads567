import { Bell, Bot, BarChart3, Building2, CalendarClock, Eye, FileBarChart, FileText, Gauge, Image, LayoutGrid, Link2, MessagesSquare, Package, Plug, PlusSquare, Radar, Settings, ShieldCheck, Users, Workflow, Zap, Activity } from "lucide-react";

/** Single menu definition shared by the sidebar and the mobile "Mais" page. */
export const NAV_GROUPS = [
  { title: "Dashboard", items: [
    { to: "/", label: "Visão geral", icon: Gauge },
    { to: "/relatorios", label: "Relatórios", icon: FileBarChart },
    { to: "/notificacoes", label: "Notificações", icon: Bell },
  ] },
  { title: "Marketing", items: [
    { to: "/met", label: "Campanhas", icon: LayoutGrid },
    { to: "/met/criar", label: "Criar campanha", icon: PlusSquare },
    { to: "/bm", label: "BMs e pixels", icon: Building2 },
    { to: "/ativos", label: "Contas e ativos", icon: Plug },
    { to: "/criativos", label: "Creative Center", icon: Image },
  ] },
  { title: "Analytics", items: [
    { to: "/utm", label: "Métricas", icon: BarChart3 },
    { to: "/utm/links", label: "Links UTM", icon: Link2 },
    { to: "/utm/visitantes", label: "Visitantes", icon: Users },
    { to: "/utm/integracoes", label: "Integrações", icon: Plug },
  ] },
  { title: "Criação", items: [
    { to: "/paginas", label: "Páginas", icon: FileText },
    { to: "/funis", label: "Funis", icon: Workflow },
  ] },
  { title: "Automações", items: [
    { to: "/automacoes", label: "Fluxos", icon: Zap },
    { to: "/agendamentos", label: "Agendamentos", icon: CalendarClock },
  ] },
  { title: "Comercial", items: [
    { to: "/produtos", label: "Produtos e vendas", icon: Package },
    { to: "/ofertas", label: "Radar de ofertas", icon: Eye },
  ] },
  { title: "Relacionamento", items: [
    { to: "/crm", label: "CRM", icon: Users },
    { to: "/suporte", label: "Atendimento", icon: MessagesSquare },
  ] },
  { title: "Inteligência", items: [
    { to: "/crowley", label: "Crowley", icon: Bot },
    { to: "/agentes", label: "Agentes ADS", icon: ShieldCheck },
    { to: "/inteligencia", label: "Gestão de campanhas", icon: Radar },
  ] },
  { title: "Sistema", items: [
    { to: "/sistema", label: "Atividades e saúde", icon: Activity },
    { to: "/configuracoes", label: "Configurações", icon: Settings },
  ] },
] as const;
