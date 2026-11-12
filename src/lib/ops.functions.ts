import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const listNotifications = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ limit: z.number().int().min(1).max(500).default(100) }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const markNotifications = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ids: z.array(z.string().uuid()).max(500).optional(), clear: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.clear) { const { error } = await context.supabase.from("notifications").delete().not("read_at", "is", null); if (error) throw new Error(error.message); return { ok: true }; }
    let q = context.supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
    if (data.ids?.length) q = q.in("id", data.ids);
    const { error } = await q; if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAudit = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ module: z.string().max(40).optional(), actor: z.string().max(80).optional(), limit: z.number().int().min(1).max(500).default(200) }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(data.limit);
    if (data.module) q = q.eq("module", data.module);
    if (data.actor) q = q.ilike("actor", `${data.actor}%`);
    const { data: rows, error } = await q; if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Writes an audit entry for actions done directly in the app (e.g. Meta changes). */
export const logAction = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ module: z.string().max(40), action: z.string().max(60), target: z.string().max(200).optional(), actor: z.string().max(80).optional(), before: z.unknown().optional(), after: z.unknown().optional(), result: z.string().max(20).default("ok"), error: z.string().max(1000).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("audit_log").insert({ user_id: context.userId, actor: data.actor ?? "usuario", module: data.module, action: data.action, target: data.target ?? null, before: (data.before ?? null) as never, after: (data.after ?? null) as never, result: data.result, error: data.error ?? null });
    return { ok: true };
  });

const jobSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("meta_update"), payload: z.object({ id: z.string().regex(/^\d+$/), label: z.string().max(200), status: z.enum(["ACTIVE", "PAUSED"]).optional(), daily_budget: z.number().int().positive().optional(), name: z.string().max(200).optional(), actor: z.string().max(80).optional() }) }),
  z.object({ kind: z.literal("message"), payload: z.object({ channel: z.enum(["whatsapp", "telegram", "email"]), to: z.string().min(3).max(200), text: z.string().min(1).max(4000), label: z.string().max(200).optional(), actor: z.string().max(80).optional() }) }),
  z.object({ kind: z.literal("webhook"), payload: z.object({ url: z.string().url().startsWith("https://"), body: z.record(z.string(), z.unknown()).default({}), label: z.string().max(200).optional() }) }),
  z.object({ kind: z.literal("notify"), payload: z.object({ title: z.string().min(1).max(120), body: z.string().max(1000).optional(), actor: z.string().max(80).optional() }) }),
]);

export const createJob = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ job: jobSchema, runAt: z.string().datetime(), dedupeKey: z.string().max(200).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    if (new Date(data.runAt).getTime() < Date.now() - 60000) throw new Error("A data precisa estar no futuro.");
    const { data: row, error } = await context.supabase.from("jobs").insert({ user_id: context.userId, kind: data.job.kind, payload: data.job.payload as never, run_at: data.runAt, dedupe_key: data.dedupeKey ?? null }).select("id").single();
    if (error) throw new Error(error.code === "23505" ? "Essa tarefa já está agendada." : error.message);
    await context.supabase.from("audit_log").insert({ user_id: context.userId, actor: (data.job.payload as any).actor ?? "usuario", module: "tarefas", action: "agendar", target: row.id, after: { ...data.job, runAt: data.runAt } as never });
    return { id: row.id };
  });

export const listJobs = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from("jobs").select("*").order("run_at", { ascending: false }).limit(300);
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const setJobStatus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), status: z.enum(["cancelled", "paused", "queued"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const from = data.status === "queued" ? ["paused", "failed"] : ["queued", "paused"];
    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "queued") { patch["attempts"] = 0; patch["last_error"] = null; }
    const { data: rows, error } = await context.supabase.from("jobs").update(patch as never).eq("id", data.id).in("status", from).select("id");
    if (error) throw new Error(error.message);
    if (!rows?.length) throw new Error("Essa tarefa já está em execução ou concluída.");
    await context.supabase.from("audit_log").insert({ user_id: context.userId, module: "tarefas", action: data.status, target: data.id });
    return { ok: true };
  });

export const getKillSwitch = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data } = await context.supabase.from("app_state").select("value").eq("key", "bg.kill-switch").maybeSingle();
  return { stopped: data?.value === true };
});

export const setKillSwitch = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ stopped: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("app_state").upsert({ user_id: context.userId, key: "bg.kill-switch", value: data.stopped }, { onConflict: "user_id,key" });
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_log").insert({ user_id: context.userId, module: "sistema", action: data.stopped ? "parar_tudo" : "retomar_tudo" });
    await context.supabase.from("notifications").insert({ user_id: context.userId, kind: "sistema", title: data.stopped ? "Todas as automações e agentes foram parados" : "Automações e agentes retomados" });
    return data;
  });

export const getHealth = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const [{ data: hb }, { count: queued }, { count: failed }, { count: autoFails }] = await Promise.all([
    context.supabase.from("app_state").select("value").eq("key", "srv.heartbeat").maybeSingle(),
    context.supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "queued"),
    context.supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "failed"),
    context.supabase.from("notifications").select("id", { count: "exact", head: true }).eq("kind", "falha").gte("created_at", new Date(Date.now() - 86400000).toISOString()),
  ]);
  return {
    heartbeat: (hb?.value ?? null) as null | { at: string; actions?: number; done?: number; failed?: number; runs?: number },
    queued: queued ?? 0, failedJobs: failed ?? 0, failures24h: autoFails ?? 0,
    channels: {
      meta: !!process.env["META_ADS_API_KEY"], whatsapp: await (await import("@/lib/channels.server")).waConfigured().catch(() => !!process.env["RENDER_WHATSAPP_URL"]), telegram: !!process.env["TELEGRAM_BOT_TOKEN"],
      email: !!process.env["RESEND_API_KEY"] && !!process.env["EMAIL_FROM"], deepseek: !!process.env["DEEPSEEK_API_KEY"], ollama: !!process.env["OLLAMA_API_KEY"],
      vercel: !!process.env["VERCEL_TOKEN"], cron: !!process.env["WATCH_CRON_TOKEN"],
    },
  };
});
