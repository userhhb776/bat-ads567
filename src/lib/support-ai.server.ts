/** Server-only support agent reply grounded on a product knowledge base (Ollama first, DeepSeek fallback). */
export type Reply = { text: string; handoff: boolean; category: string; error: string };

export function parseReply(raw: string): Reply {
  const cat = raw.match(/CATEGORIA:\s*(\w+)/i)?.[1] ?? "";
  const text = raw.replace(/CATEGORIA:.*$/im, "").trim();
  return { text: text.replace(/^\[HUMANO\]\s*/, ""), handoff: text.startsWith("[HUMANO]"), category: cat, error: "" };
}

export async function generateReply(product: string, knowledge: string, history: { from: string; text: string }[]): Promise<Reply> {
  const system = `Você é o atendente do produto "${product}". Responda em português, curto, gentil e objetivo, usando SOMENTE a base abaixo. Se não souber, ou se o cliente pedir humano, reembolso ou estiver irritado, responda começando com [HUMANO] e diga que um atendente vai assumir. Classifique no fim com uma linha "CATEGORIA: duvida|acesso|pagamento|reembolso|reclamacao|venda".\n\nBase:\n${knowledge || "(vazia)"}`;
  const messages = [{ role: "system", content: system }, ...history.map((m) => ({ role: m.from === "cliente" ? "user" : "assistant", content: m.text }))];
  const key = process.env["OLLAMA_API_KEY"];
  const dkey = process.env["DEEPSEEK_API_KEY"];
  try {
    if (key) {
      const r = await fetch("https://ollama.com/api/chat", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: process.env["OLLAMA_MODEL"] || "gpt-oss:120b", messages, stream: false }) });
      const j: any = await r.json().catch(() => ({}));
      if (r.ok) return parseReply(String(j.message?.content ?? ""));
    }
    if (dkey) {
      const r = await fetch("https://api.deepseek.com/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${dkey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "deepseek-chat", messages }) });
      const j: any = await r.json().catch(() => ({}));
      if (r.ok) return parseReply(String(j.choices?.[0]?.message?.content ?? ""));
      return { text: "", handoff: false, category: "", error: `DeepSeek ${r.status}` };
    }
    return { text: "", handoff: false, category: "", error: "Nenhuma chave de IA cadastrada." };
  } catch {
    return { text: "", handoff: false, category: "", error: "Falha ao chamar a IA." };
  }
}

export async function telegramSend(token: string, chatId: string, text: string) {
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text }) });
  return r.ok ? { ok: true, error: "" } : { ok: false, error: `Telegram respondeu ${r.status}.` };
}
