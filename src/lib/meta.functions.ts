import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GRAPH = "https://graph.facebook.com/v21.0";

async function graph(path: string, init?: { method?: string; params?: Record<string, unknown> }) {
  const token = process.env['META_ACCESS_TOKEN'];
  if (!token) throw new Error("META_TOKEN_MISSING");
  const method = init?.method ?? "GET";
  const url = new URL(`${GRAPH}/${path}`);
  let body: URLSearchParams | null = null;
  if (method === "GET") {
    url.searchParams.set("access_token", token);
    for (const [k, v] of Object.entries(init?.params ?? {})) {
      if (v !== undefined) url.searchParams.set(k, typeof v === "string" ? v : JSON.stringify(v));
    }
  } else {
    body = new URLSearchParams({ access_token: token });
    for (const [k, v] of Object.entries(init?.params ?? {})) {
      if (v !== undefined && v !== null && v !== "")
        body.set(k, typeof v === "string" ? v : JSON.stringify(v));
    }
  }
  const res = await fetch(url, { method, body });
  const json = (await res.json()) as any;
  if (!res.ok || json.error) {
    const e = json.error ?? {};
    throw new Error(`Meta [${res.status}]: ${e.error_user_msg || e.message || JSON.stringify(json)}`);
  }
  return json;
}

const INSIGHT_FIELDS = "spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,actions,cost_per_action_type,purchase_roas";

export const getStatus = createServerFn({ method: "GET" }).handler(async () => {
  if (!process.env['META_ACCESS_TOKEN']) return { connected: false as const, name: null };
  try {
    const me = await graph("me", { params: { fields: "id,name" } });
    return { connected: true as const, name: me.name as string };
  } catch (e) {
    return { connected: false as const, name: null, error: (e as Error).message };
  }
});

export const getAdAccounts = createServerFn({ method: "GET" }).handler(async () => {
  const r = await graph("me/adaccounts", {
    params: { fields: "id,name,account_status,currency,amount_spent", limit: "100" },
  });
  return r.data as { id: string; name: string; account_status: number; currency: string }[];
});

export const getAssets = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ accountId: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const [pages, pixels] = await Promise.all([
      graph("me/accounts", { params: { fields: "id,name", limit: "100" } }).catch(() => ({ data: [] })),
      graph(`${data.accountId}/adspixels`, { params: { fields: "id,name" } }).catch(() => ({ data: [] })),
    ]);
    return {
      pages: pages.data as { id: string; name: string }[],
      pixels: pixels.data as { id: string; name: string }[],
    };
  });

const levelSchema = z.enum(["campaigns", "adsets", "ads"]);

export const getObjects = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z
      .object({
        accountId: z.string(),
        level: levelSchema,
        datePreset: z.string(),
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
      fields: `${base},${extra},insights.date_preset(${data.datePreset}){${INSIGHT_FIELDS}}`,
      limit: "200",
    };
    if (data.parentIds?.length) {
      params['filtering'] = [
        { field: data.level === "adsets" ? "campaign.id" : "adset.id", operator: "IN", value: data.parentIds },
      ];
    }
    const r = await graph(`${data.accountId}/${data.level}`, { params });
    return (r.data as any[]).map((o) => ({ ...o, insights: o.insights?.data?.[0] ?? null }));
  });

export const updateObject = createServerFn({ method: "POST" })
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

export const duplicateObject = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string(), deep: z.boolean() }).parse(d))
  .handler(async ({ data }) =>
    graph(`${data.id}/copies`, {
      method: "POST",
      params: { deep_copy: String(data.deep), status_option: "PAUSED", rename_options: { rename_suffix: " - Cópia" } },
    }),
  );

const createSchema = z.object({
  accountId: z.string(),
  campaign: z.object({
    name: z.string().min(1),
    objective: z.string(),
    cbo: z.boolean(),
    daily_budget: z.number().int().positive().optional(),
    bid_strategy: z.string(),
    special_ad_categories: z.array(z.string()),
  }),
  adset: z.object({
    name: z.string().min(1),
    daily_budget: z.number().int().positive().optional(),
    optimization_goal: z.string(),
    billing_event: z.string(),
    pixel_id: z.string().optional(),
    custom_event_type: z.string().optional(),
    countries: z.array(z.string()).min(1),
    age_min: z.number().int().min(13).max(65),
    age_max: z.number().int().min(13).max(65),
    genders: z.array(z.number()),
    start_time: z.string().optional(),
    advantage_audience: z.boolean(),
  }),
  ad: z.object({
    name: z.string().min(1),
    page_id: z.string(),
    instagram_actor_id: z.string().optional(),
    imageBase64: z.string().optional(),
    message: z.string(),
    headline: z.string(),
    description: z.string(),
    link: z.string().url(),
    cta: z.string(),
    url_tags: z.string().optional(),
  }),
  status: z.enum(["ACTIVE", "PAUSED"]),
});

export const publishCampaign = createServerFn({ method: "POST" })
  .inputValidator((d) => createSchema.parse(d))
  .handler(async ({ data }) => {
    const { accountId, campaign: c, adset: s, ad: a } = data;
    const camp = await graph(`${accountId}/campaigns`, {
      method: "POST",
      params: {
        name: c.name,
        objective: c.objective,
        status: data.status,
        special_ad_categories: c.special_ad_categories,
        ...(c.cbo ? { daily_budget: String(c.daily_budget), bid_strategy: c.bid_strategy } : {}),
      },
    });
    const adset = await graph(`${accountId}/adsets`, {
      method: "POST",
      params: {
        name: s.name,
        campaign_id: camp.id,
        status: data.status,
        billing_event: s.billing_event,
        optimization_goal: s.optimization_goal,
        ...(c.cbo ? {} : { daily_budget: String(s.daily_budget), bid_strategy: c.bid_strategy }),
        ...(s.pixel_id ? { promoted_object: { pixel_id: s.pixel_id, custom_event_type: s.custom_event_type } } : {}),
        targeting: {
          geo_locations: { countries: s.countries },
          age_min: s.age_min,
          age_max: s.age_max,
          ...(s.genders.length ? { genders: s.genders } : {}),
          targeting_automation: { advantage_audience: s.advantage_audience ? 1 : 0 },
        },
        start_time: s.start_time,
      },
    });
    let image_hash: string | undefined;
    if (a.imageBase64) {
      const img = await graph(`${accountId}/adimages`, { method: "POST", params: { bytes: a.imageBase64 } });
      image_hash = (Object.values(img.images)[0] as any).hash;
    }
    const creative = await graph(`${accountId}/adcreatives`, {
      method: "POST",
      params: {
        name: `${a.name} - criativo`,
        object_story_spec: {
          page_id: a.page_id,
          ...(a.instagram_actor_id ? { instagram_actor_id: a.instagram_actor_id } : {}),
          link_data: {
            link: a.link,
            message: a.message,
            name: a.headline,
            description: a.description,
            ...(image_hash ? { image_hash } : {}),
            call_to_action: { type: a.cta, value: { link: a.link } },
          },
        },
        url_tags: a.url_tags,
      },
    });
    const ad = await graph(`${accountId}/ads`, {
      method: "POST",
      params: { name: a.name, adset_id: adset.id, creative: { creative_id: creative.id }, status: data.status },
    });
    return { campaignId: camp.id as string, adsetId: adset.id as string, adId: ad.id as string };
  });
