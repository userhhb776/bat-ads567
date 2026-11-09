import type { GatewayEvent } from './sales';
import { summarizeSales } from './sales';
export type DashboardFilters = { period:string; since:string; until:string; product:string; campaign:string; source:string };
export function dateRange(period:string,since:string,until:string,now=new Date()) {
 const end=new Date(now);end.setHours(23,59,59,999);const start=new Date(now);start.setHours(0,0,0,0);
 if(period==='yesterday'){start.setDate(start.getDate()-1);end.setDate(end.getDate()-1);}
 if(period==='last_7d')start.setDate(start.getDate()-6);
 if(period==='last_30d')start.setDate(start.getDate()-29);
 if(period==='custom'){const a=new Date(`${since}T00:00:00`);const b=new Date(`${until}T23:59:59.999`);if(Number.isFinite(a.getTime())&&Number.isFinite(b.getTime())&&a<=b)return {start:a,end:b};}
 return {start,end};
}
export function filterPayments(events:GatewayEvent[],f:DashboardFilters,range:{start:Date;end:Date},productName?:string) {
 return summarizeSales(events).orders.filter(e=>{
  const at=new Date(e.occurred_at).getTime();
  return at>=range.start.getTime()&&at<=range.end.getTime()&&(f.product==='all'||e.product_name===productName)&&(f.campaign==='all'||e.utm['campaign_id']===f.campaign||e.utm['utm_campaign']===f.campaign)&&(f.source==='all'||e.utm['utm_source']===f.source);
 });
}
export function paymentTotals(events:GatewayEvent[],targetCurrency:string,rate:number) {
 const orders=summarizeSales(events).orders;
 const supported=orders.filter(o=>['BRL','USD'].includes(o.currency));
 const amount=(e:GatewayEvent)=>e.currency===targetCurrency?Number(e.amount):e.currency==='USD'?Number(e.amount)*rate:Number(e.amount)/rate;
 const approved=supported.filter(o=>o.status==='approved');
 const revenue=approved.reduce((s,o)=>s+amount(o),0);
 return {revenue,sales:approved.length,pending:supported.filter(o=>o.status==='pending').length,refunds:supported.filter(o=>o.status==='refunded'||o.status==='chargeback').length,refused:supported.filter(o=>o.status==='refused').length,orders:supported.length,avgTicket:approved.length?revenue/approved.length:0,excluded:orders.length-supported.length};
}

/** Estimated profit = approved gateway revenue − ad spend − registered product costs. Null when any sold product has no cost. */
export function estimatedProfit(p:{revenue:number;spend:number;approved:{product_name:string|null}[];products:{name:string;cost:number;currency:'BRL'|'USD'}[];target:string;rate:number}){
 let cost=0;
 for(const o of p.approved){const prod=p.products.find(x=>x.name===o.product_name);if(!prod||!(prod.cost>=0)||prod.cost===undefined)return null;cost+=prod.currency===p.target?prod.cost:prod.currency==='USD'?prod.cost*p.rate:prod.cost/p.rate;}
 return p.revenue-p.spend-cost;
}
