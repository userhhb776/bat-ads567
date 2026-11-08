import { createFileRoute } from "@tanstack/react-router";
import { normalizeGateway } from "@/lib/tracking/gateway";

const PLATFORM = /^[a-z0-9_-]{2,30}$/;
const TOKEN = /^[a-f0-9]{48}$/;

export const Route = createFileRoute("/api/public/webhooks/$platform")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const token = new URL(request.url).searchParams.get("token") ?? "";
        if (!PLATFORM.test(params.platform) || !TOKEN.test(token)) return new Response("Unauthorized", { status: 401 });
        const raw = await request.text();
        if (raw.length > 512_000) return new Response("Too large", { status: 413 });
        let body: unknown;
        try { body = JSON.parse(raw); } catch {
          body = Object.fromEntries(new URLSearchParams(raw));
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: owner } = await supabaseAdmin.from("user_settings").select("user_id").eq("webhook_token", token).maybeSingle();
        if (!owner) return new Response("Unauthorized", { status: 401 });
        const ev = normalizeGateway(body);
        if (!ev) return Response.json({ ok: true, ignored: true });
        const { error } = await supabaseAdmin.from("gateway_events").upsert({
          user_id: owner.user_id, platform: params.platform, ...ev, payload: body as never,
        }, { onConflict: "user_id,platform,external_id,status", ignoreDuplicates: true });
        if (error) { console.error("webhook store failed", error); return new Response("Store failed", { status: 500 }); }
        return Response.json({ ok: true });
      },
    },
  },
});
