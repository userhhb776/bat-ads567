/** Server-only AI call for strategy agents: DeepSeek first (JSON mode), Ollama cloud as fallback. */
export async function askAgentAi(system: string, user: string): Promise<{ text: string; error: string }> {
  const messages = [{ role: "system", content: system }, { role: "user", content: user }];
  const dkey = process.env["DEEPSEEK_API_KEY"], okey = process.env["OLLAMA_API_KEY"];
  const fails: string[] = [];
  if (dkey) {
    try {
      const r = await fetch("https://api.deepseek.com/chat/completions", { method: "POST", signal: AbortSignal.timeout(40000), headers: { Authorization: `Bearer ${dkey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "deepseek-chat", messages, temperature: 0.2, response_format: { type: "json_object" } }) });
      if (r.ok) { const j: any = await r.json(); return { text: String(j.choices?.[0]?.message?.content ?? ""), error: "" }; }
      fails.push(r.status === 402 ? "saldo da DeepSeek acabou" : `DeepSeek ${r.status}`);
    } catch { fails.push("DeepSeek sem resposta"); }
  }
  if (okey) {
    try {
      const r = await fetch("https://ollama.com/api/chat", { method: "POST", signal: AbortSignal.timeout(40000), headers: { Authorization: `Bearer ${okey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: process.env["OLLAMA_MODEL"] || "gpt-oss:120b", messages, stream: false, format: "json" }) });
      if (r.ok) { const j: any = await r.json(); return { text: String(j.message?.content ?? ""), error: "" }; }
      fails.push(`Ollama ${r.status}`);
    } catch { fails.push("Ollama sem resposta"); }
  }
  return { text: "", error: fails.join("; ") || "Nenhuma chave de IA cadastrada." };
}
