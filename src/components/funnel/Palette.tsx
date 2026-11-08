import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Layers, Plus, Search, X } from "lucide-react";
import { CATALOG, CATEGORIES, searchCatalog, type CatalogItem } from "@/lib/funnel/catalog";
import type { StepKind } from "@/lib/funnel/types";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CustomElementDialog } from "./CustomElementDialog";

export const DND_TYPE = "application/funnel-step";
export function Palette({ onAdd, pending, customs, onCreate, onClose }: { onAdd: (kind: StepKind) => void; pending?: string | undefined; customs: CatalogItem[]; onCreate: (item: CatalogItem) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [closed, setClosed] = useState<Set<string>>(new Set(CATEGORIES.slice(1).map((g) => g.id)));
  const [customOpen, setCustomOpen] = useState(false);
  const items = useMemo(() => searchCatalog(query, [...CATALOG, ...customs]), [query, customs]);
  return <aside aria-label="Biblioteca de elementos" className="flex h-full w-[300px] max-w-[calc(100vw-48px)] shrink-0 flex-col border-r border-border bg-sidebar">
    <div className="space-y-3 border-b border-border p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-semibold"><Layers className="h-4 w-4 text-primary" /> Biblioteca <span className="font-mono text-[10px] text-muted-foreground">{CATALOG.length + customs.length}</span></div><Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Fechar biblioteca" title="Fechar biblioteca" onClick={onClose}><X /></Button></div><div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><input aria-label="Pesquisar elementos" placeholder="Pesquisar elementos…" value={query} onChange={(e) => { setQuery(e.target.value); setClosed(new Set()); }} className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-8 text-xs outline-none focus:border-primary" />{query && <Button variant="ghost" size="icon" className="absolute right-1 top-1 h-7 w-7" aria-label="Limpar pesquisa" onClick={() => setQuery("")}><X /></Button>}</div></div>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
      {CATEGORIES.map((g) => { const list = items.filter((c) => c.groupId === g.id); if (!list.length) return null; const expanded = !closed.has(g.id); return <section key={g.id} className="border-b border-border/60 py-2"><Button variant="ghost" className="h-auto w-full justify-start gap-2 px-1 py-2 text-left" aria-expanded={expanded} onClick={() => setClosed((prev) => { const next = new Set(prev); if (next.has(g.id)) next.delete(g.id); else next.add(g.id); return next; })}>{expanded ? <ChevronDown className="text-muted-foreground" /> : <ChevronRight className="text-muted-foreground" />}<span className="min-w-0 flex-1 whitespace-normal text-[11px] font-semibold">{g.label}</span><span className="font-mono text-[10px] text-muted-foreground">{list.length}</span></Button>{expanded && <div className="grid grid-cols-3 gap-x-1 gap-y-2 pb-2">{list.map((c) => <Tooltip key={c.kind}><TooltipTrigger asChild><Button variant="ghost" data-color={c.color} aria-label={`${c.label} — ${g.label}`} aria-pressed={pending === c.kind} draggable onDragStart={(e) => { e.dataTransfer.setData(DND_TYPE, c.kind); e.dataTransfer.effectAllowed = "move"; }} onClick={() => onAdd(c.kind)} className={`element-accent h-[94px] w-full cursor-grab flex-col justify-start gap-1.5 whitespace-normal px-1 py-2 text-center active:cursor-grabbing ${pending === c.kind ? "bg-accent ring-1 ring-primary" : ""}`}><span className="element-icon grid h-10 w-10 shrink-0 place-items-center rounded-full"><c.icon className="!h-5 !w-5" /></span><span className="line-clamp-3 text-[10px] leading-[13px] text-foreground">{c.label}</span></Button></TooltipTrigger><TooltipContent side="right">{c.label}</TooltipContent></Tooltip>)}</div>}</section>; })}
      {!items.length && <p className="py-8 text-center text-xs text-muted-foreground">Nenhum elemento encontrado</p>}
    </div>
    <div className="border-t border-border p-3"><Button variant="outline" size="sm" className="w-full" onClick={() => setCustomOpen(true)}><Plus /> Novo elemento personalizado</Button></div>
    <CustomElementDialog open={customOpen} onOpenChange={setCustomOpen} onCreate={onCreate} />
  </aside>;
}
