import { supabase } from "@/integrations/supabase/client";

/** Keys owned by the app; everything saved under these prefixes mirrors to the user's database. */
export const SYNC_PREFIXES = ["bg.", "batgotham.", "bat-gotham-"] as const;
export const isSynced = (key: string) => SYNC_PREFIXES.some((p) => key.startsWith(p)) && key !== "batgotham.currency";

const pending = new Map<string, string>();
let timer: ReturnType<typeof setTimeout> | null = null;
let userId: string | null = null;
let installed = false;

async function flush() {
  timer = null;
  if (!userId || !pending.size) return;
  const rows = [...pending].map(([key, raw]) => {
    let value: unknown = raw;
    try { value = JSON.parse(raw); } catch { /* plain string */ }
    return { user_id: userId!, key, value: value as never };
  });
  pending.clear();
  const { error } = await supabase.from("app_state").upsert(rows, { onConflict: "user_id,key" });
  if (error) { console.error("cloud sync failed", error); rows.forEach((r) => pending.set(r.key, JSON.stringify(r.value))); }
}

function queue(key: string, raw: string) {
  pending.set(key, raw);
  if (!timer) timer = setTimeout(flush, 800);
}

/** Pulls the cloud copy into this device, uploads device-only data, then mirrors future writes. */
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
  const { data, error } = await supabase.from("app_state").select("key,value").eq("user_id", uid);
  if (error) { console.error(error); return false; }
  const cloud = new Map((data ?? []).map((r) => [r.key, JSON.stringify(r.value)]));
  let changed = false;
  for (const [key, raw] of cloud) {
    if (localStorage.getItem(key) !== raw) { Storage.prototype.setItem.call(localStorage, key, raw); changed = true; }
  }
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)!;
    if (isSynced(key) && !cloud.has(key)) queue(key, localStorage.getItem(key)!);
  }
  return changed;
}

export function stopCloudSync() { userId = null; pending.clear(); }
