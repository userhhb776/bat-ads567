import { Copy, Plus, Trash2, X, SlidersHorizontal } from "lucide-react";
import { resolveItem, type PropertyField } from "@/lib/funnel/catalog";
import { fmtBRL, fmtInt } from "@/lib/funnel/simulate";
import type { EdgeData, FunnelEdge, FunnelNode, StepData } from "@/lib/funnel/types";
import { useSim } from "./sim-context";
import { Button } from "@/components/ui/button";
import { AppearanceControls } from "./AppearanceControls";
import { readStore } from "@/lib/store";

type Props = { node?: FunnelNode | undefined; edge?: FunnelEdge | undefined; onNodeChange: (id: string, patch: Partial<StepData>) => void; onEdgeChange: (id: string, patch: Partial<EdgeData>) => void; onDelete: () => void; onDuplicate: () => void; onClose: () => void };
const inputClass = "w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm outline-none focus:border-primary";
function Field({ label, value, onChange, suffix, step = 1 }: { label: string; value: number; onChange: (v: number) => void; suffix?: string; step?: number }) {
  return <label className="block"><span className="mb-1 block text-xs text-muted-foreground">{label}</span><div className="flex items-center rounded-md border border-input bg-background focus-within:border-primary"><input aria-label={label} type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full bg-transparent px-2.5 py-2 font-mono text-sm outline-none" />{suffix && <span className="pr-2.5 font-mono text-xs text-muted-foreground">{suffix}</span>}</div></label>;
}
function PropertyEditor({ field, value, onChange }: { field: PropertyField; value: string | number; onChange: (value: string | number) => void }) {
  if (field.type === "number") return <Field label={field.label} value={Number(value) || 0} onChange={onChange} />;
  return <label className="block"><span className="mb-1 block text-xs text-muted-foreground">{field.label}</span>{field.type === "textarea" ? <textarea aria-label={field.label} rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} resize-y`} /> : <input aria-label={field.label} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />}</label>;
}
/** Links a funnel step to a real Bat Gotham resource (page, product/offer, automation or ad campaign). */
function LinkedResource({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [kind = "", id = ""] = value.split(":");
  const options: Record<string, { id: string; name: string }[]> = {
    pagina: (JSON.parse((typeof localStorage !== "undefined" && localStorage.getItem("bat-gotham-pages")) || "[]") as { id: string; name?: string; title?: string }[]).map((p) => ({ id: p.id, name: p.name ?? p.title ?? p.id })),
    produto: readStore<{ id: string; name: string; offers?: { id: string; name: string }[] }[]>("products", []).flatMap((p) => [{ id: p.id, name: p.name }, ...(p.offers ?? []).map((o) => ({ id: `${p.id}/${o.id}`, name: `${p.name} › ${o.name}` }))]),
    automacao: readStore<{ id: string; name: string }[]>("automations", []).map((a) => ({ id: a.id, name: a.name })),
  };
  return <div className="space-y-2 border-t border-border pt-3"><h3 className="text-[10px] font-semibold uppercase text-muted-foreground">Recurso vinculado</h3>
    <select aria-label="Tipo de recurso" value={kind} onChange={(e) => onChange(e.target.value ? `${e.target.value}:` : "")} className={inputClass}><option value="">Nenhum</option><option value="pagina">Página</option><option value="produto">Produto / oferta (checkout)</option><option value="automacao">Automação (WhatsApp/e-mail)</option><option value="campanha">Campanha de anúncios</option></select>
    {kind === "campanha" ? <input aria-label="ID da campanha" placeholder="ID da campanha" value={id} onChange={(e) => onChange(`campanha:${e.target.value.replace(/\D/g, "")}`)} className={inputClass} />
      : kind && <select aria-label="Recurso" value={id} onChange={(e) => onChange(`${kind}:${e.target.value}`)} className={inputClass}><option value="">Escolha</option>{(options[kind] ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>}
    {kind && !id && <p className="text-[11px] text-muted-foreground">Escolha o item para conectar esta etapa.</p>}
  </div>;
}
export function PropertiesPanel({ node, edge, onNodeChange, onEdgeChange, onDelete, onDuplicate, onClose }: Props) {
  const { result } = useSim();
  return <aside aria-label="Propriedades do elemento" className="flex h-full w-[288px] max-w-[calc(100vw-48px)] shrink-0 flex-col border-l border-border bg-sidebar"><div className="flex items-center gap-2 border-b border-border px-4 py-3"><SlidersHorizontal className="h-4 w-4 text-primary" /><h2 className="flex-1 text-sm font-semibold">Propriedades</h2><Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Fechar propriedades" onClick={onClose}><X /></Button></div><div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
    {!node && !edge && <div className="py-8 text-center text-xs text-muted-foreground">Nenhum elemento selecionado</div>}
    {node && (() => {
      const item = resolveItem(node.data), d = node.data, m = result.nodes[node.id];
      const set = (patch: Partial<StepData>) => onNodeChange(node.id, patch);
      const setProp = (key: string, value: string | number) => set({ properties: { ...d.properties, [key]: value } });
      return <><div data-color={item.color} className="element-accent flex items-center gap-2"><span className="element-icon grid h-9 w-9 place-items-center rounded-full"><item.icon className="h-5 w-5" /></span><span className="min-w-0 flex-1 text-xs text-muted-foreground">{item.label}</span><Button variant="ghost" size="icon" title="Duplicar elemento" aria-label="Duplicar elemento" onClick={onDuplicate}><Copy /></Button><Button variant="ghost" size="icon" title="Excluir elemento" aria-label="Excluir elemento" className="text-destructive" onClick={onDelete}><Trash2 /></Button></div>
      <label className="block"><span className="mb-1 block text-xs text-muted-foreground">Nome</span><input aria-label="Nome" value={d.label} onChange={(e) => set({ label: e.target.value })} className={inputClass} /></label>
      <details className="border-y border-border py-2"><summary className="cursor-pointer text-xs font-semibold">Aparência</summary><div className="pt-3"><AppearanceControls color={item.color} iconName={d.iconName ?? d.definition?.iconName ?? item.iconName} onColor={(color) => set({ color })} onIcon={(iconName) => set({ iconName })} /></div></details>
      {!item.visual && <><h3 className="text-[10px] font-semibold uppercase text-muted-foreground">Métricas</h3>{item.isSource && (item.paid ? <><Field label="Orçamento" suffix="R$" value={d.budget ?? 0} onChange={(v) => set({ budget: Math.max(0, v) })} /><Field label="CPC (custo por clique)" suffix="R$" step={0.1} value={d.cpc ?? 0} onChange={(v) => set({ cpc: Math.max(0, v) })} /></> : <Field label="Volume de visitas" value={d.volume ?? 0} onChange={(v) => set({ volume: Math.max(0, v) })} />)}<Field label="Taxa de conversão" suffix="%" value={d.conversionRate} onChange={(v) => set({ conversionRate: Math.max(0, Math.min(100, v)) })} />{item.sellable && <Field label="Preço" suffix="R$" value={d.price ?? 0} onChange={(v) => set({ price: Math.max(0, v) })} />}</>}
      <h3 className="text-[10px] font-semibold uppercase text-muted-foreground">{item.visual ? "Conteúdo" : "Configuração"}</h3>
      {item.fields.map((field) => <PropertyEditor key={field.key} field={field} value={d.properties?.[field.key] ?? field.default ?? ""} onChange={(v) => setProp(field.key, v)} />)}
      <LinkedResource value={String(d.properties?.["_link"] ?? "")} onChange={(v) => setProp("_link", v)} />
      {d.definition && <Button size="sm" variant="outline" className="w-full" onClick={() => set({ definition: { ...d.definition, label: d.definition?.label ?? d.label, iconName: d.definition?.iconName ?? item.iconName, color: d.definition?.color ?? item.color, fields: [...item.fields, { key: crypto.randomUUID(), label: "Nova propriedade", type: "text" }] } })}><Plus /> Propriedade personalizada</Button>}
      {d.definition && item.fields.map((field) => <label key={`name-${field.key}`} className="block text-xs text-muted-foreground">Nome: {field.label}<input aria-label={`Renomear propriedade ${field.label}`} value={field.label} onChange={(e) => { if (!d.definition) return; set({ definition: { ...d.definition, fields: item.fields.map((f) => f.key === field.key ? { ...f, label: e.target.value } : f) } }); }} className={`${inputClass} mt-1`} /></label>)}
      {!item.visual && <dl className="space-y-2 border-t border-border pt-3 font-mono text-xs"><div className="flex justify-between"><dt className="text-muted-foreground">Entradas</dt><dd>{fmtInt(m?.visitors ?? 0)}</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">Saídas</dt><dd>{fmtInt(m?.conversions ?? 0)}</dd></div>{item.sellable && <div className="flex justify-between"><dt className="text-muted-foreground">Receita</dt><dd>{fmtBRL(m?.revenue ?? 0)}</dd></div>}</dl>}
      </>;
    })()}
    {edge && <><h3 className="text-xs font-semibold text-primary">Conexão direcional</h3><Field label="% da saída enviada por aqui" suffix="%" value={edge.data?.share ?? 100} onChange={(v) => onEdgeChange(edge.id, { share: Math.max(0, Math.min(100, v)) })} /><div className="flex justify-between font-mono text-xs"><span className="text-muted-foreground">Volume</span>{fmtInt(result.edges[edge.id] ?? 0)}</div><Button variant="outline" className="w-full text-destructive" onClick={onDelete}><Trash2 /> Excluir conexão</Button></>}
  </div></aside>;
}
