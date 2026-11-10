import { z } from "zod";
/** Generated pages here never talk to a database; kept as an optional hook for the BatDev engine. */
export const siteConnectionSchema = z.object({ url: z.string().url().max(300), publicKey: z.string().max(500) });
export type SiteConnection = z.infer<typeof siteConnectionSchema>;
export function connectionPrompt(connection?: SiteConnection) {
  return connection ? "O objeto global supabase (cliente público) está disponível para formulários." : "";
}
