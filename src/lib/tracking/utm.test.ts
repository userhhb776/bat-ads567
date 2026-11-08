import { describe, expect, it } from 'vitest';
import { parseAdRef, splitNameId, utmsFromUrl } from './utm';
describe('Reused tracking attribution', () => {
  it('preserves campaign and ad identifiers', () => {
    const ref = parseAdRef({utm_campaign:'Produto X|120210987654320123',utm_medium:'Teste|12345678',utm_content:'Criativo A|87654321',utm_source:'FB'});
    expect(ref.campaignId).toBe('120210987654320123');
    expect(ref.adsetId).toBe('12345678');
    expect(ref.adId).toBe('87654321');
  });
  it('does not accept unreplaced dynamic identifiers', () => expect(splitNameId('{{campaign.name}}|{{campaign.id}}').id).toBeNull());
  it('keeps click identifiers alongside UTMs', () => expect(utmsFromUrl('https://example.com?utm_source=FB&fbclid=click-1').fbclid).toBe('click-1'));
});