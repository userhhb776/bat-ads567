import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const pushPublicKey = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async () => {
  const { vapidKeys } = await import("./push.server");
  return (await vapidKeys()).publicKey;
});

const Sub = z.object({ endpoint: z.string().url(), expirationTime: z.number().nullable().optional(), keys: z.object({ p256dh: z.string(), auth: z.string() }) });

export const testPush = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => Sub.parse(d))
  .handler(async ({ data }) => {
    const { sendPush } = await import("./push.server");
    const ok = await sendPush({ ...data, expirationTime: data.expirationTime ?? null }, "Bat Gotham", "Notificações ativas, chefe. Crowley está de vigia.");
    return { ok };
  });
