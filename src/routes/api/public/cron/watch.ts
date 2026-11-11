import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { evaluate, type CampaignStats, type IntelRule } from "@/lib/intel";
import { aiDue, aiPrompt, validateAiDecisions } from "@/lib/ai-agent";

const GATEWAY = "https://connector-gateway.lovable.dev/meta_ads/v26.0";
const PURCHASE = ["purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase"];
const FIELDS = "id,name,status,effective_status,daily_budget,insights.date_preset(today){spend,frequency,actions,action_values}";

function metaHeaders() {
  const a = process.env["LOVABLE_API_KEY"], b = process.env["META_ADS_API_KEY"];
  if (!a || !b) throw new Error("Meta não conectado");
  return { Authorization: `Bearer ${a}`, "X-Connection-Api-Key": b };
}
const pick = (list: { action_type: string; value: string }[] | undefined) =>
  Number(list?.find((x) => PURCHASE.includes(x.action_type))?.value ?? 0);

/** Runs every user's watch rules against today's numbers; called by an external scheduler with a secret header. */
export const Route = createFileRoute("/api/public/cron/watch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["WATCH_CRON_TOKEN"] ?? "";
        const got = request.headers.get("x-cron-token") ?? "";
        if (!expected || got.length !== expected.length || !timingSafeEqual(Buffer.from(got), Buffer.from(expected)))
          return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const [{ data: rows, error }, { data: ruleRows, error: ruleErr }] = await Promise.all([
          supabaseAdmin.from("app_state").select("user_id,key,value").eq("key", "batgotham.account"),
          supabaseAdmin.from("monitor_rules").select("user_id,data").order("position"),
        ]);
        if (error || ruleErr) return new Response((error ?? ruleErr)!.message, { status: 500 });
        const users = new Map<string, { rules?: IntelRule[]; account?: string }>();
        for (const r of ruleRows ?? []) {
          const u = users.get(r.user_id) ?? {};
          (u.rules ??= []).push(r.data as unknown as IntelRule);
          users.set(r.user_id, u);
        }
        for (const r of rows ?? []) {
          const u = users.get(r.user_id); if (u) u.account = String(r.value);
        }
        const { stoppedUsers, processJobs, runAutomations, heartbeat, checkFunds } = await import("@/lib/worker.server");
        const stopped = await stoppedUsers(supabaseAdmin);
        const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date())) % 24;
        let actions = 0;
        const notes: { userId: string; title: string; body: string }[] = [];
        for (const [userId, { rules, account }] of users) {
          if (stopped.has(userId)) continue;
          const active = (rules ?? []).filter((r) => r.active && (!r.accountId || r.accountId === account));
          if (!active.length || !account?.startsWith("act_")) continue;
          const url = new URL(`${GATEWAY}/${account}/campaigns`);
          url.searchParams.set("fields", FIELDS); url.searchParams.set("limit", "200");
          const res = await fetch(url, { headers: metaHeaders() }).catch(() => null);
          if (!res?.ok) {
            const detail = res ? await res.text() : "sem resposta";
            console.error("watch meta", res?.status, detail);
            const { healthAlert } = await import("@/lib/notify.server");
            await healthAlert(supabaseAdmin, userId, "Meta parou de responder", `Não consegui ler as campanhas (${res?.status ?? "conexão"}). Os agentes ficam parados até a conexão voltar.`, "/configuracoes").catch(() => {});
            continue;
          }
          const body = (await res.json()) as { data: any[] };
          const stats: CampaignStats[] = body.data.map((c) => {
            const i = c.insights?.data?.[0];
            return { id: c.id, accountId: account, name: c.name, status: c.effective_status ?? c.status, dailyBudget: Number(c.daily_budget ?? 0), spend: Number(i?.spend ?? 0), frequency: Number(i?.frequency ?? 0), purchases: pick(i?.actions), revenue: pick(i?.action_values) };
          });
          const since = new Date(Date.now() - 6 * 3600e3).toISOString();
          const { data: recent } = await supabaseAdmin.from("watch_log").select("rule_id,target_id,action,state,created_at").eq("user_id", userId).gte("created_at", since);
          const act = async (rule: IntelRule, c: CampaignStats, d: { kind: string; reason: string; newBudget?: number | undefined }) => {
            let state = d.kind === "alerta" || rule.autonomy === "avisar" ? "aviso" : rule.autonomy === "aprovar" ? "pendente" : "executado";
            if (state === "executado") {
              const params = d.kind === "pausar" ? { status: "PAUSED" } : d.kind === "ativar" ? { status: "ACTIVE" } : { daily_budget: d.newBudget };
              const r = await fetch(`${GATEWAY}/${c.id}`, { method: "POST", headers: { ...metaHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(params) });
              if (!r.ok) { state = "erro"; console.error("watch act", r.status, await r.text()); }
            }
            await supabaseAdmin.from("watch_log").insert({ user_id: userId, rule_id: rule.id, target_id: c.id, campaign_name: c.name, action: d.kind, detail: d.reason, state, new_budget: d.newBudget ?? null });
            actions++;
            await supabaseAdmin.from("audit_log").insert({ user_id: userId, actor: `agente:${rule.name ?? rule.id}`, module: "campanhas", action: d.kind, target: c.id, after: { reason: d.reason, newBudget: d.newBudget ?? null } as never, result: state });
            const verb = { executado: "Feito", pendente: "Aguardando sua aprovação", aviso: "Atenção", erro: "Falhou" }[state] ?? state;
            notes.push({ userId, title: `${verb}: ${c.name}`.slice(0, 80), body: d.reason });
          };
          for (const rule of active) for (const c of stats) {
            const d = evaluate(rule, c, hour);
            if (!d) continue;
            if (recent?.some((h) => h.rule_id === rule.id && h.target_id === c.id && h.action === d.kind && h.state !== "erro")) continue;
            await act(rule, c, d);
          }
          // Custom strategy agents: the AI decides inside the agent's limits, at most once per review interval.
          for (const rule of active.filter((r) => r.strategy?.trim())) {
            const key = `srv.ai-agent.${rule.id}`;
            const { data: last } = await supabaseAdmin.from("app_state").select("value").eq("user_id", userId).eq("key", key).maybeSingle();
            if (!aiDue(rule, hour, Date.parse(String(last?.value ?? "")) || 0)) continue;
            await supabaseAdmin.from("app_state").upsert({ user_id: userId, key, value: new Date().toISOString() as never }, { onConflict: "user_id,key" });
            const { askAgentAi } = await import("@/lib/ai-agent.server");
            const p = aiPrompt(rule, stats, hour);
            const ai = await askAgentAi(p.system, p.user);
            if (ai.error) {
              const { healthAlert } = await import("@/lib/notify.server");
              await healthAlert(supabaseAdmin, userId, "IA dos agentes parou", `${rule.name}: ${ai.error}. A estratégia personalizada fica parada até voltar.`, "/configuracoes").catch(() => {});
              continue;
            }
            const twoHours = new Date(Date.now() - 2 * 3600e3).toISOString();
            for (const d of validateAiDecisions(ai.text, rule, stats)) {
              const c = stats.find((x) => x.id === d.campaignId)!;
              if (recent?.some((h) => h.rule_id === rule.id && h.target_id === c.id && h.action === d.kind && h.state !== "erro" && (h as { created_at?: string }).created_at! >= twoHours)) continue;
              await act(rule, c, d);
            }
          }
        }
        if (notes.length) {
          await supabaseAdmin.from("notifications").insert(notes.map((n) => ({ user_id: n.userId, kind: "campanha", title: n.title, body: n.body, link: "/inteligencia" })));
          const { sendPush } = await import("@/lib/push.server");
          const { data: subs } = await supabaseAdmin.from("app_state").select("user_id,key,value").like("key", "bg.push.%").in("user_id", [...new Set(notes.map((n) => n.userId))]);
          for (const s of subs ?? []) for (const n of notes.filter((x) => x.userId === s.user_id)) {
            try {
              const alive = await sendPush(s.value as never, n.title, n.body);
              if (!alive) { await supabaseAdmin.from("app_state").delete().eq("user_id", s.user_id).eq("key", s.key); break; }
            } catch (e) { console.error("push", e); }
          }
        }
        const jobs = await processJobs(supabaseAdmin, stopped).catch((e) => { console.error("jobs", e); return { done: 0, failed: 0 }; });
        const autos = await runAutomations(supabaseAdmin, stopped).catch((e) => { console.error("autos", e); return { runs: 0 }; });
        const funds = await checkFunds(supabaseAdmin, [...new Set((rows ?? []).map((r) => r.user_id as string))], stopped).catch((e) => { console.error("funds", e); return { fundAlerts: 0 }; });
        await heartbeat(supabaseAdmin, { actions, ...jobs, ...autos, ...funds }).catch(() => {});
        return Response.json({ ok: true, users: users.size, actions, jobs, automations: autos, funds });
      },
    },
  },
});
