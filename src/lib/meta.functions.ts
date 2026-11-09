import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://connector-gateway.lovable.dev/meta_ads/v26.0";

function headers() {
  const lovable = process.env["LOVABLE_API_KEY"];
  const conn = process.env["META_ADS_API_KEY"];
  if (!lovable || !conn) throw new Error("META_NOT_CONNECTED");
  return { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": conn };
}

async function parse(res: Response) {
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok || json?.error) {
    const e = json?.error ?? {};
    console.error(`Meta request failed [${res.status}]: ${text}`);
    throw new Error(`Meta [${res.status}]: ${e.error_user_msg || e.message || text}`);
  }
  return json;
}

async function graph(path: string, init?: { method?: string; params?: Record<string, unknown> }) {
  const method = init?.method ?? "GET";
  const url = new URL(`${GATEWAY}/${path}`);
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(init?.params ?? {})) {
    if (v !== undefined && v !== null && v !== "") clean[k] = v;
  }
  if (method === "GET") {
    for (const [k, v] of Object.entries(clean)) url.searchParams.set(k, typeof v === "string" ? v : JSON.stringify(v));
    return parse(await fetch(url, { headers: headers() }));
  }
  return parse(
    await fetch(url, {
      method,
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify(clean),
    }),
  );
}

const INSIGHT_FIELDS =
  "spend,impressions,reach,clicks,inline_link_clicks,ctr,cpc,cpm,frequency,actions,action_values,cost_per_action_type,purchase_roas";

export const getStatus = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async () => {
  try {
    const me = await graph("me", { params: { fields: "id,name" } });
    return { connected: true as const, name: me.name as string, error: null };
  } catch (e) {
    return { connected: false as const, name: null, error: (e as Error).message };
  }
});

export const getAdAccounts = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async () => {
  const r = await graph("me/adaccounts", {
    params: { fields: "id,name,account_status,currency,timezone_id,timezone_name,business{id,name}", limit: "200" },
  });
  return (r.data as any[]).map((a) => ({
    id: a.id as string,
    name: String(a.name).trim(),
    account_status: a.account_status as number,
    currency: a.currency as string,
    timezone_id: Number(a.timezone_id),
    timezone_name: String(a.timezone_name ?? ""),
    business: (a.business?.name as string) ?? "Conta pessoal",
  }));
});

export const getAssets = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ accountId: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const failures: string[] = [];
    const failed = (label: string) => (error: unknown) => { failures.push(`${label}: ${error instanceof Error ? error.message : "consulta falhou"}`); return { data: [] }; };
    const [pages, pixels, ig, audiences] = await Promise.all([
      graph("me/accounts", { params: { fields: "id,name", limit: "100" } }).catch(failed("Páginas")),
      graph(`${data.accountId}/adspixels`, { params: { fields: "id,name" } }).catch(failed("Pixels")),
      graph(`${data.accountId}/instagram_accounts`, { params: { fields: "id,username" } }).catch(failed("Instagram")),
      graph(`${data.accountId}/customaudiences`, { params: { fields: "id,name,subtype", limit: "200" } }).catch(failed("Públicos")),
    ]);
    return {
      errors: failures,
      pages: pages.data as { id: string; name: string }[],
      pixels: pixels.data as { id: string; name: string }[],
      instagram: (ig.data as any[]).map((i) => ({ id: i.id as string, name: (i.username as string) ?? i.id })),
      audiences: audiences.data as { id: string; name: string; subtype: string }[],
    };
  });

export const searchTargeting = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ kind: z.enum(["interest", "geo", "locale"]), q: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    if (data.kind === "interest") {
      const r = await graph("search", { params: { type: "adinterest", q: data.q, limit: "25", locale: "pt_BR" } });
      return (r.data as any[]).map((x) => ({ id: String(x.id), name: x.name as string, extra: x.audience_size_upper_bound ? `até ${Number(x.audience_size_upper_bound).toLocaleString("pt-BR")}` : "", type: "interest" }));
    }
    if (data.kind === "locale") {
      const r = await graph("search", { params: { type: "adlocale", q: data.q } });
      return (r.data as any[]).map((x) => ({ id: String(x.key), name: x.name as string, extra: "", type: "locale" }));
    }
    const r = await graph("search", {
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

export const getObjects = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
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
  .handler(async ({ data }) => {
    const base = "id,name,status,effective_status,created_time";
    const extra =
      data.level === "campaigns"
        ? "objective,daily_budget,lifetime_budget,bid_strategy"
        : data.level === "adsets"
          ? "campaign_id,campaign{name},daily_budget,lifetime_budget,optimization_goal"
          : "campaign_id,adset_id,adset{name},creative{thumbnail_url}";
    const params: Record<string, unknown> = {
      fields: `${base},${extra},insights.${data.timeRange ? `time_range(${JSON.stringify(data.timeRange)})` : `date_preset(${data.datePreset})`}{${INSIGHT_FIELDS}}`,
      limit: "200",
    };
    if (data.parentIds?.length) {
      params["filtering"] = [
        { field: data.level === "adsets" ? "campaign.id" : "adset.id", operator: "IN", value: data.parentIds },
      ];
    }
    const r = await graph(`${data.accountId}/${data.level}`, { params });
    return (r.data as any[]).map((o) => ({ ...o, insights: o.insights?.data?.[0] ?? null }));
  });

export const getInsights = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ accountIds: z.array(z.string()).min(1), datePreset: z.string(), campaignIds: z.array(z.string()).optional(), timeRange: z.object({ since: z.string(), until: z.string() }).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const results = await Promise.all(
      data.accountIds.map(async (acc) => {
        const range = data.timeRange ? { time_range: data.timeRange } : { date_preset: data.datePreset };
        const filters = data.campaignIds?.length ? { filtering: [{ field: "campaign.id", operator: "IN", value: data.campaignIds }] } : {};
        const [daily, byCampaign] = await Promise.all([
          graph(`${acc}/insights`, {
            params: { fields: INSIGHT_FIELDS, ...range, ...filters, time_increment: "1", limit: "100" },
          }),
          graph(`${acc}/insights`, {
            params: { fields: `campaign_id,campaign_name,${INSIGHT_FIELDS}`, ...range, ...filters, level: "campaign", limit: "200" },
          }),
        ]);
        return { daily: daily.data as any[], campaigns: byCampaign.data as any[] };
      }),
    );
    return {
      daily: results.flatMap((r) => r.daily),
      campaigns: results.flatMap((r) => r.campaigns),
    };
  });

