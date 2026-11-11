import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { outlineFromHtml, publicHost } from "./page-outline";

const SYSTEM = `Você é um criador de páginas de vendas de alta conversão. Responda SOMENTE com um único documento HTML completo (<!doctype html> ... </html>), sem comentários fora do código.
Regras: HTML + CSS embutido (pode usar Tailwind via CDN), 100% responsivo para celular, português do Brasil, textos persuasivos reais (sem lorem ipsum), seções: topo com promessa, benefícios, prova social, oferta, garantia, FAQ e chamada final.
Todos os botões de compra devem ter a classe "bg-cta" e href="{{CHECKOUT_URL}}". Não inclua scripts de rastreamento: eles são adicionados automaticamente.`;

export const generatePage = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ prompt: z.string().min(3).max(6000), current: z.string().max(300000).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const key = process.env["DEEPSEEK_API_KEY"];
    if (!key) return { html: "", error: "Chave da DeepSeek ainda não cadastrada." };
    const user = data.current
      ? `Edite esta página conforme o pedido, mantendo o restante.\nPedido: ${data.prompt}\n\nPágina atual:\n${data.current}`
      : data.prompt;
    let text = "";
    try {
      for (let round = 0; round < 4; round++) {
        const messages = [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
          ...(round ? [{ role: "assistant", content: text }, { role: "user", content: "Continue exatamente do último caractere, sem repetir." }] : []),
        ];
        const r = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "deepseek-chat", max_tokens: 8192, temperature: 0.7, messages }),
        });
        const j: any = await r.json().catch(() => ({}));
        if (!r.ok) return { html: "", error: r.status === 402 ? "Saldo da DeepSeek acabou." : `DeepSeek não respondeu (${r.status}).` };
        text += String(j.choices?.[0]?.message?.content ?? "");
        if (j.choices?.[0]?.finish_reason !== "length") break;
      }
    } catch {
      return { html: "", error: "Conexão com a DeepSeek falhou." };
    }
    const html = text.replace(/^[\s\S]*?(<!doctype html|<html)/i, "$1").replace(/```[\s\S]*$/, "").trim();
    if (!/<\/html>/i.test(html)) return { html: "", error: "A página veio incompleta. Tente um pedido menor." };
    return { html, error: "" };
  });

export const publishPage = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().min(1).max(60), slug: z.string().max(60).optional(), html: z.string().min(1).max(500000) }).parse(d))
  .handler(async ({ data, context }) => {
    const token = process.env["VERCEL_TOKEN"];
    if (!token) return { url: "", error: "Para publicar, cadastre o token da Vercel." };
    const { slugify } = await import("./pages");
    const name = slugify(data.slug || data.name) || "pagina";
    const auth = { Authorization: `Bearer ${token}` };
    const r = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ name, target: "production", files: [{ file: "index.html", data: data.html }], projectSettings: { framework: null } }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) return { url: "", error: `Vercel recusou (${r.status}): ${j?.error?.message ?? "erro"}` };
    // The free name.vercel.app address may belong to someone else; read the alias Vercel actually assigned.
    let aliases: string[] = Array.isArray(j.alias) ? j.alias : [];
    for (let i = 0; i < 5 && !aliases.length && j.id; i++) {
      await new Promise((res) => setTimeout(res, 2500));
      const g = await fetch(`https://api.vercel.com/v13/deployments/${encodeURIComponent(j.id)}`, { headers: auth }).catch(() => null);
      const gj: any = g?.ok ? await g.json().catch(() => ({})) : {};
      aliases = Array.isArray(gj.alias) ? gj.alias : [];
    }
    const host = aliases.find((a) => a === `${name}.vercel.app`) ?? aliases.sort((a, b) => a.length - b.length)[0] ?? j.url;
    await context.supabase.from("audit_log").insert({ user_id: context.userId, module: "paginas", action: "publicar", target: name, after: { url: host } as never });
    return { url: `https://${host}`, error: "" };
  });

/** Reads a reference page (e.g. a competitor) and returns only its structure, so the AI can model it without copying. */
export const outlinePage = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ url: z.string().url().max(2000) }).parse(d))
  .handler(async ({ data }) => {
    let u: URL; try { u = new URL(data.url); } catch { return { outline: "", error: "Link inválido." }; }
    if (!publicHost(u)) return { outline: "", error: "Use um link público (https://...)." };
    try {
      const r = await fetch(u, { redirect: "follow", signal: AbortSignal.timeout(15000), headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36", Accept: "text/html" } });
      if (!r.ok) return { outline: "", error: `A página respondeu ${r.status}.` };
      if (!publicHost(new URL(r.url || u.href))) return { outline: "", error: "O link redirecionou para um endereço não permitido." };
      const reader = r.body?.getReader(); if (!reader) return { outline: "", error: "Página vazia." };
      const dec = new TextDecoder(); let html = "", size = 0;
      for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; html += dec.decode(value, { stream: true }); if (size > 2_000_000) { await reader.cancel(); break; } }
      const outline = outlineFromHtml(html);
      if (outline.length < 40) return { outline: "", error: "Não consegui ler o conteúdo (a página pode ser montada só por script)." };
      return { outline, error: "" };
    } catch { return { outline: "", error: "Não consegui abrir esse link agora." }; }
  });
