import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { intervalOf, normUrl, statusText } from "./cronjob";

export type CronRow = { id: number; kind: "vigilia" | "whatsapp" | "outro"; label: string; url: string; enabled: boolean; every: number | null; last: number; lastOk: boolean; lastText: string; next: number | null; primary: boolean };
export type CronStatus = { configured: boolean; source: "painel" | "sistema" | ""; key: string; jobs: CronRow[]; primary: string; pingOk: boolean; error: string };

const mask = (v: string) => (v ? `••••${v.slice(-4)}` : "");

/** Reads the cron-job.org jobs (one API call) and labels them: automatic watch, WhatsApp ping or other. */
export const cronStatus = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }): Promise<CronStatus> => {
  const { cronKey, cronJobs } = await import("./cronjob.server");
  const { key, source } = await cronKey(context.userId);
  if (!key) return { configured: false, source: "", key: "", jobs: [], primary: "", pingOk: false, error: "" };
  const { waServers } = await import("./channels.server");
  const servers = await waServers(context.userId);
  const primary = servers[0];
  try {
    const jobs = await cronJobs(key);
    const rows: CronRow[] = jobs.map((j) => {
      const wa = servers.find((s) => normUrl(s.url) === normUrl(j.url));
      const kind = j.url.includes("/api/public/cron/watch") ? "vigilia" : wa ? "whatsapp" : "outro";
      const every = intervalOf(j.schedule);
      return {
        id: j.jobId, kind, url: j.url, enabled: j.enabled, every: Number.isFinite(every) ? every : null,
        label: kind === "vigilia" ? "Vigília automática do painel" : wa ? `Ping do WhatsApp · ${wa.name}` : j.title || "Outra tarefa",
        last: j.lastExecution || 0, lastOk: j.lastStatus === 1, lastText: statusText(j.lastStatus), next: j.nextExecution ?? null,
        primary: !!primary && normUrl(primary.url) === normUrl(j.url),
      };
    });
    const pingOk = rows.some((r) => r.primary && r.enabled && (r.every ?? 99) <= 14);
    return { configured: true, source, key: mask(key), jobs: rows, primary: primary?.name ?? "", pingOk, error: "" };
  } catch (e) {
    return { configured: true, source, key: mask(key), jobs: [], primary: primary?.name ?? "", pingOk: false, error: (e as Error).message };
  }
});

/** Saves (or replaces) the cron-job.org key after checking it, then points the ping to the main server. */
export const cronSaveKey = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ key: z.string().trim().min(20).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { cronJobs, syncWaPing } = await import("./cronjob.server");
    await cronJobs(data.key);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("gateway_credentials" as never).upsert({ user_id: context.userId, platform: "cronjob", token: "{}", secret: data.key, updated_at: new Date().toISOString() } as never, { onConflict: "user_id,platform" });
    if (error) throw new Error("Não consegui salvar a chave.");
    await supabaseAdmin.from("audit_log").insert({ user_id: context.userId, actor: "chefe", module: "integracoes", action: "salvar_token", target: "cronjob", result: "ok" });
    return syncWaPing(context.userId, "chefe");
  });

export const cronDeleteKey = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("gateway_credentials" as never).delete().eq("user_id", context.userId).eq("platform", "cronjob");
  await supabaseAdmin.from("audit_log").insert({ user_id: context.userId, actor: "chefe", module: "integracoes", action: "remover_token", target: "cronjob", result: "ok" });
  return { ok: true };
});

/** Re-points the keep-awake ping to the current main server. */
export const cronSync = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { syncWaPing } = await import("./cronjob.server");
  return syncWaPing(context.userId, "chefe");
});

/** Pauses or resumes one cron-job.org task. */
export const cronToggle = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ jobId: z.number().int().positive(), enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { cronKey, cronApi } = await import("./cronjob.server");
    const { key } = await cronKey(context.userId);
    if (!key) throw new Error("Chave do cron-job.org não cadastrada.");
    const r = await cronApi(key, `/jobs/${data.jobId}`, { method: "PATCH", body: JSON.stringify({ job: { enabled: data.enabled } }) });
    if (!r.ok) throw new Error(`O cron-job.org respondeu ${r.status}.`);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_log").insert({ user_id: context.userId, actor: "chefe", module: "whatsapp", action: data.enabled ? "retomar_tarefa" : "pausar_tarefa", target: String(data.jobId), result: "ok" });
    return { ok: true };
  });
