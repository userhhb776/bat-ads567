import { useEffect, useState } from "react";

/** Device-local persistence used until the user's database tables exist. */
export function useStore<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    try { const raw = localStorage.getItem("bg." + key); if (raw) setValue(JSON.parse(raw)); } catch { /* ignore */ }
  }, [key]);
  const save = (next: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      localStorage.setItem("bg." + key, JSON.stringify(v));
      return v;
    });
  };
  return [value, save] as const;
}

export function readStore<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem("bg." + key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}

export const uid = () => crypto.randomUUID();

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]!);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export function fromCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  const parse = (l: string) => {
    const out: string[] = []; let cur = ""; let q = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i]!;
      if (q) { if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"') q = true; else if (ch === "," || ch === ";") { out.push(cur); cur = ""; } else cur += ch;
    }
    out.push(cur); return out;
  };
  const head = parse(lines[0] ?? "").map((h) => h.trim().toLowerCase());
  return lines.slice(1).filter(Boolean).map((l) => { const v = parse(l); return Object.fromEntries(head.map((h, i) => [h, (v[i] ?? "").trim()])); });
}

export function download(name: string, content: string, type = "text/csv") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name; a.click();
}
