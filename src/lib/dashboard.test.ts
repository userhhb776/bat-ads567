import { describe,it,expect } from 'vitest';
import { dateRange,filterPayments,paymentTotals } from './dashboard';
import type {GatewayEvent} from './sales';
const event:GatewayEvent={id:'1',platform:'stripe',external_id:'a',status:'approved',amount:10,currency:'USD',product_name:'X',customer_email:null,customer_phone:null,utm:{utm_source:'facebook',campaign_id:'c1'},occurred_at:'2026-11-09T12:00:00Z'};
describe('global reporting',()=>{
 it('converts USD and BRL before totaling',()=>expect(paymentTotals([event,{...event,id:'2',external_id:'b',amount:50,currency:'BRL'}],'BRL',5).revenue).toBe(100));
 it('filters gateway payments by selected campaign',()=>{const f={period:'today',since:'',until:'',product:'all',campaign:'c2',source:'all'};expect(filterPayments([event],f,{start:new Date('2026-11-09T00:00:00Z'),end:new Date('2026-11-10T00:00:00Z')})).toHaveLength(0);});
 it('applies exact custom dates',()=>{const r=dateRange('custom','2026-11-01','2026-11-03');expect(r.start.getDate()).toBe(1);expect(r.end.getDate()).toBe(3);});
});

import { estimatedProfit } from './dashboard';
describe('estimatedProfit', () => {
  it('subtracts spend and product cost from approved revenue', () => {
    expect(estimatedProfit({ revenue: 500, spend: 200, approved: [{ product_name: 'A' }, { product_name: 'A' }], products: [{ name: 'A', cost: 30, currency: 'BRL' }], target: 'BRL', rate: 5 })).toBe(240);
  });
  it('returns null when a sold product has no registered cost', () => {
    expect(estimatedProfit({ revenue: 100, spend: 10, approved: [{ product_name: 'X' }], products: [], target: 'BRL', rate: 5 })).toBeNull();
  });
});
