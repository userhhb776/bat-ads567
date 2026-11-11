import type { SupabaseClient } from "@supabase/supabase-js";
type Admin = SupabaseClient<any>;

/** Sends a phone push to every device the user installed; drops dead subscriptions. */
export async function pushUser(admin: Admin, userId: string, title: string, body: string) {
  const { data: subs } = await admin.from("app_state").select("key,value").eq("user_id", userId).like("key", "bg.push.%");
  if (!subs?.length) return;
  const { sendPush } = await import("./push.server");
  for (const s of subs) {
    try { if (!(await sendPush(s.value as never, title, body))) await admin.from("app_state").delete().eq("user_id", userId).eq("key", s.key); }
    catch (e) { console.error("push", e); }
  }
}

/** Bell notification plus optional phone push. */
export async function notifyUser(admin: Admin, userId: string, n: { kind: string; title: string; body?: string | null; link?: string }, push = true) {
  await admin.from("notifications").insert({ user_id: userId, kind: n.kind, title: n.title.slice(0, 120), body: n.body ?? null, link: n.link ?? null });
  if (push) await pushUser(admin, userId, n.title.slice(0, 120), (n.body ?? "").slice(0, 200));
}

/** "Something stopped working" alert, at most once every 6h per title. */
export async function healthAlert(admin: Admin, userId: string, title: string, body: string, link = "/sistema") {
  const since = new Date(Date.now() - 6 * 3600e3).toISOString();
  const { data } = await admin.from("notifications").select("id").eq("user_id", userId).eq("kind", "sistema").eq("title", title).gte("created_at", since).limit(1);
  if (data?.length) return;
  await notifyUser(admin, userId, { kind: "sistema", title, body, link });
}
