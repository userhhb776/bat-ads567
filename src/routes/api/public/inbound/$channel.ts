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
        const b = body as any;
        const waId = typeof b?.data?.key?.id === "string" ? String(b.data.key.id) : "";
        if (waId) {
          const { data: dup } = await supabaseAdmin.from("messages").select("id").eq("user_id", uid).eq("data->>waId", waId).limit(1);
          if (dup?.length) return Response.json({ ok: true, duplicate: true });
        }
        const { data: found } = await supabaseAdmin.from("contacts").select("id,data").eq("user_id", uid).eq("data->>phone", msg.from).limit(1);
        let contactId = found?.[0]?.id as string | undefined;
        if (!contactId) {
          contactId = crypto.randomUUID();
          await supabaseAdmin.from("contacts").insert({ id: contactId, user_id: uid, position: -pos, data: { id: contactId, name: msg.name || msg.from, email: "", phone: msg.from, source: channel.data, tags: [], stage: "Novo", fields: {}, notes: [], createdAt: Date.now() } });
        }
        const id = crypto.randomUUID();
        const { error } = await supabaseAdmin.from("messages").insert({ id, user_id: uid, position: pos, data: { id, contactId, channel: channel.data, from: "cliente", text: msg.text.slice(0, 4000), at: Date.now(), ...(waId ? { waId } : {}) } });
        if (error) { console.error("inbound store", error); return new Response("Store failed", { status: 500 }); }
        const { data: conv } = await supabaseAdmin.from("conversations").select("data").eq("user_id", uid).eq("id", contactId).maybeSingle();
        const prev = (conv?.data ?? {}) as Record<string, string>;
        let mode = prev["mode"] ?? "ia", category = prev["category"] ?? "", replied = "";
        let productId = prev["productId"] ?? "";
        // WhatsApp auto-reply: the product's support agent answers unless the kill-switch is on or a human took over.
        if (channel.data === "whatsapp") {
          const { data: cfgRows } = await supabaseAdmin.from("app_state").select("key,value").eq("user_id", uid).in("key", ["bg.wa-autoreply", "bg.kill-switch"]);
          const cfg = (cfgRows?.find((r) => r.key === "bg.wa-autoreply")?.value ?? {}) as { enabled?: boolean; productId?: string };
          const stop = cfgRows?.find((r) => r.key === "bg.kill-switch")?.value === true;
          productId ||= cfg.productId ?? "";
          if (cfg.enabled && !stop && mode === "ia" && productId) {
            const { data: prod } = await supabaseAdmin.from("products").select("data").eq("user_id", uid).eq("id", productId).maybeSingle();
            const p = (prod?.data ?? {}) as { name?: string; knowledge?: string };
            const { data: hist } = await supabaseAdmin.from("messages").select("data").eq("user_id", uid).eq("data->>contactId", contactId).order("position", { ascending: false }).limit(20);
            const history = (hist ?? []).map((h) => h.data as { from: string; text: string }).reverse();
            const { generateReply } = await import("@/lib/support-ai.server");
            const r = await generateReply(p.name ?? "", p.knowledge ?? "", history);
            if (!r.error && r.text) {
              const { deliver } = await import("@/lib/channels.server");
              const instance = typeof b?.instance === "string" ? b.instance : "";
              const sent = await deliver("whatsapp", instance ? `${instance}|${msg.from}` : msg.from, r.text);
              if (sent.ok) {
                const rid = crypto.randomUUID();
                await supabaseAdmin.from("messages").insert({ id: rid, user_id: uid, position: pos + 1, data: { id: rid, contactId, channel: "whatsapp", from: "ia", text: r.text.slice(0, 4000), at: Date.now() } });
                replied = r.text;
              } else console.error("wa autoreply send", sent.error);
              category = r.category || category;
              if (r.handoff) mode = "humano";
            } else if (r.error) console.error("wa autoreply ai", r.error);
          }
        }
        await supabaseAdmin.from("conversations").upsert({ id: contactId, user_id: uid, position: -pos, data: { contactId, productId, mode, status: "aberta", category, updatedAt: Date.now() } }, { onConflict: "user_id,id" });
        const { notifyUser } = await import("@/lib/notify.server");
        await notifyUser(supabaseAdmin, uid, { kind: "atendimento", title: `${mode === "humano" && !replied ? "Precisa de você: " : ""}Mensagem de ${msg.name || msg.from}`, body: msg.text.slice(0, 200), link: "/suporte" }, !replied || mode === "humano");
        return Response.json({ ok: true });
      },
    },
  },
});
