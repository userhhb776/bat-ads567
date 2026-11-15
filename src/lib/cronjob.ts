/** Pure helpers for the cron-job.org integration (keep-awake ping for the main WhatsApp server). */
export type CronSchedule = { timezone?: string; hours: number[]; mdays: number[]; minutes: number[]; months: number[]; wdays: number[]; expiresAt?: number };
export type CronJob = { jobId: number; enabled: boolean; title: string; url: string; lastStatus: number; lastExecution: number; lastDuration?: number; nextExecution: number | null; schedule?: CronSchedule };

export const PING_TITLE = "Bat Gotham · WhatsApp acordado";
export const PING_EVERY = 10;

export const normUrl = (u: string) => u.trim().toLowerCase().replace(/\/+$/, "");

/** Schedule that fires every N minutes, all day. */
export function everyMinutes(n: number, timezone = "America/Sao_Paulo"): CronSchedule {
  const minutes: number[] = [];
  for (let m = 0; m < 60; m += n) minutes.push(m);
  return { timezone, hours: [-1], mdays: [-1], minutes, months: [-1], wdays: [-1], expiresAt: 0 };
}

/** Largest gap in minutes between runs (Infinity when it does not run every hour). */
export function intervalOf(s?: CronSchedule): number {
  if (!s) return Infinity;
  if (!s.hours.includes(-1) || !s.mdays.includes(-1) || !s.months.includes(-1) || !s.wdays.includes(-1)) return Infinity;
  if (s.minutes.includes(-1)) return 1;
  const m = [...new Set(s.minutes)].sort((a, b) => a - b);
  if (!m.length) return Infinity;
  let gap = 60 - m[m.length - 1]! + m[0]!;
  for (let i = 1; i < m.length; i++) gap = Math.max(gap, m[i]! - m[i - 1]!);
  return gap;
}

const STATUS: Record<number, string> = { 0: "ainda não rodou", 1: "respondeu OK", 2: "falhou (endereço não encontrado)", 3: "falhou (não conectou)", 4: "falhou (servidor respondeu com erro)", 5: "falhou (demorou demais)", 6: "falhou (resposta grande demais)", 7: "falhou (endereço inválido)", 8: "falhou (erro do cron-job.org)", 9: "falhou" };
export const statusText = (code: number) => STATUS[code] ?? "falhou";

export type PingPlan = { create: { url: string } | null; update: { jobId: number; url: string } | null; pause: number[]; target: number | null };

/**
 * Decides how the ping jobs must look: exactly one enabled job pinging the main server every 10 min;
 * jobs pinging other WhatsApp servers (or the panel's old managed job) get paused, so backups don't burn free hours.
 */
export function planWaPing(jobs: CronJob[], primaryUrl: string | null, waUrls: string[], managedId?: number | null): PingPlan {
  const wa = new Set(waUrls.map(normUrl));
  const mine = jobs.filter((j) => wa.has(normUrl(j.url)) || j.title === PING_TITLE || (managedId != null && j.jobId === managedId));
  if (!primaryUrl) return { create: null, update: null, pause: mine.filter((j) => j.enabled).map((j) => j.jobId), target: null };
  const p = normUrl(primaryUrl);
  const target = mine.find((j) => normUrl(j.url) === p && j.enabled) ?? mine.find((j) => normUrl(j.url) === p) ?? mine.find((j) => j.jobId === managedId) ?? mine.find((j) => j.title === PING_TITLE) ?? mine[0] ?? null;
  const url = p + "/";
  const pause = mine.filter((j) => j !== target && j.enabled).map((j) => j.jobId);
  if (!target) return { create: { url }, update: null, pause, target: null };
  const fine = normUrl(target.url) === p && target.enabled && intervalOf(target.schedule) <= PING_EVERY;
  return { create: null, update: fine ? null : { jobId: target.jobId, url }, pause, target: target.jobId };
}
