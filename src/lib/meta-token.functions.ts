import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const NEEDED = ["ads_management", "ads_read", "business_management", "pages_show_list", "pages_read_engagement"];
export type MetaTokenStatus = {
  source: "painel" | "servidor" | "nativa" | null;
  name: string | null; masked: string; accounts: number | null; missing: string[]; error: string | null; savedAt: string | null;
};

async function probe(conn: { base: string; headers: Record<string, string> }) {
  const { graphWith } = await import("@/lib/meta-conn.server");
  const me = await graphWith(conn as never, "me", { params: { fields: "id,name" } });
  const acc = await graphWith(conn as never, "me/adaccounts", { params: { fields: "id", limit: "200" } }).catch(() => ({ data: [] }));
  let missing: string[] = [];
  try {
    const p = await graphWith(conn as never, "me/permissions", {});
    const granted = new Set(((p.data ?? []) as { permission: string; status: string }[]).filter((x) => x.status === "granted").map((x) => x.permission));
    if (granted.size) missing = NEEDED.filter((x) => !granted.has(x));
  } catch { /* system user tokens may not list permissions */ }
  return { name: String(me.name ?? me.id), accounts: (acc.data ?? []).length as number, missing };
}

/** Which Meta connection the panel is using now, and whether it answers. */
export const metaTokenStatus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }): Promise<MetaTokenStatus> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { metaConn } = await import("@/lib/meta-conn.server");
  const { data } = await supabaseAdmin.from("gateway_credentials" as never).select("secret, updated_at").eq("user_id", context.userId).eq("platform", "meta").maybeSingle();
  const row = data as { secret?: string; updated_at?: string } | null;
  const masked = row?.secret ? `••••${row.secret.slice(-4)}` : "";
  try {
    const conn = await metaConn(context.userId, supabaseAdmin);
    const r = await probe(conn);
    return { source: conn.source, name: r.name, masked, accounts: r.accounts, missing: r.missing, error: null, savedAt: row?.updated_at ?? null };
  } catch (e) {
    const msg = (e as Error).message;
    return { source: row?.secret ? "painel" : null, name: null, masked, accounts: null, missing: [], error: msg === "META_NOT_CONNECTED" ? "Nenhuma conexão com a Meta ainda." : msg, savedAt: row?.updated_at ?? null };
  }
});

/** Tests a Meta access token and saves it in the owner's protected table. */
export const metaTokenSave = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ token: z.string().trim().min(30).max(1000).regex(/^[A-Za-z0-9_\-|.]+$/, "Token inválido") }).parse(d))
  .handler(async ({ data, context }) => {
    const { tokenConn, clearMetaCache } = await import("@/lib/meta-conn.server");
    let r: Awaited<ReturnType<typeof probe>>;
    try { r = await probe(tokenConn(data.token)); } catch (e) { throw new Error(`A Meta recusou esse token: ${(e as Error).message.replace(/^Meta \[\d+\]: /, "")}`); }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("gateway_credentials" as never).upsert({ user_id: context.userId, platform: "meta", token: JSON.stringify({ name: r.name }), secret: data.token, updated_at: new Date().toISOString() } as never, { onConflict: "user_id,platform" });
    if (error) throw new Error("Não consegui salvar o token.");
    clearMetaCache(context.userId);
    await supabaseAdmin.from("audit_log").insert({ user_id: context.userId, actor: "chefe", module: "meta", action: "salvar_token", target: r.name, after: { accounts: r.accounts, missing: r.missing } as never, result: "ok" });
    return r;
  });

export const metaTokenDelete = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { clearMetaCache } = await import("@/lib/meta-conn.server");
  await supabaseAdmin.from("gateway_credentials" as never).delete().eq("user_id", context.userId).eq("platform", "meta");
  clearMetaCache(context.userId);
  await supabaseAdmin.from("audit_log").insert({ user_id: context.userId, actor: "chefe", module: "meta", action: "remover_token", target: "meta", result: "ok" });
  return { ok: true };
});
