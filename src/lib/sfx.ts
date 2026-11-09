/** Sci-fi interface sounds made with Web Audio (no files). Device-only preference. */
const KEY = "batgotham.sfx";
let ctx: AudioContext | null = null;
let last = 0;

export const sfxEnabled = () => typeof localStorage !== "undefined" && localStorage.getItem(KEY) !== "0";
export const setSfx = (on: boolean) => localStorage.setItem(KEY, on ? "1" : "0");

function tone(freq: number, end: number, start: number, dur: number, type: OscillatorType, vol: number) {
  const c = ctx!; const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, c.currentTime + start);
  o.frequency.exponentialRampToValueAtTime(end, c.currentTime + start + dur);
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(vol, c.currentTime + start + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination); o.start(c.currentTime + start); o.stop(c.currentTime + start + dur + 0.02);
}

/** "nav" = module change (double chirp), "tap" = button (short blip). */
export function playSfx(kind: "tap" | "nav" = "tap") {
  if (!sfxEnabled()) return;
  const now = performance.now(); if (now - last < 60) return; last = now;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    if (kind === "nav") { tone(880, 1760, 0, 0.07, "square", 0.035); tone(1320, 2640, 0.07, 0.09, "sine", 0.05); }
    else tone(1600, 900, 0, 0.05, "triangle", 0.04);
  } catch { /* audio unavailable */ }
}

/** One global listener: links play "nav", buttons/switches play "tap". */
export function installSfx() {
  const on = (e: PointerEvent) => {
    const el = (e.target as HTMLElement | null)?.closest("a,button,[role=button],[role=tab],[role=switch],[role=menuitem],select");
    if (!el) return;
    playSfx(el.tagName === "A" ? "nav" : "tap");
  };
  document.addEventListener("pointerdown", on, { passive: true });
  return () => document.removeEventListener("pointerdown", on);
}
