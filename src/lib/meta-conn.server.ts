import type { SupabaseClient } from "@supabase/supabase-js";

/** Graph API version used by every Meta call in the panel. */
export const META_VERSION = "v26.0";
const DIRECT = `https://graph.facebook.com/${META_VERSION}`;
// Original managed bridge; only used when no own token exists (keeps the current setup working).
const BRIDGE = ["https://connector-gateway", "lovable", `dev/meta_ads/${META_VERSION}`].join(".").replace(".dev/", ".dev/");

export type MetaSource = "painel" | "servidor" | "nativa";
export type MetaConn = { base: string; headers: Record<string, string>; source: MetaSource };

const cache = new Map<string, { at: number; token: string }>();
export const clearMetaCache = (userId?: string) => (userId ? cache.delete(userId) : cache.clear());

/** Own access token saved in Configurações (service-role table), cached 60s. */
export async function savedMetaToken(userId: string, admin?: SupabaseClient<any>): Promise<string> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < 60_000) return hit.token;
  const client = admin ?? (await import("@/integrations/supabase/client.server")).supabaseAdmin;
  const { data } = await client.from("gateway_credentials" as never).select("secret").eq("user_id", userId).eq("platform", "meta").maybeSingle();
  const token = String((data as { secret?: string } | null)?.secret ?? "").trim();
  cache.set(userId, { at: Date.now(), token });
  return token;
}

/** Order: token saved in the panel → META_ACCESS_TOKEN on the server → original native bridge. */
export async function metaConn(userId?: string, admin?: SupabaseClient<any>): Promise<MetaConn> {
  const own = userId ? await savedMetaToken(userId, admin).catch(() => "") : "";
  if (own) return { base: DIRECT, headers: { Authorization: `Bearer ${own}` }, source: "painel" };
  const env = process.env["META_ACCESS_TOKEN"];
  if (env) return { base: DIRECT, headers: { Authorization: `Bearer ${env}` }, source: "servidor" };
  const a = process.env["LOVABLE_API_KEY"], b = process.env["META_ADS_API_KEY"];
  if (a && b) return { base: BRIDGE, headers: { Authorization: `Bearer ${a}`, "X-Connection-Api-Key": b }, source: "nativa" };
  throw new Error("META_NOT_CONNECTED");
}

/** Token-only connection (used to test a token before saving it). */
export const tokenConn = (token: string): MetaConn => ({ base: DIRECT, headers: { Authorization: `Bearer ${token}` }, source: "painel" });

export async function metaParse(res: Response) {
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok || json?.error) {
    const e = json?.error ?? {};
    console.error(`Meta request failed [${res.status}]: ${text}`);
    if (e.code === 190) throw new Error("Meta [190]: o token da Meta expirou ou foi revogado. Gere um novo em Configurações → Conexão Meta.");
    throw new Error(`Meta [${res.status}]: ${e.error_user_msg || e.message || text}`);
  }
  return json;
}

export type GraphInit = { method?: string; params?: Record<string, unknown> };
export type Graph = (path: string, init?: GraphInit) => Promise<any>;

export async function graphWith(conn: MetaConn, path: string, init?: GraphInit) {
  const method = init?.method ?? "GET";
  const url = new URL(`${conn.base}/${path.replace(/^\//, "")}`);
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(init?.params ?? {})) if (v !== undefined && v !== null && v !== "") clean[k] = v;
  if (method === "GET") {
    for (const [k, v] of Object.entries(clean)) url.searchParams.set(k, typeof v === "string" ? v : JSON.stringify(v));
    return metaParse(await fetch(url, { headers: conn.headers }));
  }
  return metaParse(await fetch(url, { method, headers: { ...conn.headers, "Content-Type": "application/json" }, body: JSON.stringify(clean) }));
}

/** Lazily resolves the caller's connection once and reuses it for every call in the request. */
export function makeGraph(userId?: string, admin?: SupabaseClient<any>) {
  let conn: Promise<MetaConn> | null = null;
  const get = () => (conn ??= metaConn(userId, admin));
  const graph: Graph = async (path, init) => graphWith(await get(), path, init);
  return { graph, conn: get };
}

/** Follows the cursor of a list edge until `max` rows. */
export async function graphAll(graph: Graph, path: string, params: Record<string, unknown>, max = 1000) {
  const out: any[] = [];
  let after: string | undefined;
  for (let i = 0; i < 20 && out.length < max; i++) {
    const r = await graph(path, { params: { ...params, ...(after ? { after } : {}) } });
    out.push(...((r.data ?? []) as any[]));
    after = r.paging?.next ? r.paging?.cursors?.after : undefined;
    if (!after) break;
  }
  return out.slice(0, max);
}
