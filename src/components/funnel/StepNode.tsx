import { Handle, Position, type NodeProps } from "@xyflow/react";
import { resolveItem } from "@/lib/funnel/catalog";
import { fmtBRL, fmtInt } from "@/lib/funnel/simulate";
import type { FunnelNode } from "@/lib/funnel/types";
import { useSim } from "./sim-context";
import { cn } from "@/lib/utils";

export function StepNode({ id, data, selected }: NodeProps<FunnelNode>) {
  const item = resolveItem(data);
  const Icon = item.icon;
  const { result } = useSim();
  const m = result.nodes[id];
  const content = String(data.properties?.['content'] ?? "");
  const width = item.visual ? Math.max(140, Math.min(600, Number(data.properties?.['width']) || 224)) : 224;
  const height = item.visual ? Math.max(80, Math.min(600, Number(data.properties?.['height']) || 100)) : undefined;
  return <div data-color={item.color} data-shape={item.shape} className={cn("element-accent funnel-node relative text-card-foreground", selected && "node-selected")} style={{ width, minHeight: height }}>
    <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-background !bg-muted-foreground" />
    {item.shape === "circle" || item.shape === "diamond" ? <div className="flex flex-col items-center gap-2 px-3 py-3"><div className="max-w-full break-words text-center text-sm font-semibold">{data.label}</div><div className={cn("element-icon grid h-16 w-16 place-items-center", item.shape === "diamond" ? "rotate-45 rounded-lg" : "rounded-full")}><Icon className={cn("h-8 w-8", item.shape === "diamond" && "-rotate-45")} /></div><div className="font-mono text-xs">{fmtInt(m?.visitors ?? 0)} <span className="text-muted-foreground">· {data.conversionRate}%</span></div>{item.isSource && item.paid && <div className="font-mono text-[10px] text-muted-foreground">{fmtBRL(m?.cost ?? 0)}</div>}</div> : <div className="overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-node)]">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2"><span className="element-icon grid h-8 w-8 shrink-0 place-items-center rounded-md"><Icon className="h-4 w-4" /></span><div className="min-w-0"><div className="text-[9px] text-muted-foreground">{item.label}</div><div className="break-words text-sm font-semibold">{data.label}</div></div></div>
      {item.shape === "page" && <div className="page-preview mx-3 mt-3 overflow-hidden rounded border border-border"><div className="flex h-4 items-center gap-1 border-b border-border bg-secondary px-1.5"><i /><i /><i /><span className="ml-1 h-1 flex-1 rounded bg-muted-foreground/30" /></div><div className="space-y-2 p-2"><div className="flex h-10 items-center justify-center border border-border bg-background"><Icon className="h-6 w-6 text-muted-foreground" /></div><div className="mx-auto h-1.5 w-4/5 rounded bg-muted-foreground/30" /><div className="mx-auto h-1 w-3/5 rounded bg-muted-foreground/20" /><div className="element-icon rounded-sm py-1 text-center text-[8px] font-semibold">{String(data.properties?.['cta'] || "CONTINUAR")}</div></div></div>}
      {item.visual ? <div className="whitespace-pre-wrap break-words px-3 py-3 text-sm text-muted-foreground">{content || item.label}{data.properties?.['url'] && <div className="mt-2 break-all text-xs text-primary">{String(data.properties['url'])}</div>}</div> : <div className="grid grid-cols-2 gap-x-3 gap-y-1 px-3 py-2 font-mono text-xs"><span className="text-muted-foreground">Visitas</span><span className="text-right">{fmtInt(m?.visitors ?? 0)}</span><span className="text-muted-foreground">Conv.</span><span className="element-ink text-right">{data.conversionRate}%</span>{item.sellable && <><span className="text-muted-foreground">Receita</span><span className="text-right text-step-sale">{fmtBRL(m?.revenue ?? 0)}</span></>}</div>}
    </div>}
    <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-background !bg-primary" />
  </div>;
}
