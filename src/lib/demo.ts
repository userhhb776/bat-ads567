import { useEffect, useState } from 'react';
import type { GatewayEvent } from './sales';

/** Device-only flag; not in cloud-sync, so demo never touches the database or connections. */
const KEY = 'batgotham.demo-mode';
const EVT = 'bg-demo-change';
export const isDemo = () => typeof window !== 'undefined' && localStorage.getItem(KEY) === '1';
export function setDemo(on: boolean) { if (on) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); window.dispatchEvent(new Event(EVT)); }
export function useDemo() {
  const [on, setOn] = useState(false);
  useEffect(() => { const u = () => setOn(isDemo()); u(); window.addEventListener(EVT, u); return () => window.removeEventListener(EVT, u); }, []);
  return on;
}

const day = (d: Date) => d.toISOString().slice(0, 10);
let seed = 7; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

export const demoProducts = [
  { id: 'demo-p1', name: 'Método Gotham', price: 197, cost: 20, campaignIds: 'demo-c1,demo-c2' },
  { id: 'demo-p2', name: 'Mentoria Wayne', price: 497, cost: 60, campaignIds: 'demo-c3' },
  { id: 'demo-p3', name: 'Ebook Cavaleiro', price: 47, cost: 3, campaignIds: 'demo-c4,demo-c5' },
];
const names = ['[VENDAS] Método Gotham · CBO', '[TESTE] Método Gotham · Criativos', '[ESCALA] Mentoria Wayne', '[LEADS] Ebook Cavaleiro', '[REMARKETING] Ebook Cavaleiro'];
export function demoCampaigns() {
  seed = 7;
  return names.map((name, i) => {
    const spend = 300 + rnd() * 2200; const roas = 0.8 + rnd() * 3; const imp = Math.round(spend * (40 + rnd() * 30));
    const clicks = Math.round(imp * (0.012 + rnd() * 0.02)); const sales = Math.round(spend * roas / 197);
    return { id: `demo-c${i + 1}`, name, status: i === 1 ? 'PAUSED' : 'ACTIVE', insights: {
      spend: spend.toFixed(2), impressions: String(imp), reach: String(Math.round(imp / 1.7)), clicks: String(clicks), inline_link_clicks: String(Math.round(clicks * 0.7)),
      actions: [{ action_type: 'purchase', value: String(sales) }, { action_type: 'lead', value: String(Math.round(clicks * 0.15)) }],
      action_values: [{ action_type: 'purchase', value: (spend * roas).toFixed(2) }],
    } };
  });
}
export function demoDaily(days = 14) {
  seed = 11; const out = []; const now = Date.now();
  for (let i = days - 1; i >= 0; i--) { const s = 250 + rnd() * 450; out.push({ date_start: day(new Date(now - i * 864e5)), spend: s.toFixed(2), action_values: [{ action_type: 'purchase', value: (s * (1.4 + rnd() * 1.8)).toFixed(2) }] }); }
  return out;
}
export function demoEvents(): GatewayEvent[] {
  seed = 23; const out: GatewayEvent[] = []; const now = Date.now();
  for (let i = 0; i < 90; i++) {
    const p = demoProducts[Math.floor(rnd() * 3)]!; const r = rnd();
    const status = r < 0.75 ? 'approved' : r < 0.88 ? 'pending' : r < 0.95 ? 'refused' : 'refunded';
    out.push({ id: `demo-e${i}`, platform: 'demo', external_id: `d${i}`, status, amount: p.price, currency: 'BRL', product_name: p.name, customer_email: null, customer_phone: null,
      utm: { utm_source: rnd() < 0.6 ? 'facebook' : 'instagram', utm_campaign: `demo-c${1 + Math.floor(rnd() * 5)}` }, occurred_at: new Date(now - rnd() * 13 * 864e5 - (i === 0 ? 0 : 0)).toISOString() });
  }
  // a few today
  for (let i = 0; i < 8; i++) out.push({ ...out[i]!, id: `demo-t${i}`, external_id: `t${i}`, status: 'approved', occurred_at: new Date(now - i * 36e5).toISOString() });
  return out;
}
export const demoRules = [{ id: 'demo-r1', name: 'Agente Escala', active: true }, { id: 'demo-r2', name: 'Agente Teste', active: true }, { id: 'demo-r3', name: 'Guardião de CPA', active: true }];
export const demoAutos = [{ name: 'Recuperar PIX', active: true }, { name: 'Boas-vindas WhatsApp', active: true }, { name: 'Carrinho abandonado', active: true }, { name: 'Upsell 24h', active: false }];
export const demoLogs = [
  { id: 'dl1', created_at: new Date().toISOString(), campaign_name: '[TESTE] Método Gotham · Criativos', action: 'pause', state: 'pausada', detail: 'Gastou R$ 80 sem vendas — pausada pelo Agente Teste.' },
  { id: 'dl2', created_at: new Date().toISOString(), campaign_name: '[ESCALA] Mentoria Wayne', action: 'scale', state: 'escalada', detail: 'ROAS 3,2x por 3 dias — orçamento +20%.' },
  { id: 'dl3', created_at: new Date().toISOString(), campaign_name: '[VENDAS] Método Gotham · CBO', action: 'watch', state: 'ok', detail: 'CPA dentro da meta.' },
];
export const demoBrief = '**Briefing de demonstração**\n\n- A Mentoria Wayne está escalando bem (ROAS acima de 3x).\n- Pausei o teste de criativos que gastou sem vender.\n- Atenção: 6 PIX pendentes para recuperar hoje.';
