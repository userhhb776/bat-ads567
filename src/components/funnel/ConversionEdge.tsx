import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { fmtInt } from "@/lib/funnel/simulate";
import type { FunnelEdge } from "@/lib/funnel/types";
import { useSim } from "./sim-context";

export function ConversionEdge(props: EdgeProps<FunnelEdge>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected, markerEnd } = props;
  const { result, simMode } = useSim();
  const [path, lx, ly] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const vol = result.edges[id] ?? 0;
  const max = Math.max(1, ...Object.values(result.edges));
  const width = 1.5 + (vol / max) * 5;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        {...(markerEnd ? { markerEnd } : {})}
        className={simMode ? "funnel-edge-flow" : undefined}
        style={{ stroke: selected ? "var(--primary)" : "var(--edge)", strokeWidth: width }}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-auto absolute rounded-md border border-border bg-popover px-2 py-0.5 font-mono text-[10px] text-popover-foreground"
          style={{ transform: `translate(-50%,-50%) translate(${lx}px,${ly}px)` }}
        >
          <span className="text-primary">{data?.share ?? 100}%</span> · {fmtInt(vol)}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
