import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { diffRows } from "./cloud-sync";

describe("diffRows", () => {
  it("detects created, edited and deleted records by id", () => {
    const prev = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
    const next = [{ id: "a", name: "A2" }, { id: "c", name: "C" }];
    const d = diffRows(prev, next);
    expect(d.upserts.map((u) => u.id)).toEqual(["a", "c"]);
    expect(d.deletes.map((x) => x.id)).toEqual(["b"]);
  });
  it("sends nothing when the list is unchanged", () => {
    const list = [{ id: "a" }, { id: "b" }];
    expect(diffRows(list, structuredClone(list))).toEqual({ upserts: [], deletes: [] });
  });
});
