import { describe, expect, it, vi, beforeEach } from "vitest";

const rows = [
  { platform: "wa-1", token: JSON.stringify({ url: "https://a.onrender.com", name: "A", primary: false }), secret: "ka" },
  { platform: "wa-2", token: JSON.stringify({ url: "https://b.onrender.com", name: "B", primary: true }), secret: "kb" },
  { platform: "render-2", token: "https://old.onrender.com", secret: "ko" },
];
vi.mock("@/integrations/supabase/client.server", () => {
  const q: any = { select: () => q, in: () => q, eq: () => q, then: (r: (v: unknown) => void) => r({ data: rows }) };
  return { supabaseAdmin: { from: () => q } };
});

import { clearWaCache, evo, parseWaToken, waServers } from "./channels.server";

describe("WhatsApp servers", () => {
  beforeEach(() => { clearWaCache(); vi.unstubAllGlobals(); vi.stubEnv("RENDER_WHATSAPP_URL", ""); });

  it("reads old plain-address reserves", () => {
    expect(parseWaToken("https://x.onrender.com")).toEqual({ url: "https://x.onrender.com", name: "", primary: false });
  });

  it("puts the main server first, then other panel servers, then the old reserve", async () => {
    expect((await waServers()).map((s) => s.slot)).toEqual(["wa-2", "wa-1", "render-2"]);
  });

  it("moves to the next server when the main one is down or rejects the key", async () => {
    const hits: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (u: string) => { hits.push(u); if (u.startsWith("https://b")) return new Response("", { status: 503 }); if (u.startsWith("https://a")) return new Response("", { status: 401 }); return new Response("[]", { status: 200 }); }));
    const r = await evo("/instance/fetchInstances");
    expect(r.status).toBe(200);
    expect(hits.map((h) => h.split("/")[2])).toEqual(["b.onrender.com", "a.onrender.com", "old.onrender.com"]);
  });

  it("uses only the chosen server when a slot is given", async () => {
    const hits: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (u: string) => { hits.push(u); return new Response("", { status: 503 }); }));
    const r = await evo("/instance/create", { method: "POST" }, "wa-1");
    expect(r.status).toBe(503);
    expect(hits).toHaveLength(1);
  });
});
