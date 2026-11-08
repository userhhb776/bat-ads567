import type { FunnelEdge, FunnelNode } from "./types";

const e = (id: string, source: string, target: string, share = 100): FunnelEdge => ({ id, source, target, type: "conversion", data: { share } });

export const TEMPLATE_NODES: FunnelNode[] = [
  { id: "meta", type: "step", position: { x: 0, y: 40 }, data: { kind: "meta-ads", label: "Campanha de anúncios", budget: 3000, cpc: 1.5, conversionRate: 100 } },
  { id: "google", type: "step", position: { x: 0, y: 280 }, data: { kind: "google-ads", label: "Google Search", budget: 2000, cpc: 2.2, conversionRate: 100 } },
  { id: "lp", type: "step", position: { x: 320, y: 160 }, data: { kind: "landing", label: "Página de captura", conversionRate: 35 } },
  { id: "vsl", type: "step", position: { x: 640, y: 160 }, data: { kind: "vsl", label: "VSL principal", conversionRate: 22 } },
  { id: "checkout", type: "step", position: { x: 960, y: 60 }, data: { kind: "checkout", label: "Checkout", conversionRate: 40, price: 197 } },
  { id: "wpp", type: "step", position: { x: 960, y: 300 }, data: { kind: "whatsapp", label: "Recuperação WhatsApp", conversionRate: 15 } },
  { id: "upsell", type: "step", position: { x: 1280, y: 60 }, data: { kind: "upsell", label: "Upsell 1-click", conversionRate: 25, price: 97 } },
];

export const TEMPLATE_EDGES: FunnelEdge[] = [
  e("e1", "meta", "lp"),
  e("e2", "google", "lp"),
  e("e3", "lp", "vsl", 60),
  e("e4", "vsl", "checkout"),
  e("e5", "lp", "wpp", 40),
  e("e6", "wpp", "checkout"),
  e("e7", "checkout", "upsell"),
];
