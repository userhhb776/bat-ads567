import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const API = "https://api.elevenlabs.io";
function key() {
  const k = process.env["ELEVENLABS_API_KEY"];
  if (!k) throw new Error("ElevenLabs não está conectada ao projeto.");
  return k;
}
function toB64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf); let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(b64: string) {
  const s = atob(b64); const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export const transcribeVoice = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ audio: z.string().min(10).max(14_000_000), mime: z.string().max(80) }).parse(d))
  .handler(async ({ data }) => {
    const fd = new FormData();
    fd.append("file", new Blob([fromB64(data.audio)], { type: data.mime }), "fala.webm");
    fd.append("model_id", "scribe_v2");
    fd.append("language_code", "por");
    const r = await fetch(`${API}/v1/speech-to-text`, { method: "POST", headers: { "xi-api-key": key() }, body: fd });
    if (!r.ok) { const t = await r.text(); console.error(`STT [${r.status}]: ${t}`); return { error: `Não entendi o áudio (${r.status}).` }; }
    const j = (await r.json()) as { text?: string };
    return { text: String(j.text ?? "").trim() };
  });

export const speakVoice = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    text: z.string().min(1).max(2500),
    voiceId: z.string().regex(/^[A-Za-z0-9]{10,40}$/),
    speed: z.number().min(0.7).max(1.2).default(1),
    stability: z.number().min(0).max(1).default(0.5),
  }).parse(d))
  .handler(async ({ data }) => {
    const r = await fetch(`${API}/v1/text-to-speech/${data.voiceId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key(), "Content-Type": "application/json" },
      body: JSON.stringify({ text: data.text, model_id: "eleven_flash_v2_5", voice_settings: { stability: data.stability, similarity_boost: 0.8, speed: data.speed } }),
    });
    if (!r.ok) { const t = await r.text(); console.error(`TTS [${r.status}]: ${t}`); return { error: `Falha na voz (${r.status}): ${t.slice(0, 200)}` }; }
    return { audio: toB64(await r.arrayBuffer()) };
  });

export const listVoices = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .handler(async () => {
    const r = await fetch(`${API}/v1/voices`, { headers: { "xi-api-key": key() } });
    if (!r.ok) return { error: `Não consegui listar as vozes (${r.status}).`, voices: [] as Voice[] };
    const j = (await r.json()) as { voices?: any[] };
    const voices: Voice[] = (j.voices ?? []).map((v) => ({ id: String(v.voice_id), name: String(v.name), category: String(v.category ?? ""), preview: v.preview_url ? String(v.preview_url) : "", labels: Object.values(v.labels ?? {}).join(" · ") }));
    return { voices };
  });

export type Voice = { id: string; name: string; category: string; preview: string; labels: string };
