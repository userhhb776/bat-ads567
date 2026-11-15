/** Server-only cron-job.org client. The key lives in service-role gateway_credentials slot "cronjob" (env CRONJOB_API_KEY as fallback). */
import { everyMinutes, PING_EVERY, PING_TITLE, planWaPing, type CronJob } from "./cronjob";

const API = "https://api.cron-job.org";

export async function cronKey(userId: string): Promise<{ key: string; source: "painel" | "sistema" | ""; managedId: number | null }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("gateway_credentials" as never).select("token, secret").eq("user_id", userId).eq("platform", "cronjob").maybeSingle();
  const row = data as { token: string; secret: string } | null;
  let managedId: number | null = null;
  try { managedId = Number((JSON.parse(row?.token ?? "{}") as { pingJob?: number }).pingJob) || null; } catch { managedId = null; }
  if (row?.secret) return { key: row.secret, source: "painel", managedId };
  const env = process.env["CRONJOB_API_KEY"];
  return env ? { key: env, source: "sistema", managedId } : { key: "", source: "", managedId };
}

export async function cronApi(key: string, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(API + path, { ...init, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers ?? {}) }, signal: AbortSignal.timeout(15000) });
}

export async function cronJobs(key: string): Promise<CronJob[]> {
  const r = await cronApi(key, "/jobs");
  if (r.status === 401 || r.status === 403) throw new Error("O cron-job.org recusou a chave.");
  if (r.status === 429) throw new Error("O cron-job.org pediu para esperar (limite diário de consultas).");
  if (!r.ok) throw new Error(`O cron-job.org respondeu ${r.status}.`);
  return ((await r.json()) as { jobs?: CronJob[] }).jobs ?? [];
}

/** Points the keep-awake ping to the main WhatsApp server and pauses pings on the others. Safe to call after any server change. */
export async function syncWaPing(userId: string, actor = "sistema"): Promise<{ ok: boolean; text: string }> {
  const { key, managedId } = await cronKey(userId);
  if (!key) return { ok: false, text: "Chave do cron-job.org não cadastrada." };
  const { waServers } = await import("./channels.server");
  const servers = await waServers(userId);
  const jobs = await cronJobs(key);
  const primary = servers[0] ?? null;
  const plan = planWaPing(jobs, primary?.url ?? null, servers.map((s) => s.url), managedId);
  const tz = jobs.find((j) => j.schedule?.timezone)?.schedule?.timezone ?? "America/Sao_Paulo";
  const job = (url: string) => ({ url, enabled: true, title: PING_TITLE, saveResponses: false, requestTimeout: 30, schedule: everyMinutes(PING_EVERY, tz) });
  let target = plan.target;
  if (plan.create) {
    const r = await cronApi(key, "/jobs", { method: "PUT", body: JSON.stringify({ job: job(plan.create.url) }) });
    if (!r.ok) throw new Error(`Não consegui criar o ping (cron-job.org ${r.status}).`);
    target = ((await r.json()) as { jobId?: number }).jobId ?? null;
  }
  if (plan.update) {
    const r = await cronApi(key, `/jobs/${plan.update.jobId}`, { method: "PATCH", body: JSON.stringify({ job: job(plan.update.url) }) });
    if (!r.ok) throw new Error(`Não consegui ajustar o ping (cron-job.org ${r.status}).`);
  }
  for (const id of plan.pause) await cronApi(key, `/jobs/${id}`, { method: "PATCH", body: JSON.stringify({ job: { enabled: false } }) }).catch(() => null);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const changed = !!plan.create || !!plan.update || plan.pause.length > 0;
  if (target !== managedId) {
    await supabaseAdmin.from("gateway_credentials" as never).update({ token: JSON.stringify({ pingJob: target }), updated_at: new Date().toISOString() } as never).eq("user_id", userId).eq("platform", "cronjob");
  }
  if (changed) await supabaseAdmin.from("audit_log").insert({ user_id: userId, actor, module: "whatsapp", action: "ajustar_ping", target: primary?.name ?? "nenhum", after: { create: !!plan.create, update: plan.update?.jobId ?? null, pause: plan.pause } as never, result: "ok" });
  if (!primary) return { ok: true, text: plan.pause.length ? "Sem servidor principal: pings pausados." : "Nenhum servidor de WhatsApp cadastrado." };
  return { ok: true, text: changed ? `Ping ajustado: ${primary.name} recebe um toque a cada ${PING_EVERY} min.` : `Tudo certo: ${primary.name} já recebe o ping a cada ${PING_EVERY} min.` };
}
