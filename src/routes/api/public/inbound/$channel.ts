import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const TOKEN = /^[a-f0-9]{48}$/;

/** Extracts sender and text from Telegram updates or the WhatsApp (Render) server's generic JSON. */
export function parseInbound(channel: string, body: any): { from: string; name: string; text: string } | null {
  if (channel === "telegram") {
    const m = body?.message ?? body?.edited_message;
    if (!m?.chat?.id || typeof m.text !== "string") return null;
    return { from: String(m.chat.id), name: [m.from?.first_name, m.from?.last_name].filter(Boolean).join(" "), text: m.text };
  }
  if (body?.data?.key?.remoteJid) {
    const d = body.data;
    if (d.key.fromMe || String(d.key.remoteJid).endsWith("@g.us")) return null;
    const t = d.message?.conversation ?? d.message?.extendedTextMessage?.text ?? d.message?.imageMessage?.caption;
    if (typeof t !== "string" || !t.trim()) return null;
    return { from: String(d.key.remoteJid).replace(/@.*$/, "").replace(/\D/g, ""), name: String(d.pushName ?? ""), text: t };
  }
  const from = body?.phone ?? body?.from ?? body?.sender ?? body?.key?.remoteJid;
  const text = body?.message ?? body?.text ?? body?.body;
  if (!from || typeof text !== "string" || !text.trim()) return null;
  return { from: String(from).replace(/@.*$/, "").replace(/\D/g, ""), name: String(body?.name ?? body?.pushName ?? ""), text };
}

/** Inbound messages for the support inbox; the private webhook token identifies the owner. */
export const Route = createFileRoute("/api/public/inbound/$channel")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const channel = z.enum(["whatsapp", "telegram"]).safeParse(params.channel);
        const token = new URL(request.url).searchParams.get("token") ?? "";
        if (!channel.success || !TOKEN.test(token)) return new Response("Unauthorized", { status: 401 });
        const raw = await request.text();
        if (raw.length > 100_000) return new Response("Too large", { status: 413 });
        let body: unknown; try { body = JSON.parse(raw); } catch { return new Response("Bad JSON", { status: 400 }); }
        const msg = parseInbound(channel.data, body);
        if (!msg) return Response.json({ ok: true, ignored: true });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: owner } = await supabaseAdmin.from("user_settings").select("user_id").eq("webhook_token", token).maybeSingle();
        if (!owner) return new Response("Unauthorized", { status: 401 });
        const uid = owner.user_id;
        const pos = Math.floor(Date.now() / 1000);
        const { data: found } = await supabaseAdmin.from("contacts").select("id,data").eq("user_id", uid).eq("data->>phone", msg.from).limit(1);
        let contactId = found?.[0]?.id as string | undefined;
        if (!contactId) {
          contactId = crypto.randomUUID();
          await supabaseAdmin.from("contacts").insert({ id: contactId, user_id: uid, position: -pos, data: { id: contactId, name: msg.name || msg.from, email: "", phone: msg.from, source: channel.data, tags: [], stage: "Novo", fields: {}, notes: [], createdAt: Date.now() } });
        }
        const id = crypto.randomUUID();
        const { error } = await supabaseAdmin.from("messages").insert({ id, user_id: uid, position: pos, data: { id, contactId, channel: channel.data, from: "cliente", text: msg.text.slice(0, 4000), at: Date.now() } });
        if (error) { console.error("inbound store", error); return new Response("Store failed", { status: 500 }); }
        const { data: conv } = await supabaseAdmin.from("conversations").select("data").eq("user_id", uid).eq("id", contactId).maybeSingle();
        const prev = (conv?.data ?? {}) as Record<string, string>;
        await supabaseAdmin.from("conversations").upsert({ id: contactId, user_id: uid, position: -pos, data: { contactId, productId: prev["productId"] ?? "", mode: prev["mode"] ?? "ia", status: "aberta", category: prev["category"] ?? "", updatedAt: Date.now() } }, { onConflict: "user_id,id" });
        await supabaseAdmin.from("notifications").insert({ user_id: uid, kind: "atendimento", title: `Mensagem de ${msg.name || msg.from}`, body: msg.text.slice(0, 200), link: "/suporte" });
        return Response.json({ ok: true });
      },
    },
  },
});
