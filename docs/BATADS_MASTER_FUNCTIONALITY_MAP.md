# BATADS — MASTER FUNCTIONALITY MAP
Auditoria: 09/11/2026 · Base: código atual (Bat Gotham), Supabase próprio `jfriovkdmxhurvhinzop`.

Legenda: IMPLEMENTADA · INTEGRADA · PARCIAL · PENDENTE · BLOQUEADA · NÃO SUPORTADA

## 0. Diagnóstico técnico geral
| Item | Situação | Impacto |
|---|---|---|
| Persistência | Produtos, pedidos, contatos, conversas, mensagens, automações, logs, regras e histórico da IA usam `useStore` (localStorage do aparelho) com cópia JSON em `app_state` (cloud-sync). | Viola a regra "Supabase como fonte principal". Sem relações, índices, busca nem uso pelo servidor. **Correção prioritária.** |
| Tabelas reais | `app_state`, `gateway_events`, `user_settings`, `watch_log`. RLS por `auth.uid()` em todas. | Base segura, mas insuficiente para os domínios pedidos. |
| Backend | Server functions TanStack (Meta, IA, canais, páginas, push). Rotas públicas: `/api/public/webhooks/$platform` (gateways) e `/api/public/cron/watch` (vigia 24h). Sem Edge Functions. | Correto para a stack. Falta fila/worker genérico. |
| Execução em 2º plano | Só o vigia de campanhas roda com navegador fechado (cron). Automações rodam apenas com o app aberto. | Requisito 9.5 não atendido. |
| Auditoria | `watch_log` registra decisões do vigia. Não há trilha global (antes/depois, agente, módulo). | Requisito 17 não atendido. |
| Testes | 44 testes unitários (regras, moeda, dashboard, roteamento IA, páginas, vendas, automação). | Sem testes de servidor/integração. |
| Organizações/permissões | Uso pessoal, 1 usuário. Sem papéis nem permissões por agente. | Requisito 17 pendente. |

## 1. Dashboard central
| Funcionalidade | Estado | Observação |
|---|---|---|
| Investimento, receita atribuída, ROAS, ROI, compras, leads, CPA/CPL, conversão | IMPLEMENTADA | Dados reais Meta da conta selecionada. |
| Pagamentos aprovados do gateway (separados da receita atribuída) | IMPLEMENTADA | `gateway_events`, conversão de moeda segura. |
| Gráfico diário gasto × receita, filtros produto/campanha/período/origem | IMPLEMENTADA | |
| CPC, CPM, CTR, impressões, alcance, frequência no painel | PARCIAL | Existem em Métricas, não no dashboard. |
| Ticket médio, pedidos, pendentes, reembolsos | PARCIAL | Dados no gateway; cards ausentes. |
| Lucro/prejuízo líquido | BLOQUEADA | Requer custos (produto, taxas, impostos) cadastrados. |
| Campanhas em teste/escala, criativos vencedores, funis top, automações com falha, tarefas IA | PENDENTE | Dependem de tabelas de agentes, criativos, funis e execuções. |
| Filtros BM, plataforma, funil, oferta; comparação entre contas | PENDENTE | |
| Resumo diário da IA | IMPLEMENTADA | Sob demanda. |

## 2. Meta Ads Manager (`meta.functions.ts`, `/met`, `/ativos`)
| Funcionalidade | Estado |
|---|---|
| Listar contas, ativos (páginas, pixels, Instagram), negócios | IMPLEMENTADA |
| Criar conta de anúncios (edge oficial `/adaccount`, com revisão) | IMPLEMENTADA — criação real não testada; elegibilidade definida pela Meta |
| Cartões/pagamento | NÃO SUPORTADA (manual na Meta, por decisão) |
| Várias conexões/BMs simultâneas, desconectar, ver permissões/pessoas | PARCIAL — uma conexão; novas BMs via reautorização |
| Catálogos | PENDENTE |
| Limites/restrições da conta (`getAccountSettings`) | PARCIAL — leitura básica |
| Campanhas: criar (wizard completo), pausar/ativar, orçamento, duplicar | IMPLEMENTADA |
| Editar campos avançados, excluir, orçamento total, lances, limite de gastos | PARCIAL |
| Conversão ABO→CBO de campanha existente | PENDENTE (Meta exige recriação em vários casos) |
| Conjuntos: públicos, local, idade, posicionamentos, otimização, evento, programação, frequência | IMPLEMENTADA na criação; edição PARCIAL |
| Anúncios: upload imagem/vídeo, textos, títulos, CTA, URL, UTM, Advantage+ | IMPLEMENTADA |
| Publicações existentes, prévias, motivo de reprovação | PENDENTE |
| Métricas por campanha/conjunto/anúncio, período | IMPLEMENTADA; comparação entre períodos PENDENTE |
| Pixel: criar, listar | IMPLEMENTADA |
| Pixel: compartilhar, eventos recebidos, teste, qualidade, Conversions API, deduplicação | PENDENTE |

