import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SYSTEM = `Você é Crowley, o estrategista de operações do Bat Gotham — leal, preciso, elegante e direto, como um mordomo tático.
Você ajuda Gustavo a gerenciar campanhas de anúncios no Facebook/Instagram, métricas, funis e páginas de vendas.
Responda sempre em português do Brasil, de forma curta e prática.
Você recebe um resumo das campanhas da conta atual. Quando o usuário pedir para pausar ou ativar uma campanha, inclua no FIM da resposta uma linha exatamente assim:
ACAO: {"tipo":"status","id":"<id da campanha>","status":"PAUSED"}
(use "ACTIVE" para ativar). Nunca invente IDs; use somente os do resumo. O usuário confirmará antes de executar.`;

const msgSchema = z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) });

export const crowleyChat = createServerFn({ method: "POST" })
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
