import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, MiniMap, MarkerType, addEdge, useEdgesState, useNodesState, useReactFlow, type Connection, type NodeTypes, type EdgeTypes } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Save, FolderOpen, Trash2, Activity, FilePlus2, Layers, RotateCcw, SlidersHorizontal, Workflow, X } from "lucide-react";
import { CATALOG, catalogByKind, getIcon, resolveItem, type CatalogItem } from "@/lib/funnel/catalog";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
type SavedFunnel = { id: string; name: string; nodes: FunnelNode[]; edges: FunnelEdge[]; updatedAt: number };
import { validateGraph } from "@/lib/funnel/validate";
import { simulate } from "@/lib/funnel/simulate";
import { TEMPLATE_EDGES, TEMPLATE_NODES } from "@/lib/funnel/template";
import type { EdgeData, FunnelEdge, FunnelNode, StepData, StepKind } from "@/lib/funnel/types";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StepNode } from "./StepNode";
import { ConversionEdge } from "./ConversionEdge";
import { Palette, DND_TYPE } from "./Palette";
import { PropertiesPanel } from "./PropertiesPanel";
import { SimulationBar } from "./SimulationBar";
import { SimContext } from "./sim-context";

const nodeTypes: NodeTypes = { step: StepNode };
const edgeTypes: EdgeTypes = { conversion: ConversionEdge };
const STORAGE_KEY = "batgotham.funnel:v2";
const arrow = { type: MarkerType.ArrowClosed, color: "var(--edge)" };
function Builder() {
  const [nodes, setNodes, onNodesChange] = useNodesState<FunnelNode>(TEMPLATE_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FunnelEdge>(TEMPLATE_EDGES);
  const [simMode, setSimMode] = useState(false);
  const [multiplier, setMultiplier] = useState(1);
  const [days, setDays] = useState(30);
  const [loaded, setLoaded] = useState(false);
  const [customs, setCustoms] = useState<CatalogItem[]>([]);
  const [pending, setPending] = useState<string>();
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const { screenToFlowPosition } = useReactFlow();
  useEffect(() => {
    if (window.innerWidth < 768) setPaletteOpen(false);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (Array.isArray(s.nodes) && s.nodes.every((n: FunnelNode) => typeof n.id === "string" && typeof n.data?.kind === "string" && n.position && typeof n.position.x === "number" && typeof n.position.y === "number")) setNodes(s.nodes.map((n: FunnelNode) => ({ ...n, data: { ...n.data, label: n.data.label ?? catalogByKind(n.data.kind).label, conversionRate: Number.isFinite(n.data.conversionRate) ? n.data.conversionRate : 100 } })));
        if (Array.isArray(s.edges) && Array.isArray(s.nodes) && !validateGraph(s.nodes, s.edges)) setEdges(s.edges);
        if (Array.isArray(s.customs)) setCustoms(s.customs.filter((c: CatalogItem) => typeof c.kind === "string" && Array.isArray(c.fields)).map((c: CatalogItem) => ({ ...c, icon: getIcon(c.iconName) })));
      }
    } catch { /* preserve the template for invalid browser drafts */ }
    setLoaded(true);
  }, [setNodes, setEdges]);
  useEffect(() => { if (loaded) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges, customs: customs.map(({ icon: _icon, ...item }) => item) })); } catch { /* browser storage unavailable */ } } }, [nodes, edges, customs, loaded]);
  useEffect(() => { const cancel = (e: KeyboardEvent) => { if (e.key === "Escape") setPending(undefined); }; window.addEventListener("keydown", cancel); return () => window.removeEventListener("keydown", cancel); }, []);
  const result = useMemo(() => simulate(nodes, edges, simMode ? multiplier * days / 30 : 1), [nodes, edges, simMode, multiplier, days]);
  const selectedNode = nodes.find((n) => n.selected);
  const selectedEdge = selectedNode ? undefined : edges.find((e) => e.selected);
  const allItems = useMemo(() => [...CATALOG, ...customs], [customs]);
  const onConnect = useCallback((c: Connection) => setEdges((es) => {
    const used = es.filter((e) => e.source === c.source).reduce((sum, e) => sum + (e.data?.share ?? 100), 0);
    const next = addEdge({ ...c, type: "conversion", markerEnd: arrow, data: { share: Math.max(0, 100 - used) } }, es);
    const error = validateGraph(nodes, next);
    if (error) { toast.error(error); return es; }
    return next;
  }), [nodes, setEdges]);
  const addStep = useCallback((kind: StepKind, position: { x: number; y: number }) => {
    const item = allItems.find((c) => c.kind === kind);
    if (!item) return;
    const id = `${kind}-${crypto.randomUUID().slice(0, 8)}`;
    const definition = kind.startsWith("custom-") || item.groupId === "custom" ? { label: item.label, iconName: item.iconName, color: item.color, fields: item.fields } : undefined;
    setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), { id, type: "step", position, selected: true, data: { kind, label: item.label, ...item.defaults, definition, properties: Object.fromEntries(item.fields.filter((f) => f.default !== undefined).map((f) => [f.key, f.default ?? ""])) } }]);
    setEdges((es) => es.map((e) => ({ ...e, selected: false })));
    setPending(undefined); setPropertiesOpen(true);
  }, [allItems, setNodes, setEdges]);
  const onDrop = (e: DragEvent) => { e.preventDefault(); const kind = e.dataTransfer.getData(DND_TYPE); if (allItems.some((c) => c.kind === kind)) addStep(kind, screenToFlowPosition({ x: e.clientX, y: e.clientY })); };
  const updateNode = (id: string, patch: Partial<StepData>) => setNodes((ns) => ns.map((n) => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n));
  const updateEdge = (id: string, patch: Partial<EdgeData>) => setEdges((es) => {
    const next = es.map((e) => e.id === id ? { ...e, data: { share: 100, ...e.data, ...patch } } : e);
    const error = validateGraph(nodes, next);
    if (error) { toast.error(error); return es; }
    return next;
  });
  const deleteSelected = () => { if (selectedNode) { setNodes((ns) => ns.filter((n) => n.id !== selectedNode.id)); setEdges((es) => es.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id)); } else if (selectedEdge) setEdges((es) => es.filter((e) => e.id !== selectedEdge.id)); };
  const duplicate = () => { if (!selectedNode) return; const copy: FunnelNode = { ...selectedNode, id: `${selectedNode.data.kind}-${crypto.randomUUID().slice(0, 8)}`, selected: true, position: { x: selectedNode.position.x + 50, y: selectedNode.position.y + 50 }, data: structuredClone(selectedNode.data) }; setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), copy]); };
  const [saved, setSaved] = useStore<SavedFunnel[]>("funnels", []);
  const [currentId, setCurrentId] = useState("");
  const current = saved.find((f) => f.id === currentId);
  const saveFunnel = () => {
    const name = window.prompt("Nome do funil:", current?.name ?? "Meu funil")?.trim(); if (!name) return;
    const id = current && current.name === name ? current.id : crypto.randomUUID();
    setSaved((list) => [{ id, name, nodes, edges, updatedAt: Date.now() }, ...list.filter((f) => f.id !== id)]); setCurrentId(id); toast.success(`Funil "${name}" salvo.`);
  };
  const openFunnel = (id: string) => { const f = saved.find((x) => x.id === id); if (!f) { setCurrentId(""); return; } setNodes(f.nodes); setEdges(f.edges); setCurrentId(id); };
  const removeFunnel = () => { if (current && window.confirm(`Excluir o funil "${current.name}"?`)) { setSaved((l) => l.filter((f) => f.id !== current.id)); setCurrentId(""); } };
  const pendingItem = allItems.find((c) => c.kind === pending);
  return <TooltipProvider delayDuration={200}><SimContext.Provider value={{ result, simMode }}><div className="funnel-workspace flex h-[calc(100dvh-7.5rem)] flex-col overflow-hidden bg-background text-foreground md:h-dvh">
    <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5 md:px-5"><Workflow className="h-5 w-5 shrink-0 text-primary" /><h1 className="text-base font-bold md:text-lg">Funis</h1><label className="ml-2 flex min-w-0 items-center gap-1"><FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" /><select aria-label="Meus funis salvos" value={currentId} onChange={(e) => openFunnel(e.target.value)} className="h-8 max-w-[9rem] truncate rounded-md border border-border bg-background px-2 text-xs md:max-w-[14rem]"><option value="">{saved.length ? `Meus funis (${saved.length})` : "Nenhum salvo"}</option>{saved.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label><div className="ml-auto flex gap-1"><Button variant="ghost" size="icon" title="Salvar funil" aria-label="Salvar funil" onClick={saveFunnel}><Save /></Button>{current && <Button variant="ghost" size="icon" title="Excluir funil salvo" aria-label="Excluir funil salvo" onClick={removeFunnel}><Trash2 /></Button>}<Button variant={paletteOpen ? "secondary" : "ghost"} size="icon" title="Biblioteca" aria-label="Abrir biblioteca" aria-pressed={paletteOpen} onClick={() => { setPaletteOpen((s) => !s); if (window.innerWidth < 768) setPropertiesOpen(false); }}><Layers /></Button><Button variant={propertiesOpen ? "secondary" : "ghost"} size="icon" title="Propriedades" aria-label="Abrir propriedades" onClick={() => { setPropertiesOpen((s) => !s); if (window.innerWidth < 768) setPaletteOpen(false); }}><SlidersHorizontal /></Button><Button variant="ghost" size="icon" title="Novo funil" aria-label="Novo funil" onClick={() => { if (window.confirm("Criar um funil vazio? O rascunho atual será substituído.")) { setNodes([]); setEdges([]); setPending(undefined); } }}><FilePlus2 /></Button><Button variant="ghost" size="icon" title="Restaurar modelo" aria-label="Restaurar modelo" onClick={() => { if (window.confirm("Restaurar o modelo? As etapas atuais serão substituídas.")) { setNodes(TEMPLATE_NODES); setEdges(TEMPLATE_EDGES); setPending(undefined); } }}><RotateCcw /></Button><Button variant={simMode ? "default" : "outline"} size="sm" className="ml-1" aria-pressed={simMode} onClick={() => setSimMode((s) => !s)}><Activity /><span>Simular</span></Button></div></header>
    <div className="relative flex min-h-0 flex-1">
      {paletteOpen && <div className="absolute inset-y-0 left-0 z-20 md:relative"><Palette pending={pending} onAdd={(kind) => { setPending((p) => p === kind ? undefined : kind); if (window.innerWidth < 768) setPaletteOpen(false); }} customs={customs} onCreate={(item) => { setCustoms((c) => [...c, item]); setPending(item.kind); if (window.innerWidth < 768) setPaletteOpen(false); }} onClose={() => setPaletteOpen(false)} /></div>}
      <div aria-label="Canvas do funil" className={`relative min-w-0 flex-1 ${pending ? "placement-active" : ""}`} onDrop={onDrop} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}>
        <ReactFlow nodes={nodes} edges={edges.map((e) => ({ ...e, markerEnd: arrow }))} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} nodeTypes={nodeTypes} edgeTypes={edgeTypes} colorMode="dark" fitView fitViewOptions={{ padding: 0.15 }} minZoom={0.15} deleteKeyCode={["Backspace", "Delete"]} onPaneClick={(e) => { if (pending) addStep(pending, screenToFlowPosition({ x: e.clientX, y: e.clientY })); }} onNodeClick={() => { setPropertiesOpen(true); setPending(undefined); if (window.innerWidth < 768) setPaletteOpen(false); }} onEdgeClick={() => { setPropertiesOpen(true); if (window.innerWidth < 768) setPaletteOpen(false); }}><Background variant={BackgroundVariant.Lines} gap={32} size={0.6} color="var(--grid)" /><Controls /><MiniMap className="!hidden md:!block" pannable zoomable maskColor="color-mix(in oklab, var(--background) 70%, transparent)" nodeColor={(n) => `var(--step-${resolveItem((n as FunnelNode).data).color})`} /></ReactFlow>
        {pendingItem && <div className="absolute left-1/2 top-3 z-10 flex max-w-[90%] -translate-x-1/2 items-center gap-2 rounded-md border border-primary/40 bg-popover px-3 py-1.5 shadow-sm"><pendingItem.icon className="h-4 w-4 shrink-0 text-primary" /><span className="truncate text-xs">{pendingItem.label}</span><Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Cancelar inserção" onClick={() => setPending(undefined)}><X /></Button></div>}
      </div>
      {propertiesOpen && <div className="absolute inset-y-0 right-0 z-20 lg:relative"><PropertiesPanel node={selectedNode} edge={selectedEdge} onNodeChange={updateNode} onEdgeChange={updateEdge} onDelete={deleteSelected} onDuplicate={duplicate} onClose={() => setPropertiesOpen(false)} /></div>}
    </div><SimulationBar multiplier={multiplier} onMultiplier={setMultiplier} days={days} onDays={setDays} />
  </div></SimContext.Provider></TooltipProvider>;
}
export default function FunnelBuilder() { return <ReactFlowProvider><Builder /></ReactFlowProvider>; }
