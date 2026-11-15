import { describe, expect, it } from "vitest";
import { everyMinutes, intervalOf, planWaPing, PING_TITLE, type CronJob } from "./cronjob";

const job = (jobId: number, url: string, enabled = true, every = 10, title = ""): CronJob => ({ jobId, url, enabled, title, lastStatus: 1, lastExecution: 0, nextExecution: null, schedule: everyMinutes(every) });
const A = "https://a.onrender.com", B = "https://b.onrender.com", WATCH = "https://app.example/api/public/cron/watch";

describe("cron-job.org keep-awake ping", () => {
  it("pings every 10 minutes", () => {
    expect(everyMinutes(10).minutes).toEqual([0, 10, 20, 30, 40, 50]);
    expect(intervalOf(everyMinutes(10))).toBe(10);
    expect(intervalOf(everyMinutes(15))).toBe(15);
  });
  it("leaves an existing correct ping on the main server untouched", () => {
    const p = planWaPing([job(1, WATCH, true, 15), job(2, A + "/")], A, [A, B]);
    expect(p).toEqual({ create: null, update: null, pause: [], target: 2 });
  });
  it("moves the ping to the new main server and never touches the watch job", () => {
    const p = planWaPing([job(1, WATCH, true, 15), job(2, A + "/")], B, [B, A]);
    expect(p.update).toEqual({ jobId: 2, url: B + "/" });
    expect(p.pause).toEqual([]);
  });
  it("pauses pings on backup servers so they don't burn free hours", () => {
    const p = planWaPing([job(2, A), job(3, B)], B, [B, A]);
    expect(p.target).toBe(3);
    expect(p.pause).toEqual([2]);
  });
  it("creates the ping when none exists", () => {
    expect(planWaPing([job(1, WATCH, true, 15)], A, [A]).create).toEqual({ url: A + "/" });
  });
  it("fixes a ping slower than 10 minutes and re-enables a paused one", () => {
    expect(planWaPing([job(2, A, true, 30)], A, [A]).update).toEqual({ jobId: 2, url: A + "/" });
    expect(planWaPing([job(2, A, false)], A, [A]).update).toEqual({ jobId: 2, url: A + "/" });
  });
  it("redirects the panel's own job after its server was removed", () => {
    const p = planWaPing([job(5, "https://old.onrender.com/", true, 10, PING_TITLE)], A, [A]);
    expect(p.update).toEqual({ jobId: 5, url: A + "/" });
  });
  it("pauses every WhatsApp ping when no server is left", () => {
    expect(planWaPing([job(1, WATCH), job(2, A)], null, [], 2).pause).toEqual([2]);
  });
});