export const updateObject = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string(),
        status: z.enum(["ACTIVE", "PAUSED", "DELETED"]).optional(),
        daily_budget: z.number().int().positive().optional(),
        name: z.string().min(1).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { id, ...rest } = data;
    return graph(id, { method: "POST", params: rest });
  });

export const duplicateObject = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string(), deep: z.boolean() }).parse(d))
  .handler(async ({ data }) =>
    graph(`${data.id}/copies`, {
      method: "POST",
      params: { deep_copy: data.deep, status_option: "PAUSED", rename_options: { rename_suffix: " - Cópia" } },
    }),
  );

export const uploadMedia = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ accountId: z.string(), kind: z.enum(["image", "video"]), base64: z.string().min(1), name: z.string() }).parse(d),
  )
  .handler(async ({ data }) => {
    if (data.kind === "image") {
      const img = await graph(`${data.accountId}/adimages`, { method: "POST", params: { bytes: data.base64, name: data.name } });
      const first = Object.values(img.images ?? {})[0] as any;
      return { image_hash: first?.hash as string, video_id: null as string | null };
    }
    const bin = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const form = new FormData();
    form.append("name", data.name);
    form.append("source", new Blob([bin], { type: "video/mp4" }), data.name);
    const res = await fetch(`${GATEWAY}/${data.accountId}/advideos`, { method: "POST", headers: headers(), body: form });
    const v = await parse(res);
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
  }),
});

/** Creates a new Pixel/dataset in the chosen ad account. */
export const createPixel = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ accountId: z.string().startsWith("act_"), name: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data }) => {
    const r = await graph(`${data.accountId}/adspixels`, { method: "POST", params: { name: data.name } });
    return { id: String(r.id) };
  });

export const getBusinesses = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async () => {
  const r = await graph("me/businesses", { params: { fields: "id,name", limit: 50 } });
  return (r.data ?? []) as { id: string; name: string }[];
});

export const getAccountSettings = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ accountId: z.string().startsWith("act_") }).parse(d))
  .handler(async ({ data }) => {
    const r = await graph(data.accountId, { params: { fields: "id,name,currency,timezone_id,timezone_name,account_status,user_tasks,business{id,name}" } });
    return r as { id: string; name: string; currency: string; timezone_id: number; timezone_name: string; account_status: number; user_tasks?: string[]; business?: { id: string; name: string } };
  });

/** Official Business /adaccount create edge. Eligibility is decided by the provider. */
export const createAdAccount = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ businessId: z.string().regex(/^\d+$/), name: z.string().trim().min(1).max(100), currency: z.enum(["BRL", "USD"]), timezoneId: z.number().int().positive(), confirmed: z.literal(true) }).parse(d))
  .handler(async ({ data }) => {
    const result = await graph(`${data.businessId}/adaccount`, { method: "POST", params: { name: data.name, currency: data.currency, timezone_id: data.timezoneId, end_advertiser: data.businessId } });
    const id = String(result.id ?? result.account_id ?? "");
    if (!id) throw new Error("A criação não retornou um identificador. Atualize a lista antes de tentar novamente.");
    return { id: id.startsWith("act_") ? id : `act_${id}` };
  });

export type PublishInput = z.infer<typeof createSchema>;

export const publishCampaign = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => createSchema.parse(d))
  .handler(async ({ data }) => {
    const { accountId, campaign: c, adset: s, ad: a } = data;
    const budgetKey = c.budget_type === "daily" ? "daily_budget" : "lifetime_budget";
    const camp = await graph(`${accountId}/campaigns`, {
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

    const adset = await graph(`${accountId}/adsets`, {
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

    const creative = await graph(`${accountId}/adcreatives`, {
      method: "POST",
      params: {
        name: `${a.name} - criativo`,
        object_story_spec: story,
        instagram_user_id: a.instagram_user_id,
        url_tags: a.url_tags,
        degrees_of_freedom_spec: a.enhancements === undefined ? undefined : { creative_features_spec: { standard_enhancements: { enroll_status: a.enhancements ? "OPT_IN" : "OPT_OUT" } } },
      },
    });
    const ad = await graph(`${accountId}/ads`, {
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
