import type { SiteConnection } from "./site-connection";
import { slugify, type SalesPage } from "./pages";

/** Store templates read their catalog from the panel database with the public key. */
export function storeConnection(code: string): SiteConnection | undefined {
  if (!code.includes("site_stores")) return undefined;
  const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined, publicKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;
  return url && publicKey ? { url, publicKey } : undefined;
}
export const newStoreKey = (name: string) => `${(slugify(name) || "loja").slice(0, 40)}-${Math.random().toString(36).slice(2, 6)}`;
/** Hosting project name used when the site was published (same rule as publishing). */
export const siteProject = (p: Pick<SalesPage, "slug" | "name">) => slugify(p.slug || p.name) || "site";
/** A typed domain reduced to its host name: "https://www.Minha.com/x" → "www.minha.com". */
export function cleanDomain(raw: string): string {
  const v = raw.trim().toLowerCase().replace(/^https?:\/\//, "").split(/[/?#]/)[0] ?? "";
  return /^([a-z0-9-]+\.)+[a-z]{2,}$/.test(v) ? v : "";
}
/** Root domains (minha.com) point with an A record; subdomains (loja.minha.com) with CNAME. */
export const isApex = (d: string) => d.split(".").length === 2 || (/\.(com|net|org|gov|edu)\.br$/.test(d) && d.split(".").length === 3);
