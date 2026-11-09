import { describe, it, expect } from 'vitest';
import { buildJourneys, bySource, sourceOf } from './attribution';

const ev = (v: string, s: string | null, t: string, event = 'pageview') => ({ visitor_id: v, session_id: t, event, url: null, utm: {}, source: s, email: null, phone: null, created_at: t });

describe('attribution', () => {
  it('first click is the oldest source, last click the newest', () => {
    const [j] = buildJourneys([ev('a', 'google', '2026-01-02'), ev('a', 'meta', '2026-01-01'), ev('a', 'direct', '2026-01-03', 'purchase')]);
    expect(j.first).toBe('meta'); expect(j.last).toBe('google'); expect(j.converted).toBe(true); expect(j.sessions).toBe(3);
  });
  it('groups per model', () => {
    const js = buildJourneys([ev('a', 'meta', '1'), ev('a', 'google', '2'), ev('b', 'google', '1')]);
    expect(Object.fromEntries(bySource(js, 'first'))['meta'].visitors).toBe(1);
    expect(Object.fromEntries(bySource(js, 'last'))['google'].visitors).toBe(2);
  });
  it('detects fbclid as meta', () => { expect(sourceOf({ fbclid: 'x' }, null)).toBe('meta'); expect(sourceOf({}, null)).toBe('direct'); });
});
