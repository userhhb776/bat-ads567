import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { sourceOf } from "@/lib/tracking/attribution";

const TOKEN = /^[a-f0-9]{48}$/;
const Body = z.object({
  v: z.string().min(6).max(64), s: z.string().min(6).max(64), e: z.string().max(40).default("pageview"),
  u: z.string().max(2000).optional(), r: z.string().max(2000).optional(),
  utm: z.record(z.string().max(300)).optional(), email: z.string().email().max(200).optional(), phone: z.string().max(30).optional(),
});
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type" };

/** Receives visitor events from the tracking script on the user's sites; the private token identifies the owner. */
export const Route = createFileRoute("/api/public/track")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token") ?? "";
        if (!TOKEN.test(token)) return new Response("Unauthorized", { status: 401, headers: CORS });
        const raw = await request.text();
        if (raw.length > 20_000) return new Response("Too large", { status: 413, headers: CORS });
        let parsed; try { parsed = Body.safeParse(JSON.parse(raw)); } catch { return new Response("Bad JSON", { status: 400, headers: CORS }); }
        if (!parsed.success) return new Response("Invalid", { status: 400, headers: CORS });
        const b = parsed.data;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: owner } = await supabaseAdmin.from("user_settings").select("user_id").eq("webhook_token", token).maybeSingle();
        if (!owner) return new Response("Unauthorized", { status: 401, headers: CORS });
        const utm = b.utm ?? {};
        const { error } = await (supabaseAdmin as any).from("track_events").insert({
          user_id: owner.user_id, visitor_id: b.v, session_id: b.s, event: b.e, url: b.u ?? null, referrer: b.r ?? null,
          utm, source: sourceOf(utm, b.r ?? null), email: b.email ?? null, phone: b.phone ?? null,
        });
        if (error) { console.error("track store", error); return new Response("Store failed", { status: 500, headers: CORS }); }
        return new Response(null, { status: 204, headers: CORS });
      },
    },
  },
});
