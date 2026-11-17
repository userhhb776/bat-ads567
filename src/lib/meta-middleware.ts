import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Graph, MetaConn } from "./meta-conn.server";

/** Signed-in caller + their Meta connection (own token first). */
export const withMeta = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { makeGraph } = await import("./meta-conn.server");
    const m = makeGraph(context.userId);
    return next({ context: { graph: m.graph as Graph, metaConn: m.conn as () => Promise<MetaConn> } });
  });
