import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import {
  ReactFlow, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState,
  Handle, Position, type Connection, type Edge, type Node, type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Megaphone, FileText, PlayCircle, ShoppingCart, ArrowUpCircle, ArrowDownCircle, CheckCircle2, MessageCircle, Mail, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/funis")({
  head: () => ({
    meta: [
      { title: "Funis — Bat Gotham" },
      { name: "description", content: "Monte e simule funis de anúncio, página, VSL, checkout e WhatsApp." },
      { property: "og:title", content: "Funis — Bat Gotham" },
      { property: "og:description", content: "Monte e simule funis de vendas visualmente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FunisPage,
});

const BLOCKS = {
  anuncio: { label: "Anúncio", icon: Megaphone },
  pagina: { label: "Página de vendas", icon: FileText },
  vsl: { label: "VSL", icon: PlayCircle },
  checkout: { label: "Checkout", icon: ShoppingCart },
  upsell: { label: "Upsell", icon: ArrowUpCircle },
  downsell: { label: "Downsell", icon: ArrowDownCircle },
  obrigado: { label: "Obrigado", icon: CheckCircle2 },
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  email: { label: "E-mail", icon: Mail },
} as const;
type Kind = keyof typeof BLOCKS;
type StepData = { kind: Kind; title: string; rate: number; visits?: number };

function StepNode({ data, selected }: NodeProps<Node<StepData>>) {
  const B = BLOCKS[data.kind];
  return (
    <div className={`w-44 rounded-lg border bg-card p-3 text-card-foreground shadow ${selected ? "border-primary" : "border-border"}`}>
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2 text-sm font-semibold"><B.icon className="h-4 w-4 text-primary" />{data.title}</div>
      <div className="mt-1 text-xs text-muted-foreground">Conversão {data.rate}%</div>
      {data.visits != null && <div className="mt-1 text-xs text-primary">{Math.round(data.visits).toLocaleString("pt-BR")} pessoas</div>}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const nodeTypes = { step: StepNode };

const START: Node<StepData>[] = [
  { id: "1", type: "step", position: { x: 0, y: 80 }, data: { kind: "anuncio", title: "Anúncio", rate: 2 } },
  { id: "2", type: "step", position: { x: 240, y: 80 }, data: { kind: "pagina", title: "Página de vendas", rate: 10 } },
  { id: "3", type: "step", position: { x: 480, y: 80 }, data: { kind: "checkout", title: "Checkout", rate: 40 } },
  { id: "4", type: "step", position: { x: 720, y: 80 }, data: { kind: "obrigado", title: "Obrigado", rate: 100 } },
];
const START_E: Edge[] = [{ id: "e1", source: "1", target: "2" }, { id: "e2", source: "2", target: "3" }, { id: "e3", source: "3", target: "4" }];

function FunisPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<StepData>>(START);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(START_E);
  const [sel, setSel] = useState<string | null>(null);
  const [traffic, setTraffic] = useState(10000);
  const [ticket, setTicket] = useState(97);

  useEffect(() => {
    const s = localStorage.getItem("batgotham.funnel");
    if (s) { const j = JSON.parse(s); setNodes(j.nodes); setEdges(j.edges); }
  }, [setNodes, setEdges]);

  const onConnect = useCallback((c: Connection) => setEdges((e) => addEdge({ ...c, animated: true }, e)), [setEdges]);
  const add = (kind: Kind) =>
    setNodes((n) => [...n, { id: crypto.randomUUID(), type: "step", position: { x: 100 + n.length * 30, y: 260 }, data: { kind, title: BLOCKS[kind].label, rate: 20 } }]);

  const simulate = () => {
    const incoming = new Set(edges.map((e) => e.target));
    const visits: Record<string, number> = {};
    const queue = nodes.filter((n) => !incoming.has(n.id)).map((n) => { visits[n.id] = traffic; return n.id; });
    while (queue.length) {
      const id = queue.shift()!;
      const n = nodes.find((x) => x.id === id)!;
      for (const e of edges.filter((x) => x.source === id)) {
        visits[e.target] = (visits[e.target] ?? 0) + (visits[id] ?? 0) * (n.data.rate / 100);
        queue.push(e.target);
      }
    }
    setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, visits: visits[n.id] ?? 0 } })));
    const sales = nodes.filter((n) => n.data.kind === "obrigado").reduce((s, n) => s + (visits[n.id] ?? 0), 0);
    toast(`Simulação: ${Math.round(sales)} vendas · ${(sales * ticket).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`);
  };

  const node = nodes.find((n) => n.id === sel);
  const patch = (d: Partial<StepData>) => setNodes((ns) => ns.map((n) => (n.id === sel ? { ...n, data: { ...n.data, ...d } } : n)));

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col md:h-screen">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <h1 className="mr-auto font-display text-3xl tracking-wide">Funis</h1>
        <label className="text-xs text-muted-foreground">Tráfego <Input type="number" value={traffic} onChange={(e) => setTraffic(Number(e.target.value))} className="inline-block h-8 w-24" /></label>
        <label className="text-xs text-muted-foreground">Ticket R$ <Input type="number" value={ticket} onChange={(e) => setTicket(Number(e.target.value))} className="inline-block h-8 w-20" /></label>
        <Button size="sm" onClick={simulate}>Simular</Button>
        <Button size="sm" variant="secondary" onClick={() => { localStorage.setItem("batgotham.funnel", JSON.stringify({ nodes, edges })); toast.success("Funil salvo"); }}><Save className="h-4 w-4" /></Button>
      </div>
      <div className="flex gap-2 overflow-x-auto border-b border-border p-2">
        {(Object.keys(BLOCKS) as Kind[]).map((k) => {
          const B = BLOCKS[k];
          return <Button key={k} size="sm" variant="secondary" onClick={() => add(k)} className="shrink-0"><B.icon className="mr-1 h-4 w-4" />{B.label}</Button>;
        })}
      </div>
      <div className="relative flex-1">
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onConnect={onConnect} onNodeClick={(_, n) => setSel(n.id)} onPaneClick={() => setSel(null)} colorMode="dark" fitView>
          <Background /><Controls /><MiniMap className="hidden md:block" />
        </ReactFlow>
        {node && (
          <div className="absolute right-3 top-3 z-10 w-64 space-y-2 rounded-lg border border-border bg-card p-3">
            <Input value={node.data.title} onChange={(e) => patch({ title: e.target.value })} />
            <label className="block text-xs text-muted-foreground">Conversão para a próxima etapa (%)
              <Input type="number" value={node.data.rate} onChange={(e) => patch({ rate: Number(e.target.value) })} />
            </label>
            <Button size="sm" variant="destructive" onClick={() => { setNodes((ns) => ns.filter((n) => n.id !== sel)); setEdges((es) => es.filter((e) => e.source !== sel && e.target !== sel)); setSel(null); }}>
              <Trash2 className="mr-1 h-4 w-4" />Remover
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
