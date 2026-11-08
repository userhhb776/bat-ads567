import type { Edge, Node } from "@xyflow/react";

export type StepKind = string;

export type StepData = {
  kind: StepKind;
  label: string;
  /** Traffic sources only: ad spend for the period. */
  budget?: number;
  /** Traffic sources only: cost per click. */
  cpc?: number;
  /** % of incoming visitors that move forward (0-100). */
  conversionRate: number;
  /** Price charged per conversion (checkout/upsell). */
  price?: number;
  /** Direct traffic for unpaid sources. */
  volume?: number;
  iconName?: string;
  color?: string;
  properties?: Record<string, string | number>;
  definition?: {
    label: string;
    iconName: string;
    color: string;
    fields: { key: string; label: string; type?: "number" | "text" | "textarea"; default?: string | number }[];
  } | undefined;
};

export type EdgeData = {
  /** % of the source node's output sent along this edge (0-100). */
  share: number;
};

export type FunnelNode = Node<StepData, "step">;
export type FunnelEdge = Edge<EdgeData, "conversion">;

export type NodeMetrics = {
  visitors: number;
  conversions: number;
  revenue: number;
  cost: number;
};

export type SimulationResult = {
  nodes: Record<string, NodeMetrics>;
  edges: Record<string, number>;
  totals: { visitors: number; sales: number; revenue: number; cost: number; profit: number; roas: number };
};
