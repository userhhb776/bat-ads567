import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { parseInbound } from "../inbound/$channel";

/** Telegram webhook for one support agent bot: stores the message and lets the product's agent answer. */
export const Route = createFileRoute("/api/public/telegram/$botId")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!/^[0-9a-f-]{36}$/.test(params.botId)) return new Response("Unauthorized", { status: 401 });
        const raw = await request.text();
        if (raw.length > 100_000) return new Response("Too large", { status: 413 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: bot } = await supabaseAdmin.from("support_bots").select("id,user_id,token,secret,product_id,name").eq("id", params.botId).maybeSingle();
        const got = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
        if (!bot || got.length !== bot.secret.length || !timingSafeEqual(Buffer.from(got), Buffer.from(bot.secret))) return new Response("Unauthorized", { status: 401 });
        let body: unknown; try { body = JSON.parse(raw); } catch { return new Response("Bad JSON", { status: 400 }); }
        const msg = parseInbound("telegram", body);
        if (!msg) return Response.json({ ok: true, ignored: true });
        const uid = bot.user_id;
        const pos = Math.floor(Date.now() / 1000);
        const { data: found } = await supabaseAdmin.from("contacts").select("id").eq("user_id", uid).eq("data->>phone", msg.from).eq("data->fields->>botId", bot.id).limit(1);
        let contactId = found?.[0]?.id as string | undefined;
        if (!contactId) {
          contactId = crypto.randomUUID();
          await supabaseAdmin.from("contacts").insert({ id: contactId, user_id: uid, position: -pos, data: { id: contactId, name: msg.name || msg.from, email: "", phone: msg.from, source: "telegram", tags: [bot.name], stage: "Novo", fields: { botId: bot.id }, notes: [], createdAt: Date.now() } });
        }
        const save = (from: string, text: string) => { const id = crypto.randomUUID(); return supabaseAdmin.from("messages").insert({ id, user_id: uid, position: Math.floor(Date.now() / 1000), data: { id, contactId, channel: "telegram", from, text: text.slice(0, 4000), at: Date.now() } }); };
        await save("cliente", msg.text);
        const { data: conv } = await supabaseAdmin.from("conversations").select("data").eq("user_id", uid).eq("id", contactId).maybeSingle();
        const prev = (conv?.data ?? {}) as Record<string, string>;
        let mode = prev["mode"] ?? "ia", category = prev["category"] ?? "";
        const productId = prev["productId"] || bot.product_id;
        const { data: stop } = await supabaseAdmin.from("app_state").select("value").eq("user_id", uid).eq("key", "bg.kill-switch").maybeSingle();
        if (mode === "ia" && stop?.value !== true) {
          const { data: prod } = productId ? await supabaseAdmin.from("products").select("data").eq("user_id", uid).eq("id", productId).maybeSingle() : { data: null };
          const p = (prod?.data ?? {}) as { name?: string; knowledge?: string };
          const { data: hist } = await supabaseAdmin.from("messages").select("data").eq("user_id", uid).eq("data->>contactId", contactId).order("position", { ascending: false }).limit(20);
          const history = (hist ?? []).map((h) => h.data as { from: string; text: string }).reverse();
          const { generateReply, telegramSend } = await import("@/lib/support-ai.server");
          const r = await generateReply(p.name ?? bot.name, p.knowledge ?? "", history);
          if (!r.error && r.text) {
            const s = await telegramSend(bot.token, msg.from, r.text);
            if (s.ok) await save("ia", r.text);
            category = r.category || category;
            if (r.handoff) mode = "humano";
          }
        }
        await supabaseAdmin.from("conversations").upsert({ id: contactId, user_id: uid, position: -pos, data: { contactId, productId, mode, status: "aberta", category, updatedAt: Date.now() } }, { onConflict: "user_id,id" });
        const { notifyUser } = await import("@/lib/notify.server");
        await notifyUser(supabaseAdmin, uid, { kind: "atendimento", title: `${bot.name}: ${msg.name || msg.from}`.slice(0, 80), body: msg.text.slice(0, 200), link: "/suporte" }, mode === "humano");
        return Response.json({ ok: true });
      },
    },
  },
});
