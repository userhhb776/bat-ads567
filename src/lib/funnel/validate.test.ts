import { describe, expect, it } from 'vitest';
import { validateGraph } from './validate';
import type { FunnelNode, FunnelEdge } from './types';

const nodes: FunnelNode[] = ['a', 'b', 'c'].map((id) => ({ id, type: 'step', position: { x: 0, y: 0 }, data: { kind: 'landing', label: id, conversionRate: 100 } }));
const edge = (source: string, target: string, share: number): FunnelEdge => ({ id: source + target, source, target, type: 'conversion', data: { share } });
describe('Funnel traffic safety', () => {
  it('rejects cyclic connections', () => expect(validateGraph(nodes, [edge('a', 'b', 100), edge('b', 'a', 100)])).not.toBeNull());
  it('rejects traffic shares exceeding 100 percent', () => expect(validateGraph(nodes, [edge('a', 'b', 70), edge('a', 'c', 40)])).not.toBeNull());
  it('accepts a complete 60/40 split', () => expect(validateGraph(nodes, [edge('a', 'b', 60), edge('a', 'c', 40)])).toBeNull());
});