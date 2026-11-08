import type { FunnelEdge, FunnelNode } from './types';

export function validateGraph(nodes: FunnelNode[], edges: FunnelEdge[]): string | null {
  const ids = new Set(nodes.map((n) => n.id));
  const outgoing = new Map<string, FunnelEdge[]>();
  for (const edge of edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) return 'Conexão com etapa inexistente.';
    const share = edge.data?.share ?? 100;
    if (!Number.isFinite(share) || share < 0 || share > 100) return 'A divisão deve ficar entre 0 e 100%.';
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]);
  }
  for (const list of outgoing.values()) {
    if (list.reduce((sum, edge) => sum + (edge.data?.share ?? 100), 0) > 100) return 'A soma das saídas não pode ultrapassar 100%.';
  }
  const visiting = new Set<string>();
  const done = new Set<string>();
  function cycle(id: string): boolean {
    if (visiting.has(id)) return true;
    if (done.has(id)) return false;
    visiting.add(id);
    if ((outgoing.get(id) ?? []).some((edge) => cycle(edge.target))) return true;
    visiting.delete(id);
    done.add(id);
    return false;
  }
  return nodes.some((node) => cycle(node.id)) ? 'Esta conexão cria um ciclo no funil.' : null;
}