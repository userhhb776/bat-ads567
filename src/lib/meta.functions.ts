import { withMeta } from "@/lib/meta-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const INSIGHT_FIELDS =
  "spend,impressions,reach,clicks,inline_link_clicks,ctr,cpc,cpm,frequency,actions,action_values,cost_per_action_type,purchase_roas";

export const getStatus = createServerFn({ method: "GET" }).middleware([withMeta]).handler(async ({ context }) => {
  try {
    const me = await context.graph("me", { params: { fields: "id,name" } });
    const conn = await context.metaConn();
    return { connected: true as const, name: me.name as string, source: conn.source, error: null };
  } catch (e) {
    const msg = (e as Error).message;
    return { connected: false as const, name: null, source: null, error: msg === "META_NOT_CONNECTED" ? "Meta não conectada. Cole o token em Configurações → Conexão Meta." : msg };
  }
});

export const getAdAccounts = createServerFn({ method: "GET" }).middleware([withMeta]).handler(async ({ context }) => {
  const r = await context.graph("me/adaccounts", {
    params: { fields: "id,name,account_status,currency,timezone_id,timezone_name,business{id,name}", limit: "200" },
  });
  return ((r.data ?? []) as any[]).map((a) => ({
    id: a.id as string,
    name: String(a.name).trim(),
    account_status: a.account_status as number,
    currency: a.currency as string,
    timezone_id: Number(a.timezone_id),
    timezone_name: String(a.timezone_name ?? ""),
    business: (a.business?.name as string) ?? "Conta pessoal",
  }));
});

