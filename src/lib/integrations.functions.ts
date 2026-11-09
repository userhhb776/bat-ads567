import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const platform = z.string().regex(/^[a-z0-9_-]{2,30}$/);
const mask = (v: string) => (v ? `••••${v.slice(-4)}` : "");

/** Gateway tokens are service-role only: the browser sees masked values. */
export const listGatewayCreds = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("gateway_credentials" as never).select("platform, token, secret, updated_at").eq("user_id", context.userId);
  return ((data ?? []) as { platform: string; token: string; secret: string; updated_at: string }[]).map((r) => ({ platform: r.platform, token: mask(r.token), secret: mask(r.secret), updatedAt: r.updated_at }));
});

export const saveGatewayCred = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ platform, token: z.string().max(2000), secret: z.string().max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("gateway_credentials" as never).upsert({ user_id: context.userId, platform: data.platform, token: data.token.trim(), secret: data.secret.trim(), updated_at: new Date().toISOString() } as never, { onConflict: "user_id,platform" });
    if (error) throw new Error("Não consegui salvar o token.");
    await supabaseAdmin.from("audit_log").insert({ user_id: context.userId, actor: "user", action: "gateway_credentials.save", target: data.platform } as never);
    return { ok: true };
  });

export const deleteGatewayCred = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ platform }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("gateway_credentials" as never).delete().eq("user_id", context.userId).eq("platform", data.platform);
    return { ok: true };
  });

const COUNTED = ["track_events", "messages", "audit_log", "automation_runs", "watch_log", "notifications", "gateway_events", "jobs", "contacts", "crowley_messages"] as const;
const PURGEABLE = ["track_events", "watch_log", "automation_runs", "notifications"] as const;

export const dbHealth = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const out: { table: string; rows: number | null; purgeable: boolean }[] = [];
  for (const t of COUNTED) {
    const { count, error } = await context.supabase.from(t as never).select("*", { count: "exact", head: true });
    out.push({ table: t, rows: error ? null : count ?? 0, purgeable: (PURGEABLE as readonly string[]).includes(t) });
  }
  return out;
});

/** Removes only high-volume logs older than N days, for the caller only. */
export const purgeLogs = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ days: z.number().int().min(2).max(365) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const before = new Date(Date.now() - data.days * 86400000).toISOString();
    let removed = 0;
    for (const t of PURGEABLE) {
      const { count } = await supabaseAdmin.from(t as never).delete({ count: "exact" }).eq("user_id", context.userId).lt("created_at", before);
      removed += count ?? 0;
    }
    await supabaseAdmin.from("audit_log").insert({ user_id: context.userId, actor: "user", action: "logs.purge", target: `${data.days}d`, detail: { removed } } as never);
    return { removed };
  });
