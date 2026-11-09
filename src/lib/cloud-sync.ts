import { supabase } from "@/integrations/supabase/client";

/** Keys owned by the app; everything saved under these prefixes mirrors to the user's database. */
export const SYNC_PREFIXES = ["bg.", "batgotham.", "bat-gotham-"] as const;
export const isSynced = (key: string) => SYNC_PREFIXES.some((p) => key.startsWith(p)) && key !== "batgotham.currency";

/** Operational lists live in their own tables (source of truth); the device copy is only a cache. */
export const TABLE_KEYS: Record<string, string> = {
  "bg.products": "products", "bg.orders": "orders", "bg.contacts": "contacts", "bg.conversations": "conversations",
  "bg.messages": "messages", "bg.automations": "automations", "bg.automation-logs": "automation_runs",
  "bg.intel-rules": "monitor_rules", "bg.intel-history": "monitor_history", "bg.offers": "offer_radar",
  "bat-gotham-pages": "sales_pages", "bg.crowley-messages": "crowley_messages",
  "bg.creatives": "creatives", "bg.copies": "copies", "bg.utm-links": "utm_links",
};
/** High-volume logs are not duplicated into the audit trail. */
const NO_AUDIT = new Set(["messages", "automation_runs", "monitor_history", "crowley_messages"]);

type Item = Record<string, unknown>;
export const rowId = (item: unknown, i: number) => {
  const id = item && typeof item === "object" ? (item as Item)["id"] : undefined;
  return typeof id === "string" || typeof id === "number" ? String(id) : `i${i}`;
};

/** Pure diff between two list snapshots: rows to upsert and ids to delete. */
export function diffRows(prev: unknown[], next: unknown[]) {
  const before = new Map(prev.map((x, i) => [rowId(x, i), x]));
  const upserts: { id: string; data: unknown; position: number; before?: unknown }[] = [];
  const seen = new Set<string>();
  next.forEach((x, i) => {
    const id = rowId(x, i); seen.add(id);
    const old = before.get(id);
    if (old === undefined || JSON.stringify(old) !== JSON.stringify(x) || prev.findIndex((p, j) => rowId(p, j) === id) !== i)
      upserts.push({ id, data: x, position: i, before: old });
  });
  const deletes = [...before.keys()].filter((id) => !seen.has(id)).map((id) => ({ id, before: before.get(id) }));
  return { upserts, deletes };
}

const pending = new Map<string, string>();
const snapshots = new Map<string, unknown[]>();
let timer: ReturnType<typeof setTimeout> | null = null;
let userId: string | null = null;
let installed = false;

const parse = (raw: string): unknown => { try { return JSON.parse(raw); } catch { return raw; } };

async function flushTable(key: string, table: string, raw: string) {
  const next = parse(raw);
  if (!Array.isArray(next)) return;
  const { upserts, deletes } = diffRows(snapshots.get(key) ?? [], next);
  const uid = userId!;
  if (upserts.length) {
    const { error } = await supabase.from(table as never).upsert(upserts.map((u) => ({ id: u.id, user_id: uid, data: u.data, position: u.position })) as never, { onConflict: "user_id,id" });
    if (error) throw error;
  }
  if (deletes.length) {
    const { error } = await supabase.from(table as never).delete().eq("user_id", uid).in("id", deletes.map((d) => d.id));
    if (error) throw error;
  }
  snapshots.set(key, next);
  if (!NO_AUDIT.has(table) && (upserts.length || deletes.length)) {
    const rows = [
      ...upserts.map((u) => ({ user_id: uid, module: table, action: u.before === undefined ? "criar" : "editar", target: u.id, before: (u.before ?? null) as never, after: u.data as never })),
      ...deletes.map((d) => ({ user_id: uid, module: table, action: "excluir", target: d.id, before: d.before as never, after: null })),
    ];
    await supabase.from("audit_log").insert(rows.slice(0, 200));
  }
}

async function flush() {
  timer = null;
  if (!userId || !pending.size) return;
  const batch = [...pending]; pending.clear();
  const plain: { user_id: string; key: string; value: never }[] = [];
  for (const [key, raw] of batch) {
    const table = TABLE_KEYS[key];
    if (!table) { plain.push({ user_id: userId, key, value: parse(raw) as never }); continue; }
    try { await flushTable(key, table, raw); } catch (e) { console.error("sync failed", table, e); if (!pending.has(key)) pending.set(key, raw); }
  }
  if (plain.length) {
    const { error } = await supabase.from("app_state").upsert(plain, { onConflict: "user_id,key" });
    if (error) { console.error("cloud sync failed", error); plain.forEach((r) => { if (!pending.has(r.key)) pending.set(r.key, JSON.stringify(r.value)); }); }
  }
  if (pending.size && !timer) timer = setTimeout(flush, 5000);
}

function queue(key: string, raw: string) {
  pending.set(key, raw);
  if (!timer) timer = setTimeout(flush, 800);
}

/** Pulls the database into this device, uploads device-only data, then mirrors future writes. */
export async function startCloudSync(uid: string): Promise<boolean> {
  userId = uid;
  if (!installed) {
    installed = true;
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      orig.call(this, key, value);
      if (this === window.localStorage && isSynced(key)) queue(key, value);
    };
    window.addEventListener("beforeunload", () => { void flush(); });
  }
  const set = (k: string, raw: string) => { if (localStorage.getItem(k) !== raw) { Storage.prototype.setItem.call(localStorage, k, raw); return true; } return false; };
  let changed = false;
  const tables = await Promise.all(Object.entries(TABLE_KEYS).map(async ([key, table]) => {
    const { data, error } = await supabase.from(table as never).select("id,data,position").eq("user_id", uid).order("position");
    return { key, error, rows: (data ?? []) as unknown as { data: unknown }[] };
  }));
  for (const t of tables) {
    if (t.error) { console.error(t.error); return false; }
    const list = t.rows.map((r) => r.data);
    const local = parse(localStorage.getItem(t.key) ?? "[]");
    if (list.length || !Array.isArray(local) || !local.length) { snapshots.set(t.key, list); changed = set(t.key, JSON.stringify(list)) || changed; }
    else { snapshots.set(t.key, []); queue(t.key, JSON.stringify(local)); } // device-only data: upload it
  }
  const { data, error } = await supabase.from("app_state").select("key,value").eq("user_id", uid);
  if (error) { console.error(error); return false; }
  const cloud = new Map((data ?? []).filter((r) => !TABLE_KEYS[r.key]).map((r) => [r.key, JSON.stringify(r.value)]));
  for (const [key, raw] of cloud) changed = set(key, raw) || changed;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)!;
    if (isSynced(key) && !TABLE_KEYS[key] && !cloud.has(key)) queue(key, localStorage.getItem(key)!);
  }
  if (changed) window.dispatchEvent(new Event("bg-store-change"));
  return changed;
}

export function stopCloudSync() { userId = null; pending.clear(); snapshots.clear(); }
