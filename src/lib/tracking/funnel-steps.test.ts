import { describe, expect, it } from 'vitest';
import { funnelSteps, type TrackEvent } from './attribution';
const ev = (v: string, url: string, t: string): TrackEvent => ({ visitor_id: v, session_id: 's', event: 'pageview', url, utm: {}, source: null, email: null, phone: null, created_at: t });
describe('funnelSteps', () => {
  it('counts ordered steps and drop-off', () => {
    const r = funnelSteps([ev('a', 'https://x/vsl', '1'), ev('a', 'https://x/checkout', '2'), ev('b', 'https://x/vsl', '1'), ev('c', 'https://x/checkout', '1')], ['vsl', 'checkout']);
    expect(r.map((s) => s.visitors)).toEqual([2, 1]);
    expect(r[1]!.dropOff).toBe(50);
  });
});