export const getAssets = createServerFn({ method: "GET" }).middleware([withMeta])
  .inputValidator((d) => z.object({ accountId: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const failures: string[] = [];
    const failed = (label: string) => (error: unknown) => { failures.push(`${label}: ${error instanceof Error ? error.message : "consulta falhou"}`); return { data: [] }; };
    const [pages, pixels, ig, audiences, saved] = await Promise.all([
      context.graph("me/accounts", { params: { fields: "id,name", limit: "100" } }).catch(failed("Páginas")),
      context.graph(`${data.accountId}/adspixels`, { params: { fields: "id,name" } }).catch(failed("Pixels")),
      context.graph(`${data.accountId}/instagram_accounts`, { params: { fields: "id,username" } }).catch(failed("Instagram")),
      context.graph(`${data.accountId}/customaudiences`, { params: { fields: "id,name,subtype", limit: "200" } }).catch(failed("Públicos")),
      context.graph(`${data.accountId}/saved_audiences`, { params: { fields: "id,name,targeting", limit: "100" } }).catch(failed("Públicos salvos")),
    ]);
    return {
      errors: failures,
      pages: pages.data as { id: string; name: string }[],
      pixels: pixels.data as { id: string; name: string }[],
      instagram: (ig.data as any[]).map((i) => ({ id: i.id as string, name: (i.username as string) ?? i.id })),
      audiences: audiences.data as { id: string; name: string; subtype: string }[],
      saved: (saved.data as any[]).map((x) => ({ id: String(x.id), name: String(x.name), targeting: JSON.stringify(x.targeting ?? {}) })),
    };
  });

export const searchTargeting = createServerFn({ method: "GET" }).middleware([withMeta])
  .inputValidator((d) =>
    z.object({ kind: z.enum(["interest", "geo", "locale"]), q: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.kind === "interest") {
      const r = await context.graph("search", { params: { type: "adinterest", q: data.q, limit: "25", locale: "pt_BR" } });
      return (r.data as any[]).map((x) => ({ id: String(x.id), name: x.name as string, extra: x.audience_size_upper_bound ? `até ${Number(x.audience_size_upper_bound).toLocaleString("pt-BR")}` : "", type: "interest" }));
    }
    if (data.kind === "locale") {
      const r = await context.graph("search", { params: { type: "adlocale", q: data.q } });
      return (r.data as any[]).map((x) => ({ id: String(x.key), name: x.name as string, extra: "", type: "locale" }));
    }
    const r = await context.graph("search", {
      params: { type: "adgeolocation", q: data.q, location_types: ["country", "region", "city"], locale: "pt_BR" },
    });
    return (r.data as any[]).map((x) => ({
      id: String(x.key),
      name: [x.name, x.region, x.country_name].filter(Boolean).join(", "),
      extra: x.type,
      type: x.type as string,
    }));
  });

const levelSchema = z.enum(["campaigns", "adsets", "ads"]);
const LEVEL_ONE = { campaigns: "campaign", adsets: "adset", ads: "ad" } as const;
const OBJECT_INSIGHTS =
  "spend,impressions,reach,frequency,clicks,unique_clicks,inline_link_clicks,unique_inline_link_clicks,outbound_clicks,ctr,cpc,cpm,actions,action_values,cost_per_action_type,purchase_roas,video_play_actions,video_thruplay_watched_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p95_watched_actions,video_p100_watched_actions,video_avg_time_watched_actions";
const day = (d: Date) => d.toISOString().slice(0, 10);
/** Meta only keeps insights for the last 37 months; older starts are moved forward instead of failing. */
function clampRange(r?: { since: string; until: string }) {
  if (!r) return r;
  const min = new Date(); min.setMonth(min.getMonth() - 37); min.setDate(min.getDate() + 1);
  const since = r.since < day(min) ? day(min) : r.since;
  return { since, until: r.until < since ? since : r.until };
}
const rangeDays = (r?: { since: string; until: string }) => (r ? Math.round((Date.parse(r.until) - Date.parse(r.since)) / 864e5) + 1 : 0);

export const getObjects = createServerFn({ method: "GET" }).middleware([withMeta])
  .inputValidator((d) =>
    z
      .object({
        accountId: z.string(),
        level: levelSchema,
        datePreset: z.string(),
        timeRange: z.object({ since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).optional(),
        parentIds: z.array(z.string()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { graphAll } = await import("@/lib/meta-conn.server");
    const base = "id,name,status,effective_status,created_time,updated_time";
    const extra =
      data.level === "campaigns"
        ? "objective,daily_budget,lifetime_budget,bid_strategy,spend_cap,start_time,stop_time,budget_remaining"
        : data.level === "adsets"
          ? "campaign_id,campaign{name},daily_budget,lifetime_budget,optimization_goal,bid_strategy,bid_amount,start_time,end_time"
          : "campaign_id,adset_id,adset{name},campaign{name},creative{id,thumbnail_url}";
    const filtering = data.parentIds?.length ? [{ field: data.level === "adsets" ? "campaign.id" : "adset.id", operator: "IN", value: data.parentIds }] : undefined;
    const timeRange = clampRange(data.timeRange);
    const range = timeRange ? { time_range: timeRange } : { date_preset: data.datePreset };
    const one = LEVEL_ONE[data.level];
    const fields = `${one}_id,${OBJECT_INSIGHTS}${data.level === "ads" ? ",quality_ranking,engagement_rate_ranking,conversion_rate_ranking" : ""}`;
    // Objects and numbers come from two paged calls: big periods (years of history) don't time out a nested request.
    const [objects, numbers] = await Promise.all([
      graphAll(context.graph, `${data.accountId}/${data.level}`, { fields: `${base},${extra}`, limit: "200", filtering }, 2000),
      graphAll(context.graph, `${data.accountId}/insights`, { level: one, fields, ...range, limit: "500", filtering }, 5000).catch((e: Error) => ({ error: e.message })),
    ]);
    const list = Array.isArray(numbers) ? numbers : [];
    const byId = new Map(list.map((x: any) => [String(x[`${one}_id`]), x]));
    const insightsError = Array.isArray(numbers) ? null : numbers.error;
    return objects.map((o: any) => ({ ...o, insights: byId.get(String(o.id)) ?? null, insightsError }));
  });

export const getInsights = createServerFn({ method: "GET" }).middleware([withMeta])
  .inputValidator((d) =>
    z.object({ accountIds: z.array(z.string()).min(1), datePreset: z.string(), campaignIds: z.array(z.string()).optional(), timeRange: z.object({ since: z.string(), until: z.string() }).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { graphAll } = await import("@/lib/meta-conn.server");
    const timeRange = clampRange(data.timeRange);
    // Long periods are grouped by month (daily rows over years are heavy and get cut).
    const step = timeRange && rangeDays(timeRange) > 92 ? "monthly" : data.datePreset === "maximum" ? "monthly" : "1";
    const results = await Promise.all(
      data.accountIds.map(async (acc) => {
        const range = timeRange ? { time_range: timeRange } : { date_preset: data.datePreset };
        const filters = data.campaignIds?.length ? { filtering: [{ field: "campaign.id", operator: "IN", value: data.campaignIds.slice(0, 300) }] } : {};
        const [daily, byCampaign] = await Promise.all([
          graphAll(context.graph, `${acc}/insights`, { fields: INSIGHT_FIELDS, ...range, ...filters, time_increment: step, limit: "500" }, 1200).catch(() => [] as any[]),
          graphAll(context.graph, `${acc}/insights`, { fields: `campaign_id,campaign_name,${INSIGHT_FIELDS}`, ...range, ...filters, level: "campaign", limit: "500" }, 3000).catch(() => [] as any[]),
        ]);
        return { daily, campaigns: byCampaign };
      }),
    );
    return { step, daily: results.flatMap((r) => r.daily), campaigns: results.flatMap((r) => r.campaigns) };
  });

/** Full editable state of one campaign, ad set or ad. */
export const getObjectDetail = createServerFn({ method: "GET" }).middleware([withMeta])
  .inputValidator((d) => z.object({ id: z.string().regex(/^\d+$/), level: levelSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const fields = {
      campaigns: "id,name,status,objective,buying_type,daily_budget,lifetime_budget,bid_strategy,spend_cap,start_time,stop_time,special_ad_categories,account_id,created_time",
      adsets: "id,name,status,campaign_id,campaign{name,daily_budget,lifetime_budget},daily_budget,lifetime_budget,bid_strategy,bid_amount,optimization_goal,billing_event,start_time,end_time,targeting,promoted_object,account_id,created_time",
      ads: "id,name,status,adset_id,campaign_id,account_id,created_time,creative{id,name,title,body,thumbnail_url,image_url,object_story_spec,object_story_id,effective_object_story_id,asset_feed_spec,url_tags,instagram_user_id,call_to_action_type,link_url}",
    }[data.level];
    return (await context.graph(data.id, { params: { fields } })) as Record<string, any>;
  });

export const updateObject = createServerFn({ method: "POST" }).middleware([withMeta])
  .inputValidator((d) =>
    z
      .object({
        id: z.string(),
        status: z.enum(["ACTIVE", "PAUSED", "DELETED"]).optional(),
        daily_budget: z.number().int().positive().optional(),
        name: z.string().min(1).optional(),
        lifetime_budget: z.number().int().positive().optional(),
        spend_cap: z.number().int().positive().optional(),
        bid_strategy: z.enum(["LOWEST_COST_WITHOUT_CAP", "LOWEST_COST_WITH_BID_CAP", "COST_CAP", "LOWEST_COST_WITH_MIN_ROAS"]).optional(),
        bid_amount: z.number().int().positive().optional(),
        start_time: z.string().optional(),
        end_time: z.string().optional(),
        stop_time: z.string().optional(),
        targeting: z.record(z.string(), z.any()).optional(),
        /** Budget before this edit, kept so agents can go back to it. */
        before_budget: z.number().int().positive().optional(),
        actor: z.string().max(80).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, actor, before_budget, ...rest } = data;
    try {
      const r = await context.graph(id, { method: "POST", params: rest });
      await context.supabase.from("audit_log").insert({ user_id: context.userId, actor: actor ?? "usuario", module: "meta", action: rest.status === "DELETED" ? "excluir" : "editar", target: id, before: before_budget ? ({ daily_budget: before_budget } as never) : null, after: rest as never });
      if (rest.daily_budget && before_budget && before_budget !== rest.daily_budget) {
        const { recordBudget } = await import("@/lib/ai-agent");
        const key = "srv.budget-history";
        const { data: row } = await context.supabase.from("app_state").select("value").eq("user_id", context.userId).eq("key", key).maybeSingle();
        const next = recordBudget((row?.value ?? {}) as never, id, before_budget, rest.daily_budget, actor ?? "chefe");
        await context.supabase.from("app_state").upsert({ user_id: context.userId, key, value: next as never }, { onConflict: "user_id,key" });
      }
      return r;
    } catch (e) {
      await context.supabase.from("audit_log").insert({ user_id: context.userId, actor: actor ?? "usuario", module: "meta", action: "editar", target: id, after: rest as never, result: "erro", error: (e as Error).message.slice(0, 900) });
      throw e;
    }
  });

/** Creatives can't be edited in place: a new creative is made from the current one with the new text/link, then swapped into the ad. */
export const updateAdCreative = createServerFn({ method: "POST" }).middleware([withMeta])
  .inputValidator((d) => z.object({
    adId: z.string().regex(/^\d+$/),
    message: z.string().max(5000).optional(),
    headline: z.string().max(255).optional(),
    description: z.string().max(255).optional(),
    link: z.string().url().optional(),
    url_tags: z.string().max(1000).optional(),
    image_hash: z.string().optional(),
    video_id: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const ad = await context.graph(data.adId, { params: { fields: "id,name,account_id,creative{id,name,object_story_spec,url_tags,instagram_user_id,asset_feed_spec}" } });
    const c = ad.creative ?? {};
    if (!c.object_story_spec) throw new Error("Este anúncio usa uma publicação já existente ou criativo dinâmico. Edite o texto direto na publicação ou crie um anúncio novo.");
    const { patchStorySpec } = await import("@/lib/meta-edit");
    const story = patchStorySpec(c.object_story_spec, data);
    const account = String(ad.account_id).startsWith("act_") ? ad.account_id : `act_${ad.account_id}`;
    const creative = await context.graph(`${account}/adcreatives`, {
      method: "POST",
      params: { name: `${c.name ?? ad.name} - editado`, object_story_spec: story, url_tags: data.url_tags ?? c.url_tags, instagram_user_id: c.instagram_user_id },
    });
    await context.graph(data.adId, { method: "POST", params: { creative: { creative_id: creative.id } } });
    await context.supabase.from("audit_log").insert({ user_id: context.userId, actor: "chefe", module: "meta", action: "editar_anuncio", target: data.adId, before: { creative: c.id } as never, after: { creative: creative.id, ...data } as never, result: "ok" });
    return { creativeId: String(creative.id) };
  });

export const duplicateObject = createServerFn({ method: "POST" }).middleware([withMeta])
  .inputValidator((d) => z.object({ id: z.string(), deep: z.boolean(), level: levelSchema.optional(), copies: z.number().int().min(1).max(10).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const ids: string[] = [];
    for (let i = 0; i < (data.copies ?? 1); i++) {
      const r = await context.graph(`${data.id}/copies`, {
        method: "POST",
        params: { ...(data.level === "ads" ? {} : { deep_copy: data.deep }), status_option: "PAUSED", rename_options: { rename_suffix: " - Cópia" } },
      });
      ids.push(String(r.copied_campaign_id ?? r.copied_adset_id ?? r.copied_ad_id ?? r.id ?? ""));
    }
    await context.supabase.from("audit_log").insert({ user_id: context.userId, actor: "chefe", module: "meta", action: "duplicar", target: data.id, after: { ids } as never, result: "ok" });
    return { ids };
  });

export const uploadMedia = createServerFn({ method: "POST" }).middleware([withMeta])
  .inputValidator((d) =>
    z.object({ accountId: z.string(), kind: z.enum(["image", "video"]), base64: z.string().min(1), name: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.kind === "image") {
      const img = await context.graph(`${data.accountId}/adimages`, { method: "POST", params: { bytes: data.base64, name: data.name } });
      const first = Object.values(img.images ?? {})[0] as any;
      return { image_hash: first?.hash as string, video_id: null as string | null };
    }
    const bin = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const form = new FormData();
    form.append("name", data.name);
    form.append("source", new Blob([bin], { type: "video/mp4" }), data.name);
    const { metaParse } = await import("@/lib/meta-conn.server");
    const conn = await context.metaConn();
    const res = await fetch(`${conn.base}/${data.accountId}/advideos`, { method: "POST", headers: conn.headers, body: form });
    const v = await metaParse(res);
    return { image_hash: null as string | null, video_id: v.id as string };
  });

const mediaSchema = z.object({
  image_hash: z.string().optional(),
  video_id: z.string().optional(),
  thumb_hash: z.string().optional(),
  headline: z.string().optional(),
  description: z.string().optional(),
  link: z.string().optional(),
});

const createSchema = z.object({
  accountId: z.string(),
  status: z.enum(["ACTIVE", "PAUSED"]),
  campaign: z.object({
    name: z.string().min(1),
    objective: z.string(),
    buying_type: z.string(),
    special_ad_categories: z.array(z.string()),
    special_ad_category_country: z.array(z.string()).optional(),
    cbo: z.boolean(),
    budget_type: z.enum(["daily", "lifetime"]),
    budget: z.number().int().positive().optional(),
    bid_strategy: z.string(),
    spend_cap: z.number().int().positive().optional(),
  }),
  adset: z.object({
    name: z.string().min(1),
    budget: z.number().int().positive().optional(),
    bid_amount: z.number().int().positive().optional(),
    roas_floor: z.number().positive().optional(),
    optimization_goal: z.string(),
    billing_event: z.string(),
    destination_type: z.string().optional(),
    pixel_id: z.string().optional(),
    custom_event_type: z.string().optional(),
    page_id_promoted: z.string().optional(),
    attribution: z.string().optional(),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    targeting: z.record(z.string(), z.any()),
    schedule: z.array(z.object({ days: z.array(z.number().int().min(0).max(6)), start_minute: z.number().int(), end_minute: z.number().int() })).optional(),
    frequency_cap: z.object({ events: z.number().int().positive(), days: z.number().int().min(1).max(90) }).optional(),
    dsa_beneficiary: z.string().max(200).optional(),
    dsa_payor: z.string().max(200).optional(),
  }),
  ad: z.object({
    name: z.string().min(1),
    page_id: z.string(),
    instagram_user_id: z.string().optional(),
    format: z.enum(["single", "carousel"]),
    media: z.array(mediaSchema).min(1),
    message: z.string(),
    headline: z.string(),
    description: z.string(),
    link: z.string().url(),
    display_link: z.string().optional(),
    cta: z.string(),
    url_tags: z.string().optional(),
    pixel_tracking: z.string().optional(),
    enhancements: z.boolean().optional(),
    multi_advertiser: z.boolean().optional(),
  }),
});

/** Creates a new Pixel/dataset in the chosen ad account. */
export const createPixel = createServerFn({ method: "POST" }).middleware([withMeta])
  .inputValidator((d) => z.object({ accountId: z.string().startsWith("act_"), name: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    const r = await context.graph(`${data.accountId}/adspixels`, { method: "POST", params: { name: data.name } });
    return { id: String(r.id) };
  });

export const getBusinesses = createServerFn({ method: "GET" }).middleware([withMeta]).handler(async ({ context }) => {
  const r = await context.graph("me/businesses", { params: { fields: "id,name", limit: 50 } });
  return (r.data ?? []) as { id: string; name: string }[];
});

export const getAccountSettings = createServerFn({ method: "GET" }).middleware([withMeta])
  .inputValidator((d) => z.object({ accountId: z.string().startsWith("act_") }).parse(d))
  .handler(async ({ data, context }) => {
    const r = await context.graph(data.accountId, { params: { fields: "id,name,currency,timezone_id,timezone_name,account_status,user_tasks,business{id,name}" } });
    return r as { id: string; name: string; currency: string; timezone_id: number; timezone_name: string; account_status: number; user_tasks?: string[]; business?: { id: string; name: string } };
  });

/** Official Business /adaccount create edge. Eligibility is decided by the provider. */
export const createAdAccount = createServerFn({ method: "POST" }).middleware([withMeta])
  .inputValidator((d) => z.object({ businessId: z.string().regex(/^\d+$/), name: z.string().trim().min(1).max(100), currency: z.enum(["BRL", "USD"]), timezoneId: z.number().int().positive(), confirmed: z.literal(true) }).parse(d))
  .handler(async ({ data, context }) => {
    const result = await context.graph(`${data.businessId}/adaccount`, { method: "POST", params: { name: data.name, currency: data.currency, timezone_id: data.timezoneId, end_advertiser: data.businessId } });
    const id = String(result.id ?? result.account_id ?? "");
    if (!id) throw new Error("A criação não retornou um identificador. Atualize a lista antes de tentar novamente.");
    return { id: id.startsWith("act_") ? id : `act_${id}` };
  });

export type PublishInput = z.infer<typeof createSchema>;

export const publishCampaign = createServerFn({ method: "POST" }).middleware([withMeta])
  .inputValidator((d) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { accountId, campaign: c, adset: s, ad: a } = data;
    const budgetKey = c.budget_type === "daily" ? "daily_budget" : "lifetime_budget";
    const camp = await context.graph(`${accountId}/campaigns`, {
      method: "POST",
      params: {
        name: c.name,
        objective: c.objective,
        buying_type: c.buying_type,
        status: data.status,
        special_ad_categories: c.special_ad_categories,
        special_ad_category_country: c.special_ad_categories.length ? c.special_ad_category_country : undefined,
        spend_cap: c.spend_cap,
        ...(c.cbo ? { [budgetKey]: c.budget, bid_strategy: c.bid_strategy } : { is_adset_budget_sharing_enabled: false }),
      },
    });

    const promoted: Record<string, unknown> = {};
    if (s.pixel_id) Object.assign(promoted, { pixel_id: s.pixel_id, custom_event_type: s.custom_event_type });
    if (s.page_id_promoted) promoted["page_id"] = s.page_id_promoted;

    const adset = await context.graph(`${accountId}/adsets`, {
      method: "POST",
      params: {
        name: s.name,
        campaign_id: camp.id,
        status: data.status,
        billing_event: s.billing_event,
        optimization_goal: s.optimization_goal,
        destination_type: s.destination_type,
        ...(c.cbo ? {} : { [budgetKey]: s.budget, bid_strategy: c.bid_strategy }),
        bid_amount: s.bid_amount,
        bid_constraints: s.roas_floor ? { roas_average_floor: Math.round(s.roas_floor * 10000) } : undefined,
        promoted_object: Object.keys(promoted).length ? promoted : undefined,
        attribution_spec: s.attribution
          ? s.attribution.split("+").map((p) => {
              const [event_type, days] = p.split(":");
              return { event_type, window_days: Number(days) };
            })
          : undefined,
        targeting: s.targeting,
        start_time: s.start_time,
        end_time: s.end_time,
        ...(s.schedule?.length ? { adset_schedule: s.schedule, pacing_type: ["day_parting"] } : {}),
        dsa_beneficiary: s.dsa_beneficiary,
        dsa_payor: s.dsa_payor || s.dsa_beneficiary,
        frequency_control_specs: s.frequency_cap && s.optimization_goal === "REACH" ? [{ event: "IMPRESSIONS", interval_days: s.frequency_cap.days, max_frequency: s.frequency_cap.events }] : undefined,
      },
    });

    const cta = { type: a.cta, value: { link: a.link } };
    let story: Record<string, unknown>;
    const first = a.media[0]!;
    if (a.format === "carousel") {
      story = {
        page_id: a.page_id,
        link_data: {
          link: a.link,
          message: a.message,
          caption: a.display_link,
          multi_share_optimized: true,
          child_attachments: a.media.map((m) => ({
            link: m.link || a.link,
            name: m.headline || a.headline,
            description: m.description || a.description,
            ...(m.video_id ? { video_id: m.video_id, image_hash: m.thumb_hash } : { image_hash: m.image_hash }),
            call_to_action: { type: a.cta, value: { link: m.link || a.link } },
          })),
          call_to_action: cta,
        },
      };
    } else if (first.video_id) {
      story = {
        page_id: a.page_id,
        video_data: {
          video_id: first.video_id,
          ...(first.thumb_hash ? { image_hash: first.thumb_hash } : {}),
          message: a.message,
          title: a.headline,
          link_description: a.description,
          call_to_action: cta,
        },
      };
    } else {
      story = {
        page_id: a.page_id,
        link_data: {
          link: a.link,
          message: a.message,
          name: a.headline,
          description: a.description,
          caption: a.display_link,
          image_hash: first.image_hash,
          call_to_action: cta,
        },
      };
    }

    const creative = await context.graph(`${accountId}/adcreatives`, {
      method: "POST",
      params: {
        name: `${a.name} - criativo`,
        object_story_spec: story,
        instagram_user_id: a.instagram_user_id,
        url_tags: a.url_tags,
        contextual_multi_ads: a.multi_advertiser === undefined ? undefined : { enroll_status: a.multi_advertiser ? "OPT_IN" : "OPT_OUT" },
        degrees_of_freedom_spec: a.enhancements === undefined ? undefined : { creative_features_spec: { standard_enhancements: { enroll_status: a.enhancements ? "OPT_IN" : "OPT_OUT" } } },
      },
    });
    const ad = await context.graph(`${accountId}/ads`, {
      method: "POST",
      params: {
        name: a.name,
        adset_id: adset.id,
        creative: { creative_id: creative.id },
        status: data.status,
        tracking_specs: a.pixel_tracking ? [{ "action.type": ["offsite_conversion"], fb_pixel: [a.pixel_tracking] }] : undefined,
      },
    });
    return { campaignId: camp.id as string, adsetId: adset.id as string, adId: ad.id as string };
  });

/** Business Manager center: linked accounts, pages, pixels, people and catalogs, as allowed by the connection. */
export const getBusinessDetail = createServerFn({ method: "GET" }).middleware([withMeta])
  .inputValidator((d) => z.object({ businessId: z.string().regex(/^\d+$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const safe = async (path: string, fields: string) => {
      try { const r = await context.graph(`${data.businessId}/${path}`, { params: { fields, limit: 100 } }); return { items: (r.data ?? []) as any[], error: null as string | null }; }
      catch (e) { return { items: [] as any[], error: (e as Error).message }; }
    };
    const [info, owned, client, pages, pixels, people, catalogs, instagram] = await Promise.all([
      context.graph(data.businessId, { params: { fields: "id,name,verification_status,created_time,primary_page{name}" } }).catch((e) => ({ error: (e as Error).message })),
      safe("owned_ad_accounts", "id,name,account_status,currency"), safe("client_ad_accounts", "id,name,account_status,currency"),
      safe("owned_pages", "id,name"), safe("adspixels", "id,name,last_fired_time"),
      safe("business_users", "id,name,role"), safe("owned_product_catalogs", "id,name,product_count"),
      safe("instagram_accounts", "id,username"),
    ]);
    return { info, owned, client, pages, pixels, people, catalogs, instagram };
  });

/** Approval state, rejection reasons and preview for one ad. */
export const getAdReview = createServerFn({ method: "GET" }).middleware([withMeta])
  .inputValidator((d) => z.object({ adId: z.string().regex(/^\d+$/), format: z.enum(["MOBILE_FEED_STANDARD", "DESKTOP_FEED_STANDARD", "INSTAGRAM_STANDARD", "INSTAGRAM_STORY"]).default("MOBILE_FEED_STANDARD") }).parse(d))
  .handler(async ({ data, context }) => {
    const ad = await context.graph(data.adId, { params: { fields: "id,name,status,effective_status,ad_review_feedback,issues_info,creative{id,title,body,thumbnail_url,object_story_spec,url_tags}" } });
    let preview = "";
    try { const p = await context.graph(`${data.adId}/previews`, { params: { ad_format: data.format } }); preview = String(p.data?.[0]?.body ?? ""); } catch { /* preview not available for this format */ }
    const src = preview.match(/src="([^"]+)"/)?.[1]?.replace(/&amp;/g, "&") ?? "";
    return { ad, previewUrl: src };
  });

/** Pixel health: last event, recent event counts and stats by event name. */
export const getPixelHealth = createServerFn({ method: "GET" }).middleware([withMeta])
  .inputValidator((d) => z.object({ pixelId: z.string().regex(/^\d+$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const info = await context.graph(data.pixelId, { params: { fields: "id,name,last_fired_time,is_unavailable,data_use_setting,enable_automatic_matching" } });
    let stats: { event: string; count: number }[] = [];
    try {
      const r = await context.graph(`${data.pixelId}/stats`, { params: { aggregation: "event" } });
      const acc = new Map<string, number>();
      for (const bucket of r.data ?? []) for (const x of bucket.data ?? []) acc.set(String(x.value), (acc.get(String(x.value)) ?? 0) + Number(x.count ?? 0));
      stats = [...acc].map(([event, count]) => ({ event, count })).sort((a, b) => b.count - a.count);
    } catch { /* stats need extra permission */ }
    return { info, stats };
  });

/** Sends a Conversions API test event (shows in Events Manager › Test events). */
export const sendTestEvent = createServerFn({ method: "POST" }).middleware([withMeta])
  .inputValidator((d) => z.object({ pixelId: z.string().regex(/^\d+$/), testCode: z.string().min(3).max(40), event: z.enum(["PageView", "ViewContent", "Lead", "AddToCart", "InitiateCheckout", "Purchase"]), url: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const eventId = `test-${Date.now()}`;
    const r = await context.graph(`${data.pixelId}/events`, { method: "POST", params: { test_event_code: data.testCode, data: [{ event_name: data.event, event_time: Math.floor(Date.now() / 1000), event_id: eventId, action_source: "website", event_source_url: data.url, user_data: { client_user_agent: "BatGotham-Test" }, ...(data.event === "Purchase" ? { custom_data: { currency: "BRL", value: 1 } } : {}) }] } });
    return { received: Number(r.events_received ?? 0), eventId };
  });

export const shareObjectToAccount = createServerFn({ method: "POST" }).middleware([withMeta])
  .inputValidator((d) => z.object({ pixelId: z.string().regex(/^\d+$/), businessId: z.string().regex(/^\d+$/), accountId: z.string().regex(/^act_\d+$/) }).parse(d))
  .handler(async ({ data, context }) => context.graph(`${data.pixelId}/shared_accounts`, { method: "POST", params: { account_id: data.accountId.replace("act_", ""), business: data.businessId } }));

/** Every ad account with money left, lifetime history and campaign count, for Crowley and the balance cards. */
export const getAccountsOverview = createServerFn({ method: "GET" }).middleware([withMeta]).handler(async ({ context }) => {
  const { accountFunds } = await import("@/lib/funds");
  const r = await context.graph("me/adaccounts", {
    params: { fields: "id,name,currency,account_status,created_time,amount_spent,spend_cap,balance,is_prepay_account,funding_source_details,business{name},campaigns.limit(0).summary(true),insights.date_preset(maximum){spend,actions,action_values}", limit: "100" },
  });
  const buy = ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"];
  return (r.data as any[]).map((a) => {
    const i = a.insights?.data?.[0];
    const f = accountFunds(a);
    return {
      id: a.id as string, name: String(a.name).trim(), currency: a.currency as string, status: a.account_status as number,
      business: a.business?.name ?? "Conta pessoal", created: a.created_time as string,
      campaigns: Number(a.campaigns?.summary?.total_count ?? 0),
      lifetimeSpend: Number(i?.spend ?? 0),
      lifetimePurchases: Number(i?.actions?.find((x: any) => buy.includes(x.action_type))?.value ?? 0),
      lifetimeRevenue: Number(i?.action_values?.find((x: any) => buy.includes(x.action_type))?.value ?? 0),
      funds: f,
    };
  });
});

/** Asks for agency access to an ad account owned by another BM (the owner approves in their Business settings). */
export const requestClientAccount = createServerFn({ method: "POST" }).middleware([withMeta])
  .inputValidator((d) => z.object({ businessId: z.string().regex(/^\d+$/), accountId: z.string().regex(/^(act_)?\d+$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const r = await context.graph(`${data.businessId}/client_ad_accounts`, { method: "POST", params: { adaccount_id: data.accountId.startsWith("act_") ? data.accountId : `act_${data.accountId}`, permitted_tasks: ["MANAGE", "ADVERTISE", "ANALYZE"] } });
    await context.supabase.from("audit_log").insert({ user_id: context.userId, actor: "chefe", module: "bm", action: "pedir_acesso_conta", target: data.accountId, after: r as never, result: "ok" });
    return r as { access_status?: string };
  });

/** Asks for agency access to a Facebook page owned by another BM. */
export const requestClientPage = createServerFn({ method: "POST" }).middleware([withMeta])
  .inputValidator((d) => z.object({ businessId: z.string().regex(/^\d+$/), pageId: z.string().regex(/^\d+$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const r = await context.graph(`${data.businessId}/client_pages`, { method: "POST", params: { page_id: data.pageId, permitted_tasks: ["MANAGE", "CREATE_CONTENT", "ADVERTISE", "ANALYZE"] } });
    await context.supabase.from("audit_log").insert({ user_id: context.userId, actor: "chefe", module: "bm", action: "pedir_acesso_pagina", target: data.pageId, after: r as never, result: "ok" });
    return r as { access_status?: string };
  });
