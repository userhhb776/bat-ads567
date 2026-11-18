import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({ project: z.string().regex(/^[a-z0-9-]{1,60}$/), domain: z.string().max(253).regex(/^([a-z0-9-]+\.)+[a-z]{2,}$/) });
type DomainState = { ok: boolean; verified: boolean; misconfigured: boolean; verification: { type: string; domain: string; value: string }[]; error: string };

async function vercel(path: string, init?: RequestInit) {
  const token = process.env["VERCEL_TOKEN"];
  if (!token) return { status: 0, body: { error: { message: "Para usar domínio próprio, cadastre o token da hospedagem." } } as Record<string, any> };
  const r = await fetch(`https://api.vercel.com${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) } }).catch(() => null);
  return { status: r?.status ?? 0, body: (r ? await r.json().catch(() => ({})) : { error: { message: "Hospedagem não respondeu." } }) as Record<string, any> };
}

async function state(project: string, domain: string): Promise<DomainState> {
  const d = await vercel(`/v9/projects/${project}/domains/${domain}`);
  if (d.status !== 200) return { ok: false, verified: false, misconfigured: true, verification: [], error: d.body?.error?.message ?? `Hospedagem respondeu ${d.status}.` };
  const c = await vercel(`/v6/domains/${domain}/config`);
  return { ok: true, verified: !!d.body.verified, misconfigured: c.status === 200 ? !!c.body.misconfigured : true, verification: Array.isArray(d.body.verification) ? d.body.verification : [], error: "" };
}

/** Links the chefe's own domain to a published site. */
export const addSiteDomain = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data, context }) => {
    const r = await vercel(`/v10/projects/${data.project}/domains`, { method: "POST", body: JSON.stringify({ name: data.domain }) });
    const already = r.body?.error?.code === "domain_already_in_use" || r.body?.error?.code === "domain_already_exists";
    if (r.status !== 200 && !already) return { ok: false, verified: false, misconfigured: true, verification: [], error: r.body?.error?.message ?? `Hospedagem respondeu ${r.status}.` } satisfies DomainState;
    await context.supabase.from("audit_log").insert({ user_id: context.userId, module: "bat-dev", action: "dominio", target: data.domain, after: { project: data.project } as never });
    return state(data.project, data.domain);
  });

/** Tells whether the domain already points to the site. */
export const checkSiteDomain = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data }) => state(data.project, data.domain));