## 3. Analytics e rastreamento (`/utm`, `src/lib/tracking`)
| Funcionalidade | Estado |
|---|---|
| Parser UTM/click IDs, gerador de links | IMPLEMENTADA (histórico de links no aparelho) |
| Webhooks de gateways → `gateway_events` | IMPLEMENTADA — ingestão real não verificada |
| Visitantes, sessões, eventos, dispositivos, referenciadores | PENDENTE — **aguarda seu código de rastreamento (UTMify-like)** |
| Atribuição 1º/último clique, jornada | PENDENTE — idem |
| CAPI server-side, deduplicação, reembolsos | PENDENTE — idem |
| Relatórios faturamento por campanha/anúncio/criativo | PENDENTE |

## 4. Creative Center
Inteiro PENDENTE (biblioteca, tags, ranking CTR/CPA/ROAS, copies). Upload para a Meta já existe e será reutilizado. Requer bucket de armazenamento.

## 5. Page Builder (`/paginas`, `pages.functions.ts`)
| Funcionalidade | Estado |
|---|---|
| Geração/edição por IA, versões, duplicar, pixel+UTM, download, publicar na Vercel | IMPLEMENTADA (dados no aparelho) |
| Editor visual drag-and-drop, blocos, templates, mobile/desktop | PENDENTE — **aguarda seu criador de páginas** |
| Domínios, subdomínios, SSL, despublicar | PENDENTE (via Vercel, token já salvo) |
| Vínculo produto/oferta/funil | PARCIAL |

## 6. Funnel Builder (`/funis`, `src/lib/funnel`)
| Funcionalidade | Estado |
|---|---|
| Canvas React Flow, 297 elementos, conexões, propriedades, templates, simulação, validação de ciclos | INTEGRADA (flowcast) |
| Salvar no banco, versionamento, autosave | PARCIAL (aparelho) |
| Blocos ligados a páginas/ofertas/automações/campanhas reais | PENDENTE |
| Analytics por etapa | PENDENTE — depende do rastreamento |

## 7. Automation Center (`/automacoes`, `automation.ts`)
| Funcionalidade | Estado |
|---|---|
| Gatilhos comerciais, condições, ramificações, atrasos, ações WhatsApp/Telegram, logs | PARCIAL — roda só com app aberto |
| Worker persistente, fila, retentativas, idempotência, pausa/retomada | PENDENTE — **obrigatório** |
| E-mail, consentimento/descadastro, templates WhatsApp oficiais | PENDENTE |
| Construtor visual e modelos prontos | PENDENTE — **aguarda seu projeto (Reportana-like)** |

## 8. CRM (`/crm`) e Atendimento (`/suporte`)
| Funcionalidade | Estado |
|---|---|
| Contatos, tags, campos, pipeline, segmentação, import/export | IMPLEMENTADA (aparelho) → migrar ao banco |
| Responsáveis, tarefas, histórico de atividades | PENDENTE |
| Caixa unificada, base por produto, IA/humano | PARCIAL |
| Recebimento real WhatsApp (Render) / Telegram por webhook | BLOQUEADA — precisa configurar webhook de entrada no Render/Telegram |
| Agentes de atendimento com identidade, limites, transferência | PARCIAL |

