import { p256 } from "@noble/curves/nist.js";
import { buildPushPayload, type PushSubscription } from "@block65/webcrypto-web-push";

const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** VAPID keys derived from the VAPID_SEED secret, so only one secret is stored. */
export async function vapidKeys() {
  const seed = process.env["VAPID_SEED"];
  if (!seed) throw new Error("VAPID_SEED ausente");
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed)));
  return { subject: "mailto:marketinggeralconta@gmail.com", privateKey: b64u(d), publicKey: b64u(p256.getPublicKey(d, false)) };
}

/** Sends one notification; returns false when the device subscription is gone. */
export async function sendPush(sub: PushSubscription, title: string, body: string) {
  const payload = await buildPushPayload({ data: JSON.stringify({ title, body }), options: { ttl: 3600, urgency: "high" } }, sub, await vapidKeys());
  const r = await fetch(sub.endpoint, payload as RequestInit);
  return r.status !== 404 && r.status !== 410;
}
