import { icons, type LucideIcon } from "lucide-react";
import type { StepData, StepKind } from "./types";

export const COLORS = ["traffic", "page", "content", "sale", "auto", "action", "decision", "crm", "offline", "goal", "visual", "custom"] as const;
export const ICON_NAMES = ["MousePointer2", "Search", "Facebook", "Instagram", "Youtube", "Mail", "MessageCircle", "Send", "Globe", "Megaphone", "Users", "Link", "QrCode", "Monitor", "LayoutTemplate", "PlayCircle", "ShoppingCart", "CreditCard", "TrendingUp", "Target", "GitBranch", "Bot", "Phone", "Store", "FileText", "StickyNote", "Image", "Flag", "Circle", "Square", "Star", "Heart", "Zap", "Calendar", "CheckCircle", "Settings", "Tag", "Code", "Headphones", "BookOpen"] as const;
export type PropertyField = { key: string; label: string; type?: "number" | "text" | "textarea"; default?: string | number };
export type CatalogItem = {
  kind: StepKind; label: string; group: string; groupId: string; icon: LucideIcon; iconName: string;
  color: string; accent: string; isSource?: boolean; paid?: boolean; sellable?: boolean; visual?: boolean;
  shape: "circle" | "page" | "diamond" | "card"; fields: PropertyField[];
  defaults: Omit<StepData, "kind" | "label">;
};
const definitions = [
  {
    "id": "traffic",
    "label": "Fontes de tráfego",
    "color": "traffic",
    "labels": [
      "Meta Ads",
      "Facebook Ads",
      "Instagram Ads",
      "Google Ads",
      "YouTube Ads",
      "TikTok Ads",
      "Pinterest Ads",
      "LinkedIn Ads",
      "X / Twitter Ads",
      "Snapchat Ads",
      "Bing Ads",
      "Native Ads",
      "Display Ads",
      "Tráfego Orgânico",
      "SEO",
      "Google Discover",
      "Google Meu Negócio",
      "Instagram Orgânico",
      "Facebook Orgânico",
      "YouTube Orgânico",
      "TikTok Orgânico",
      "Pinterest Orgânico",
      "E-mail Marketing",
      "WhatsApp",
      "SMS",
      "Telegram",
      "Influenciadores",
      "Afiliados",
      "Indicação / Referral",
      "Links Externos",
      "QR Code",
      "Tráfego Direto",
      "Tráfego de Parceiros",
      "Comunidades",
      "Fóruns",
      "Podcasts",
      "Blogs",
      "Outras Fontes"
    ]
  },
  {
    "id": "pages",
    "label": "Páginas",
    "color": "page",
    "labels": [
      "Landing Page",
      "Página de Captura",
      "Página de Vendas",
      "Página de Pré-venda",
      "Página de Obrigado",
      "Página de Confirmação",
      "Página de Checkout",
      "Página de Pagamento",
      "Página de Upsell",
      "Página de Downsell",
      "Página de Order Bump",
      "Página de Oferta",
      "Página de Produto",
      "Página de Catálogo",
      "Página de Carrinho",
      "Página de Login",
      "Página de Cadastro",
      "Página de Membros",
      "Página de Área de Membros",
      "Página de Webinar",
      "Página de Agendamento",
      "Página de Aplicação",
      "Página de Quiz",
      "Página de Pesquisa",
      "Página de Download",
      "Página de Redirecionamento",
      "Página Externa",
      "Blog / Artigo",
      "Página Institucional",
      "Página de FAQ",
      "Página de Suporte"
    ]
  },
  {
    "id": "content",
    "label": "Vídeos e conteúdo",
    "color": "content",
    "labels": [
      "VSL",
      "Webinar Ao Vivo",
      "Webinar Gravado",
      "Vídeo de Apresentação",
      "Vídeo de Demonstração",
      "Vídeo de Depoimento",
      "Vídeo de Anúncio",
      "Reels",
      "Shorts",
      "Stories",
      "Aula Gratuita",
      "Aula Demonstrativa",
      "Série de Vídeos",
      "Conteúdo Educacional",
      "Podcast",
      "E-book",
      "PDF",
      "Lead Magnet",
      "Isca Digital",
      "Material Gratuito"
    ]
  },
  {
    "id": "sales",
    "label": "Vendas e comércio",
    "color": "sale",
    "labels": [
      "Produto",
      "Oferta",
      "Checkout",
      "Carrinho",
      "Pagamento",
      "Compra Aprovada",
      "Compra Recusada",
      "Pagamento Pendente",
      "Boleto",
      "PIX",
      "Cartão de Crédito",
      "Order Bump",
      "Upsell",
      "Downsell",
      "Cross-sell",
      "Pós-venda",
      "Assinatura",
      "Recorrência",
      "Renovação",
      "Reembolso",
      "Cancelamento",
      "Recuperação de Carrinho",
      "Recuperação de Pagamento",
      "Recuperação de Venda",
      "Venda Adicional",
      "Recompra",
      "Venda Presencial",
      "Venda por Telefone",
      "Venda por WhatsApp",
      "Venda por Consultor",
      "Venda por Representante"
    ]
  },
  {
    "id": "automation",
    "label": "Automação e comunicação",
    "color": "auto",
    "labels": [
      "WhatsApp",
      "WhatsApp Business",
      "E-mail",
      "Sequência de E-mails",
      "SMS",
      "Telegram",
      "Chat Online",
      "Chatbot",
      "Agente de IA",
      "Atendimento Humano",
      "Atendimento Automatizado",
      "Notificação Push",
      "Notificação por E-mail",
      "Notificação por SMS",
      "Mensagem Automática",
      "Remarketing",
      "Retargeting",
      "Recuperação de Leads",
      "Nutrição de Leads",
      "Follow-up",
      "Lembrete Automático",
      "Confirmação Automática",
      "Automação Condicional",
      "Webhook",
      "Integração Externa",
      "CRM",
      "Lista de Contatos",
      "Segmentação de Leads"
    ]
  },
  {
    "id": "actions",
    "label": "Ações e interações",
    "color": "action",
    "labels": [
      "Clique",
      "Clique em Botão",
      "Clique em CTA",
      "Visualização de Página",
      "Visualização de Vídeo",
      "Retenção de Vídeo",
      "Reprodução de Vídeo",
      "Envio de Formulário",
      "Preenchimento de Formulário",
      "Cadastro",
      "Inscrição",
      "Download",
      "Compartilhamento",
      "Acesso a Link",
      "Abertura de E-mail",
      "Clique em E-mail",
      "Resposta de E-mail",
      "Mensagem Enviada",
      "Mensagem Recebida",
      "Conversa Iniciada",
      "Conversa Respondida",
      "Agendamento",
      "Reunião Realizada",
      "Solicitação de Orçamento",
      "Solicitação de Contato",
      "Adição ao Carrinho",
      "Início de Checkout",
      "Início de Pagamento",
      "Compra",
      "Conversão",
      "Lead Gerado",
      "Lead Qualificado",
      "Lead Desqualificado",
      "Abandono",
      "Saída",
      "Rejeição",
      "Aceitação de Oferta",
      "Recompra",
      "Evento Personalizado"
    ]
  },
  {
    "id": "decisions",
    "label": "Decisões e divisões",
    "color": "decision",
    "labels": [
      "Condição",
      "Decisão Sim / Não",
      "Divisão de Caminho",
      "Teste A/B",
      "Teste Multivariado",
      "Segmentação de Público",
      "Lead Qualificado?",
      "Pagamento Aprovado?",
      "Compra Realizada?",
      "Respondeu à Mensagem?",
      "Clicou no CTA?",
      "Abandonou o Checkout?",
      "Assistiu ao Vídeo?",
      "Aceitou o Upsell?",
      "Retornou ao Site?",
      "Regras Personalizadas"
    ]
  },
  {
    "id": "crm",
    "label": "CRM e relacionamento",
    "color": "crm",
    "labels": [
      "Novo Lead",
      "Lead em Atendimento",
      "Lead Qualificado",
      "Lead em Negociação",
      "Proposta Enviada",
      "Proposta Aceita",
      "Proposta Recusada",
      "Venda Fechada",
      "Cliente Ativo",
      "Cliente Inativo",
      "Cliente Recorrente",
      "Cliente Perdido",
      "Pós-venda",
      "Suporte",
      "Solicitação de Ajuda",
      "Pesquisa de Satisfação",
      "Avaliação",
      "Depoimento",
      "Indicação",
      "Programa de Fidelidade",
      "Reativação de Cliente"
    ]
  },
  {
    "id": "offline",
    "label": "Pontos de contato offline",
    "color": "offline",
    "labels": [
      "Loja Física",
      "Atendimento Presencial",
      "Vendedor",
      "Representante Comercial",
      "Telefone",
      "Ligação Recebida",
      "Ligação Realizada",
      "Evento Presencial",
      "Feira",
      "Workshop",
      "Palestra",
      "Reunião",
      "Visita Comercial",
      "Material Impresso",
      "Panfleto",
      "Cartão de Visita",
      "Outdoor",
      "Banner",
      "Rádio",
      "Televisão",
      "Indicação Presencial",
      "Venda em Balcão"
    ]
  },
  {
    "id": "results",
    "label": "Resultados e objetivos",
    "color": "goal",
    "labels": [
      "Conversão",
      "Lead",
      "MQL",
      "SQL",
      "Oportunidade",
      "Venda",
      "Receita",
      "Receita Recorrente",
      "Lucro",
      "Meta de Vendas",
      "Meta de Leads",
      "Meta de Conversão",
      "Meta de Receita",
      "Meta de ROAS",
      "Meta de ROI",
      "Cliente Adquirido",
      "Cliente Retido",
      "Recompra",
      "Objetivo Alcançado",
      "Objetivo Não Alcançado",
      "Fim do Funil"
    ]
  },
  {
    "id": "visual",
    "label": "Elementos visuais e organização",
    "color": "visual",
    "labels": [
      "Texto",
      "Título",
      "Subtítulo",
      "Anotação",
      "Nota Adesiva",
      "Imagem",
      "Vídeo Incorporado",
      "Link",
      "Documento",
      "Checklist",
      "Grupo",
      "Container",
      "Retângulo",
      "Círculo",
      "Linha",
      "Seta",
      "Divisor",
      "Marcador",
      "Bandeira",
      "Meta",
      "Comentário",
      "Etiqueta",
      "Separador de Etapas"
    ]
  },
  {
    "id": "custom",
    "label": "Elementos personalizados",
    "color": "custom",
    "labels": [
      "Ícone Personalizado",
      "Fonte Personalizada",
      "Página Personalizada",
      "Ação Personalizada",
      "Evento Personalizado",
      "Integração Personalizada",
      "Elemento Personalizado"
    ]
  }
];
export const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const slug = (text: string) => normalize(text).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const aliases: Record<string, string> = { "traffic:Meta Ads": "meta-ads", "traffic:Google Ads": "google-ads", "pages:Landing Page": "landing", "content:VSL": "vsl", "sales:Checkout": "checkout", "sales:Upsell": "upsell", "automation:WhatsApp": "whatsapp", "automation:E-mail": "email", "results:Conversão": "conversion" };
export function getIcon(name?: string): LucideIcon { const aliases: Record<string, string> = { PlayCircle: "CirclePlay", CheckCircle: "CircleCheck", XCircle: "CircleX" }; return icons[(aliases[name ?? ""] ?? name) as keyof typeof icons] ?? icons.Square; }
function iconFor(label: string, group: string): string {
  const l = normalize(label);
  const matches: [RegExp, string][] = [[/facebook|meta ads/, "Facebook"], [/instagram|reels|stories/, "Instagram"], [/youtube|shorts/, "Youtube"], [/whatsapp|chat|mensagem|conversa/, "MessageCircle"], [/e-mail|email/, "Mail"], [/telegram|sms/, "Send"], [/google|bing|seo|pesquisa/, "Search"], [/qr/, "QrCode"], [/checkout|carrinho|bump/, "ShoppingCart"], [/pix|pagamento|boleto|cartao/, "CreditCard"], [/upsell|venda|receita|lucro/, "TrendingUp"], [/webinar|video|vsl|aula/, "PlayCircle"], [/podcast|radio/, "Headphones"], [/ebook|e-book|pdf|documento/, "FileText"], [/telefone|ligacao/, "Phone"], [/loja/, "Store"], [/agendamento|reuniao|evento/, "Calendar"], [/ia|bot|automat/, "Bot"], [/link(?!edin)|integracao|webhook/, "Link"], [/lead|cliente|publico|comunidade|afiliado/, "Users"], [/imagem/, "Image"], [/nota|anotacao/, "StickyNote"], [/titulo|texto|subtitulo/, "Type"], [/circulo/, "Circle"], [/seta/, "ArrowRight"], [/bandeira|marcador/, "Flag"], [/meta|objetivo|conversao/, "Target"], [/clique|cta/, "MousePointer2"], [/check|aprovad|confirm|aceit/, "CheckCircle"], [/cancel|recus|rejei|abandono|saida/, "XCircle"], [/suporte|ajuda/, "LifeBuoy"], [/oferta|produto|etiqueta/, "Tag"], [/tiktok|musica/, "Music2"], [/linkedin/, "Linkedin"], [/twitter|x \/|snapchat/, "AtSign"], [/pinterest/, "Pin"], [/ads|anuncio|influenciador/, "Megaphone"]];
  return matches.find(([pattern]) => pattern.test(l))?.[1] ?? ({ traffic: "Globe", pages: "LayoutTemplate", content: "BookOpen", sales: "ShoppingBag", automation: "Zap", actions: "MousePointer2", decisions: "GitBranch", crm: "Contact", offline: "MapPin", results: "Target", visual: "Square", custom: "Settings" }[group] ?? "Square");
}
function fieldsFor(group: string, label: string, paid: boolean): PropertyField[] {
  const l = normalize(label);
  switch (group) {
    case "traffic": return [{ key: "url", label: "URL / link de origem" }, { key: "campaign", label: paid ? "Campanha / UTM" : "Origem / UTM" }];
    case "pages": return [{ key: "url", label: "URL da página" }, { key: "cta", label: "CTA" }, { key: "platform", label: "Plataforma" }];
    case "content": return [{ key: "url", label: "URL do conteúdo" }, ...( /video|vsl|webinar|aula|reels|shorts|stories/.test(l) ? [{ key: "duration", label: "Duração (min)", type: "number" as const }, { key: "retention", label: "Retenção (%)", type: "number" as const }] : [{ key: "format", label: "Formato do material" }])];
    case "sales": return [{ key: "product", label: "Produto / oferta" }, { key: "platform", label: "Plataforma de pagamento" }, { key: "status", label: "Status" }, ...(/assinatura|recorr|renov/.test(l) ? [{ key: "interval", label: "Intervalo de cobrança" }] : [])];
    case "automation": return [{ key: "message", label: "Mensagem / conteúdo", type: "textarea" }, { key: "delay", label: "Espera (min)", type: "number" }, { key: "trigger", label: "Gatilho" }, { key: "url", label: /webhook|integra/.test(l) ? "URL da integração" : "Destino" }];
    case "actions": return [{ key: "event", label: "Nome do evento" }, { key: "selector", label: "Seletor / destino" }, { key: "value", label: "Valor do evento", type: "number" }];
    case "decisions": return [{ key: "condition", label: "Condição / regra", type: "textarea" }, { key: "yes", label: "Caminho positivo", default: "Sim" }, { key: "no", label: "Caminho negativo", default: "Não" }];
    case "crm": return [{ key: "owner", label: "Responsável" }, { key: "stage", label: "Etapa / status" }, { key: "notes", label: "Observações", type: "textarea" }];
    case "offline": return [{ key: "location", label: "Local / endereço" }, { key: "contact", label: "Contato" }, { key: "date", label: "Data / horário" }];
    case "results": return [{ key: "target", label: "Valor da meta", type: "number" }, { key: "unit", label: "Unidade" }, { key: "deadline", label: "Prazo" }];
    case "visual": return [{ key: "content", label: "Conteúdo", type: "textarea" }, { key: "url", label: "URL da mídia / documento" }, { key: "width", label: "Largura", type: "number", default: 224 }, { key: "height", label: "Altura mínima", type: "number", default: 100 }];
    default: return [{ key: "description", label: "Descrição", type: "textarea" }, { key: "url", label: "URL" }];
  }
}
export const CATEGORIES = definitions.map(({ id, label, color }) => ({ id, label, color }));
export const CATALOG: CatalogItem[] = definitions.flatMap((g) => g.labels.map((label) => {
  const kind = aliases[`${g.id}:${label}`] ?? `${g.id}-${slug(label)}`;
  const paid = g.id === "traffic" && /Ads$/.test(label);
  const sellable = g.id === "sales" && /^(Checkout|Upsell|Downsell|Cross-sell|Order Bump|Compra Aprovada|Assinatura|Recorrência|Renovação|Venda Adicional|Recompra|Venda Presencial|Venda por)/.test(label);
  const iconName = iconFor(label, g.id);
  const legacy: Record<string, Partial<StepData>> = { "meta-ads": { budget: 3000, cpc: 1.5 }, "google-ads": { budget: 2000, cpc: 2.2 }, landing: { conversionRate: 35 }, vsl: { conversionRate: 20 }, checkout: { conversionRate: 40, price: 197 }, upsell: { conversionRate: 25, price: 97 }, whatsapp: { conversionRate: 60 }, email: { conversionRate: 30 } };
  return { kind, label: label === "Meta Ads" ? "Anúncios sociais" : label, group: g.label, groupId: g.id, icon: getIcon(iconName), iconName, color: g.color, accent: `--step-${g.color}`, isSource: g.id === "traffic", paid, sellable, visual: g.id === "visual", shape: g.id === "pages" ? "page" : g.id === "decisions" ? "diamond" : g.id === "traffic" || g.id === "results" ? "circle" : "card", fields: fieldsFor(g.id, label, paid), defaults: { conversionRate: 100, ...(g.id === "traffic" ? paid ? { budget: 0, cpc: 1 } : { volume: 0 } : {}), ...(sellable ? { price: 0 } : {}), ...legacy[kind] } } as CatalogItem;
}));
const fallback: CatalogItem = { kind: "custom-element", label: "Elemento personalizado", group: "Elementos personalizados", groupId: "custom", icon: icons.Square, iconName: "Square", color: "custom", accent: "--step-custom", shape: "card", fields: fieldsFor("custom", "", false), defaults: { conversionRate: 100 } };
export const catalogByKind = (kind: StepKind): CatalogItem => CATALOG.find((c) => c.kind === kind) ?? fallback;
export const searchCatalog = (query: string, items = CATALOG) => items.filter((c) => normalize(`${c.label} ${c.group}`).includes(normalize(query.trim())));
export function resolveItem(data: StepData): CatalogItem {
  const item = catalogByKind(data.kind);
  return { ...item, ...(data.definition ?? {}), icon: getIcon(data.iconName ?? data.definition?.iconName ?? item.iconName), color: data.color ?? data.definition?.color ?? item.color };
}
export function createCustomItem(label: string, iconName: string, color: string, fields: PropertyField[]): CatalogItem {
  return { ...fallback, kind: `custom-${crypto.randomUUID()}`, label, iconName, icon: getIcon(iconName), color, fields };
}
