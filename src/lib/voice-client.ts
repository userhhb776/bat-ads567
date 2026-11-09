export const DEFAULT_VOICE = "5isFcNrNZYaUmHUjWIS2"; // voz "Crowley" da conta ElevenLabs do chefe
export type VoiceSettings = { voiceId: string; speed: number; stability: number };

export function getVoiceSettings(): VoiceSettings {
  try {
    const s = JSON.parse(localStorage.getItem("batgotham.crowley-voice") || "{}");
    return { voiceId: s.voiceId || DEFAULT_VOICE, speed: Number(s.speed) || 1, stability: s.stability ?? 0.5 };
  } catch { return { voiceId: DEFAULT_VOICE, speed: 1, stability: 0.5 }; }
}
export function saveVoiceSettings(v: VoiceSettings) { localStorage.setItem("batgotham.crowley-voice", JSON.stringify(v)); }

/** Remove a linha de ação e marcações para a fala ficar natural. */
export function speakable(text: string) {
  return text.split("\n").filter((l) => !l.trim().startsWith("ACAO:")).join(" ").replace(/[*_#`>]/g, "").replace(/\s+/g, " ").trim().slice(0, 2400);
}

export function blobToB64(b: Blob): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.onerror = rej; r.readAsDataURL(b); });
}

/** Grava até detectar ~1,3s de silêncio após a fala (ou 30s). */
export async function recordUtterance(stream: MediaStream, signal: { stop: boolean }): Promise<Blob | null> {
  const ctx = new AudioContext();
  const an = ctx.createAnalyser(); an.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(an);
  const buf = new Uint8Array(an.fftSize);
  const rec = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((r) => (rec.onstop = () => r()));
  rec.start(250);
  let spoke = false, silentSince = 0; const start = Date.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      if (signal.stop) return resolve();
      an.getByteTimeDomainData(buf);
      let sum = 0; for (const v of buf) sum += (v - 128) ** 2;
      const rms = Math.sqrt(sum / buf.length);
      const now = Date.now();
      if (rms > 6) { spoke = true; silentSince = 0; } else if (spoke) { silentSince ||= now; if (now - silentSince > 1300) return resolve(); }
      if (now - start > 30000 || (!spoke && now - start > 15000)) return resolve();
      requestAnimationFrame(tick);
    };
    tick();
  });
  rec.stop(); await done; void ctx.close();
  return spoke && !signal.stop ? new Blob(chunks, { type: rec.mimeType || "audio/webm" }) : null;
}
