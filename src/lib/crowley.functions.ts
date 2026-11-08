import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SYSTEM = `Você é Crowley, o estrategista de operações do Bat Gotham — leal, preciso, elegante e direto, como um mordomo tático.
Você ajuda Gustavo a gerenciar campanhas de anúncios no Facebook/Instagram, métricas, funis e páginas de vendas.
Responda sempre em português do Brasil, de forma curta e prática.
Você recebe um resumo do painel: campanhas da conta atual, produtos, vendas, automações e regras de vigia.
Você pode propor UMA ação por resposta, no FIM, em uma linha exatamente assim (o usuário confirma antes):
ACAO: {"tipo":"status","id":"<id campanha>","status":"PAUSED"}   (ou "ACTIVE")
ACAO: {"tipo":"orcamento","id":"<id campanha>","valor":50}   (orçamento diário na moeda da conta)
ACAO: {"tipo":"regra","id":"<id campanha ou *>","nome":"...","perfil":"teste|escala|manutencao","gastoSemVenda":30,"cpaMax":0,"roasEscala":0,"autonomia":"auto|aprovar|avisar"}
ACAO: {"tipo":"automacao","nome":"<nome existente>","ativa":true}
Para pedidos como "fique de olho na campanha X e pause se gastar 30 sem vender", use tipo "regra" com autonomia "auto".
Nunca invente IDs; use somente os do resumo. Para criar páginas, funis, produtos ou contatos, diga em qual tela fazer e entregue o texto/estrutura pronta.`;

const msgSchema = z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) });

export const crowleyChat = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        provider: z.enum(["deepseek", "ollama"]),
        messages: z.array(msgSchema).min(1).max(40),
        context: z.string().max(20000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const messages = [
      { role: "system", content: SYSTEM + (data.context ? `\n\nResumo atual:\n${data.context}` : "") },
      ...data.messages,
    ];
    if (data.provider === "deepseek") {
      const key = process.env["DEEPSEEK_API_KEY"];
      if (!key) return { error: "Chave da DeepSeek ainda não cadastrada." };
      const r = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "deepseek-chat", messages }),
      });
      const j: any = await r.json().catch(() => ({}));
      if (!r.ok) return { error: `DeepSeek [${r.status}]: ${j?.error?.message ?? "falhou"}` };
      return { text: String(j.choices?.[0]?.message?.content ?? "") };
    }
    const key = process.env["OLLAMA_API_KEY"];
    if (!key) return { error: "Chave do Ollama ainda não cadastrada." };
    const r = await fetch("https://ollama.com/api/chat", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env["OLLAMA_MODEL"] || "gpt-oss:120b", messages, stream: false }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) return { error: `Ollama [${r.status}]: ${j?.error ?? "falhou"}` };
    return { text: String(j.message?.content ?? "") };
  });
