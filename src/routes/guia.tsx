import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BarChart3, Bot, Building2, FileText, Gauge, LayoutGrid, Link2, MessagesSquare, Package, Settings, ShieldCheck, Users, Workflow, Zap } from "lucide-react";
import { PageHead, head } from "@/components/ui-kit";

export const Route = createFileRoute("/guia")({
  head: () => head("Guia do usuário", "Aprenda cada função do Bat Gotham com passos curtos e animados."),
  component: Guide,
});

type Topic = { id: string; icon: typeof Gauge; title: string; tagline: string; to: string; steps: string[]; tip: string };
const TOPICS: Topic[] = [
  { id: "dash", icon: Gauge, title: "Visão geral", tagline: "Seu placar do dia.", to: "/", steps: ["Escolha a conta e o período no topo", "Leia gasto, receita, lucro e ROAS nos cartões", "Toque no briefing para o Crowley resumir o dia"], tip: "Receita de anúncio e vendas aprovadas aparecem separadas para não enganar." },
  { id: "camp", icon: LayoutGrid, title: "Campanhas", tagline: "Liga, pausa e ajusta verba.", to: "/met", steps: ["Abra a lista de campanhas", "Toque numa campanha para ver conjuntos e anúncios", "Pause, ative ou mude o orçamento — é real"], tip: "Toda alteração fica registrada em Atividades." },
  { id: "criar", icon: Zap, title: "Criar campanha", tagline: "Do zero ao ar.", to: "/met/criar", steps: ["Defina objetivo e orçamento", "Monte público e envie o criativo", "Revise e publique"], tip: "Você também pode pedir ao Crowley para montar." },
  { id: "bm", icon: Building2, title: "BMs, contas e pixels", tagline: "Seus ativos da Meta.", to: "/bm", steps: ["Veja BMs, contas, páginas e pixels", "Crie conta de anúncio ou pixel em Contas e ativos", "Para novas BMs: Usuário do Sistema + token novo"], tip: "Cartões e cobrança só no Facebook." },
  { id: "utm", icon: Link2, title: "Rastreamento", tagline: "De onde vem cada venda.", to: "/utm/visitantes", steps: ["Gere links UTM", "Cole o script nas suas páginas", "Veja primeiro e último clique e o funil por etapas"], tip: "Os gateways enviam vendas pelos links em Integrações." },
  { id: "metr", icon: BarChart3, title: "Métricas e relatórios", tagline: "Números para decidir.", to: "/relatorios", steps: ["Escolha período e filtros", "Compare campanhas e produtos", "Exporte em planilha"], tip: "Troque a moeda em Configurações." },
  { id: "pag", icon: FileText, title: "Páginas", tagline: "Monte por blocos.", to: "/paginas", steps: ["Escolha um modelo", "Edite blocos, textos e checkout", "Baixe ou publique"], tip: "Pixel e UTMs entram sozinhos na página." },
  { id: "fun", icon: Workflow, title: "Funis", tagline: "Desenhe a jornada.", to: "/funis", steps: ["Arraste etapas da biblioteca", "Ligue as etapas e defina conversões", "Toque no disquete para salvar e abra em Meus funis"], tip: "Use Simular para prever vendas." },
  { id: "auto", icon: Zap, title: "Automações", tagline: "Trabalham com o app fechado.", to: "/automacoes", steps: ["Escolha o gatilho (venda, Pix, carrinho…)", "Adicione mensagens, esperas e condições", "Ative o fluxo"], tip: "O botão de emergência em Atividades pausa tudo." },
  { id: "prod", icon: Package, title: "Produtos e ofertas", tagline: "Margem e espionagem.", to: "/produtos", steps: ["Cadastre preço e custo", "Ligue o produto às campanhas", "Monitore concorrentes no Radar"], tip: "O lucro estimado usa o custo cadastrado." },
  { id: "crm", icon: Users, title: "CRM e atendimento", tagline: "Cada cliente num lugar.", to: "/crm", steps: ["Veja contatos e tarefas", "Responda no Atendimento", "Deixe a IA responder ou assuma"], tip: "WhatsApp sai pelo seu servidor Render." },
  { id: "crow", icon: Bot, title: "Crowley", tagline: "Seu parceiro de operação.", to: "/crowley", steps: ["Converse como com um colega", "Ele propõe ações e você aprova", "Escolha o estilo dele em Configurações"], tip: "Nada é executado sem sua aprovação." },
  { id: "agent", icon: ShieldCheck, title: "Agentes ADS", tagline: "Vigias sob suas regras.", to: "/agentes", steps: ["Explique a estratégia em conversa", "Revise a regra montada", "Ative — ele vigia 24h"], tip: "Cada agente fica preso à conta escolhida." },
  { id: "sup", icon: MessagesSquare, title: "Notificações", tagline: "Alertas no celular.", to: "/notificacoes", steps: ["Instale o app na tela inicial", "Ative alertas em Configurações", "Receba avisos de vendas e agentes"], tip: "Funciona no app publicado, não na prévia." },
  { id: "conf", icon: Settings, title: "Configurações", tagline: "Do seu jeito.", to: "/configuracoes", steps: ["Escolha o estilo do painel", "Ligue o modo demo para ver tudo cheio", "Veja o status do WhatsApp"], tip: "Estilo e demo valem só no aparelho." },
];

function Guide() {
  const [sel, setSel] = useState(TOPICS[0]!.id);
  const t = TOPICS.find((x) => x.id === sel)!;
  const Icon = t.icon;
  return (
    <div className="space-y-5 p-4 pb-24 md:p-6">
      <PageHead title="Guia do usuário" sub="Toque num tema. Três passos e uma dica." />
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TOPICS.map((x) => { const I = x.icon; return (
          <button key={x.id} type="button" onClick={() => setSel(x.id)} aria-pressed={sel === x.id}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${sel === x.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
            <I className="h-3.5 w-3.5" />{x.title}
          </button>); })}
      </div>
      <div key={t.id} className="panel guide-rise space-y-5 border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <div className="guide-pulse flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary"><Icon className="h-7 w-7" /></div>
          <div><h2 className="font-display text-2xl">{t.title}</h2><p className="text-sm text-muted-foreground">{t.tagline}</p></div>
        </div>
        <ol className="grid gap-3 md:grid-cols-3">
          {t.steps.map((s, i) => (
            <li key={s} className="guide-rise relative rounded-xl border border-border bg-background/40 p-4" style={{ animationDelay: `${150 + i * 180}ms` }}>
              <span className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
              <p className="text-sm">{s}</p>
              {i < t.steps.length - 1 && <svg className="absolute -right-3 top-1/2 hidden h-4 w-6 md:block" viewBox="0 0 24 8" aria-hidden><line x1="0" y1="4" x2="24" y2="4" stroke="var(--primary)" strokeWidth="2" className="guide-flow" /></svg>}
            </li>
          ))}
        </ol>
        <p className="guide-rise rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm" style={{ animationDelay: "750ms" }}>💡 {t.tip}</p>
        <Link to={t.to} className="inline-flex rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Abrir {t.title}</Link>
      </div>
    </div>
  );
}