## 9. Produtos e vendas (`/produtos`, `sales.ts`, `/ofertas`)
| Funcionalidade | Estado |
|---|---|
| Produtos, ofertas, pedidos, relatórios básicos | IMPLEMENTADA (aparelho) |
| Cupons, bumps, upsell/downsell estruturados | PARCIAL |
| Pagamentos via webhook | IMPLEMENTADA (gateway_events) |
| Radar de ofertas (espionagem) | IMPLEMENTADA (aparelho) |

## 10. Crowley — AI Command (`crowley.functions.ts`, `components/crowley`)
| Funcionalidade | Estado |
|---|---|
| Persona, roteamento DeepSeek/Ollama com fallback, Markdown, histórico, chat flutuante | IMPLEMENTADA |
| Ferramentas com aprovação: status, orçamento, automação, regra | IMPLEMENTADA |
| Ferramentas para criar campanha, página, funil, consultar CRM/vendas, relatórios | PENDENTE |
| Planejamento multi-etapas, histórico de tarefas, memória operacional no banco | PENDENTE |

## 11. Campaign Intelligence (`/inteligencia`, `/agentes`, cron watch)
| Funcionalidade | Estado |
|---|---|
| Perfis teste/escala/manutenção, regras com conta, limites, decisões | IMPLEMENTADA |
| Execução 24h com navegador fechado + push | IMPLEMENTADA — regras ainda lidas do JSON `app_state` |
| Autonomia observação/assistido/autônomo | IMPLEMENTADA (aviso/aprovar/automático) |
| Agentes criados por conversa | IMPLEMENTADA |
| Lançamento agendado, mudança de formato | PENDENTE |
| Botão parar tudo, trava de concorrência, janela de atribuição, horários/dias | PARCIAL |

## 12. Notificações, auditoria, segurança
| Funcionalidade | Estado |
|---|---|
| Push no app instalado | IMPLEMENTADA — entrega no celular não confirmada |
| Central de notificações + preferências | PENDENTE |
| Auditoria global antes/depois | PENDENTE |
| Permissões por ação e por agente | PENDENTE |
| Segredos só no servidor | IMPLEMENTADA |
| Saúde dos serviços | PENDENTE |

## 13. Dependências
```text
Banco por domínio (F2) ─┬─> Fila/worker (F6) ─> Automações 24h, Agentes, Lançamento agendado
                        ├─> Auditoria + Notificações ─> Ações autônomas seguras
                        ├─> Produtos/Pedidos/CRM no banco ─> Relatórios, Dashboard completo
                        └─> Rastreamento (seu código, F3) ─> Atribuição, CAPI, Funil analytics, Criativos vencedores
Page Builder (seu código) ─> Blocos de funil reais ─> Analytics de funil
Ferramentas do Crowley ─> dependem de todos os serviços acima
```

## 14. Plano de execução (prioridade)
1. **F2 Arquitetura de dados** — migração incremental: `products, offers, orders, contacts, deals, conversations, messages, automations, automation_runs, agents, monitor_rules, tasks, notifications, audit_log, creatives, pages, page_versions, funnels, funnel_versions, utm_links, offer_radar`. Importar automaticamente o que já existe em `app_state`/aparelho (sem perda). Camada de serviços em `src/lib/services/*`.
2. **F6 antecipada (núcleo)** — tabela `jobs` + worker por cron (idempotência por chave, retentativas, travas, pausa/cancelar), auditoria e central de notificações. Vigia e automações migram para ela.
3. **F4 Meta** — catálogos, edição completa, exclusão, comparação de períodos, prévias/reprovações, multi-conexão.
4. **F3 Integrações** — rastreamento, automações e page builder **quando você enviar os ZIPs/repositórios**.
5. **F4 restante** — Creative Center, CRM tarefas, notificações, relatórios exportáveis, dashboard completo.
6. **F5 IA** — ferramentas do Crowley para todos os módulos, plano de tarefas, histórico.
7. **F7** — testes de integração, falhas e recuperação.

## 15. Bloqueios externos
- ZIPs/repositórios: rastreamento, automações, criador de páginas.
- Webhooks de entrada do Render (WhatsApp) e bot do Telegram.
- Configuração do gateway apontando para o webhook e um evento de teste.
- Provedor de e-mail (para ações de e-mail).
- Custos por produto/taxas para lucro real.
