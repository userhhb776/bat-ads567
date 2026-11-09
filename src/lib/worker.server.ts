import type { SupabaseClient } from "@supabase/supabase-js";
import { deliver } from "./channels.server";
import { gatewayToOrder, runEngine, type Automation, type RunLog } from "./automation";
import type { Product, Order } from "./biz";

const GATEWAY = "https://connector-gateway.lovable.dev/meta_ads/v26.0";
type Admin = SupabaseClient<any>;

export async function metaPost(id: string, params: Record<string, unknown>) {
  const a = process.env["LOVABLE_API_KEY"], b = process.env["META_ADS_API_KEY"];
  if (!a || !b) throw new Error("Meta não conectado");
  const r = await fetch(`${GATEWAY}/${id}`, { method: "POST", headers: { Authorization: `Bearer ${a}`, "X-Connection-Api-Key": b, "Content-Type": "application/json" }, body: JSON.stringify(params) });
  const t = await r.text();
  if (!r.ok) throw new Error(`Meta ${r.status}: ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : {};
}

/** Users who pressed "parar tudo": no agent, automation or job runs for them. */
export async function stoppedUsers(admin: Admin) {
  const { data } = await admin.from("app_state").select("user_id,value").eq("key", "bg.kill-switch");
  return new Set((data ?? []).filter((r) => r.value === true).map((r) => r.user_id as string));
}

/** Exponential backoff in minutes: 1, 2, 4, 8, 16… capped at 2h. */
export const backoffMinutes = (attempt: number) => Math.min(120, 2 ** Math.max(0, attempt - 1));

export type JobRow = { id: string; user_id: string; kind: string; payload: any; attempts: number; max_attempts: number };

async function execute(job: JobRow): Promise<unknown> {
  const p = job.payload ?? {};
  switch (job.kind) {
    case "meta_update": {
      const params: Record<string, unknown> = {};
      if (p.status) params["status"] = p.status;
      if (p.daily_budget) params["daily_budget"] = Math.round(Number(p.daily_budget));
      if (p.name) params["name"] = p.name;
      if (!p.id || !Object.keys(params).length) throw new Error("Tarefa sem campanha ou alteração.");
      return metaPost(String(p.id), params);
    }
    case "message": {
      const r = await deliver(p.channel, String(p.to ?? ""), String(p.text ?? ""));
      if (!r.ok) throw new Error(r.error);
      return { sent: true };
    }
    case "webhook": {
      const r = await deliver("webhook", String(p.url ?? ""), JSON.stringify(p.body ?? {}));
      if (!r.ok) throw new Error(r.error);
      return { sent: true };
    }
    case "notify":
      return { notified: true };
    default:
      throw new Error(`Tipo de tarefa desconhecido: ${job.kind}`);
  }
}

const LABEL: Record<string, string> = { meta_update: "Alteração de campanha", message: "Mensagem", webhook: "Webhook", notify: "Lembrete" };

/** Claims due jobs with an atomic status switch (no double execution), runs them, retries with backoff. */
export async function processJobs(admin: Admin, stopped: Set<string>) {
  const now = new Date();
  await admin.from("jobs").update({ status: "queued", locked_at: null }).eq("status", "running").lt("locked_at", new Date(now.getTime() - 10 * 60000).toISOString());
  const { data: due } = await admin.from("jobs").select("id,user_id,kind,payload,attempts,max_attempts").eq("status", "queued").lte("run_at", now.toISOString()).order("run_at").limit(50);
  let done = 0, failed = 0;
  for (const job of (due ?? []) as JobRow[]) {
    if (stopped.has(job.user_id)) continue;
    const { data: claimed } = await admin.from("jobs").update({ status: "running", locked_at: new Date().toISOString(), attempts: job.attempts + 1 }).eq("id", job.id).eq("status", "queued").select("id");
    if (!claimed?.length) continue;
    const attempt = job.attempts + 1;
    try {
      const result = await execute(job);
      await admin.from("jobs").update({ status: "done", result: result as never, last_error: null, locked_at: null }).eq("id", job.id);
      await admin.from("audit_log").insert({ user_id: job.user_id, actor: job.payload?.actor ?? "agendador", module: "tarefas", action: job.kind, target: job.payload?.id ?? job.payload?.to ?? null, after: job.payload, result: "ok" });
      const title = job.kind === "notify" ? String(job.payload?.title ?? "Lembrete") : `${LABEL[job.kind] ?? job.kind} concluída`;
      await admin.from("notifications").insert({ user_id: job.user_id, kind: "tarefa", title, body: job.payload?.body ?? job.payload?.label ?? null, link: "/agendamentos" });
      done++;
    } catch (e) {
      const msg = (e as Error).message.slice(0, 500);
      const final = attempt >= job.max_attempts;
      await admin.from("jobs").update({ status: final ? "failed" : "queued", last_error: msg, locked_at: null, run_at: new Date(Date.now() + backoffMinutes(attempt) * 60000).toISOString() }).eq("id", job.id);
      if (final) {
        await admin.from("audit_log").insert({ user_id: job.user_id, actor: "agendador", module: "tarefas", action: job.kind, after: job.payload, result: "erro", error: msg });
        await admin.from("notifications").insert({ user_id: job.user_id, kind: "falha", title: `Falhou: ${LABEL[job.kind] ?? job.kind}`, body: msg, link: "/agendamentos" });
      }
      failed++;
    }
  }
  return { done, failed };
}

const list = async <T,>(admin: Admin, table: string, userId: string) => {
  const { data, error } = await admin.from(table).select("data").eq("user_id", userId).order("position");
  if (error) throw error;
  return (data ?? []).map((r: any) => r.data as T);
};

/** Runs every user's active automations against stored and gateway orders, 24h, browser closed. */
export async function runAutomations(admin: Admin, stopped: Set<string>) {
  const { data: owners } = await admin.from("automations").select("user_id").eq("data->>active", "true");
  const users = [...new Set((owners ?? []).map((r: any) => r.user_id as string))].filter((u) => !stopped.has(u));
  let runs = 0;
  for (const userId of users) {
    try {
      const [autos, products, stored, logs, contacts] = await Promise.all([
        list<Automation>(admin, "automations", userId), list<Product>(admin, "products", userId), list<Order>(admin, "orders", userId),
        list<RunLog>(admin, "automation_runs", userId), list<any>(admin, "contacts", userId),
      ]);
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data: evs } = await admin.from("gateway_events").select("*").eq("user_id", userId).gte("occurred_at", since).limit(1000);
      const orders = [...stored, ...(evs ?? []).map((e: any) => gatewayToOrder(e, products))];
      const { out, tags } = await runEngine({ autos, orders, products, logs, newId: () => crypto.randomUUID(), send: (c, to, text) => deliver(c, to, text) });
      if (out.length) {
        const base = -Math.floor(Date.now() / 1000);
        // a retry replaces the earlier failed row for the same automation+order
        const stale = logs.filter((l) => out.some((o) => o.automationId === l.automationId && o.key === l.key)).map((l) => l.id);
        if (stale.length) await admin.from("automation_runs").delete().eq("user_id", userId).in("id", stale);
        await admin.from("automation_runs").insert(out.map((r, i) => ({ id: r.id, user_id: userId, data: { ...r, origem: "servidor" }, position: base + i })));
        const fails = out.filter((r) => r.status === "falhou");
        if (fails.length) await admin.from("notifications").insert(fails.slice(0, 20).map((f) => ({ user_id: userId, kind: "falha", title: `Automação falhou: ${autos.find((a) => a.id === f.automationId)?.name ?? ""}`.slice(0, 100), body: f.detail, link: "/automacoes" })));
        runs += out.length;
      }
      for (const c of contacts) {
        const add = tags.filter((t) => (t.phone && c.phone === t.phone) || (t.email && c.email === t.email)).map((t) => t.tag);
        if (add.length) await admin.from("contacts").update({ data: { ...c, tags: [...new Set([...(c.tags ?? []), ...add])] } }).eq("user_id", userId).eq("id", String(c.id));
      }
    } catch (e) {
      console.error("automations", userId, e);
      await admin.from("notifications").insert({ user_id: userId, kind: "falha", title: "Falha no executor de automações", body: (e as Error).message.slice(0, 300), link: "/sistema" });
    }
  }
  return { runs };
}

/** Records the worker heartbeat for the service-health page. */
export async function heartbeat(admin: Admin, info: Record<string, unknown>) {
  const { data } = await admin.from("app_state").select("user_id").eq("key", "batgotham.account");
  const rows = [...new Set((data ?? []).map((r: any) => r.user_id as string))].map((user_id) => ({ user_id, key: "srv.heartbeat", value: { at: new Date().toISOString(), ...info } as never }));
  if (rows.length) await admin.from("app_state").upsert(rows, { onConflict: "user_id,key" });
}
