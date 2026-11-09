import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Published address Telegram calls; previews are private, so webhooks always point here. */
const PUBLIC_URL = "https://bat-ads567.lovable.app";

export type BotRow = { id: string; name: string; product_id: string; username: string; created_at: string };

/** Lists the user's Telegram support agents; the bot token never leaves the server. */
export const listBots = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("support_bots").select("id,name,product_id,username,created_at").eq("user_id", context.userId).order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as BotRow[];
});

/** Validates the BotFather token, stores it and points the bot's webhook at this app. */
export const createBot = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().trim().min(1).max(80), productId: z.string().max(100), token: z.string().trim().regex(/^\d{5,}:[\w-]{30,}$/, "Token do BotFather inválido") }).parse(d))
  .handler(async ({ data, context }) => {
    const me = await fetch(`https://api.telegram.org/bot${data.token}/getMe`).then((r) => r.json()).catch(() => null) as any;
    if (!me?.ok) throw new Error("O Telegram recusou esse token. Copie de novo no @BotFather.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const secret = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
    const { data: row, error } = await supabaseAdmin.from("support_bots").insert({ user_id: context.userId, name: data.name, product_id: data.productId, token: data.token, secret, username: String(me.result?.username ?? "") }).select("id").single();
    if (error) throw new Error(error.message);
    const hook = await fetch(`https://api.telegram.org/bot${data.token}/setWebhook`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: `${PUBLIC_URL}/api/public/telegram/${row.id}`, secret_token: secret, allowed_updates: ["message"] }) }).then((r) => r.json()).catch(() => null) as any;
    await supabaseAdmin.from("audit_log").insert({ user_id: context.userId, actor: "chefe", module: "atendimento", action: "criar_bot", target: row.id, after: { name: data.name, username: me.result?.username } as never, result: hook?.ok ? "ok" : "webhook_falhou" });
    return { id: row.id as string, username: String(me.result?.username ?? ""), webhook: !!hook?.ok };
  });

export const deleteBot = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: bot } = await supabaseAdmin.from("support_bots").select("token").eq("id", data.id).eq("user_id", context.userId).maybeSingle();
    if (!bot) throw new Error("Bot não encontrado.");
    await fetch(`https://api.telegram.org/bot${bot.token}/deleteWebhook`).catch(() => null);
    await supabaseAdmin.from("support_bots").delete().eq("id", data.id).eq("user_id", context.userId);
    await supabaseAdmin.from("audit_log").insert({ user_id: context.userId, actor: "chefe", module: "atendimento", action: "remover_bot", target: data.id, result: "ok" });
    return { ok: true };
  });

export const updateBotProduct = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), productId: z.string().max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("support_bots").update({ product_id: data.productId }).eq("id", data.id).eq("user_id", context.userId);
    return { ok: true };
  });
