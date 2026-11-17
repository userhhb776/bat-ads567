import { ArrowDown, ArrowUp, Columns3, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { COLUMN_PRESETS, DEFAULT_COLUMNS, METRICS, metricByKey } from "@/lib/meta-metrics";

const GROUPS = [...new Set(METRICS.map((m) => m.group))];

/** Pick, order and reset the metric columns of the campaign table (saved per user). */
export function MetaColumnsDialog({ cols, setCols }: { cols: string[]; setCols: (c: string[]) => void }) {
  const toggle = (k: string) => setCols(cols.includes(k) ? cols.filter((c) => c !== k) : [...cols, k]);
  const move = (k: string, d: -1 | 1) => { const i = cols.indexOf(k), j = i + d; if (j < 0 || j >= cols.length) return; const n = [...cols]; [n[i], n[j]] = [n[j]!, n[i]!]; setCols(n); };
  return <Dialog>
    <DialogTrigger asChild><Button variant="outline"><Columns3 className="mr-2 h-4 w-4" />Colunas</Button></DialogTrigger>
    <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
      <DialogHeader><DialogTitle>Personalizar colunas</DialogTitle></DialogHeader>
      <div className="flex flex-wrap gap-2">{COLUMN_PRESETS.map((p) => <Button key={p.label} size="sm" variant="secondary" onClick={() => setCols(p.cols)}>{p.label}</Button>)}<Button size="sm" variant="ghost" onClick={() => setCols(DEFAULT_COLUMNS)}>Padrão</Button></div>
      <div className="grid gap-5 md:grid-cols-[1fr_16rem]">
        <div className="grid gap-4 sm:grid-cols-2">{GROUPS.map((g) => <div key={g}><p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{g}</p>
          {METRICS.filter((m) => m.group === g).map((m) => <label key={m.key} className="flex cursor-pointer items-center gap-2 py-1 text-sm"><Checkbox checked={cols.includes(m.key)} onCheckedChange={() => toggle(m.key)} />{m.label}</label>)}
        </div>)}</div>
        <div><p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Ordem ({cols.length})</p>
          <div className="space-y-1">{cols.map((k, i) => <div key={k} className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-sm">
            <span className="min-w-0 flex-1 truncate">{metricByKey(k)?.label ?? k}</span>
            <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => move(k, -1)} className="p-1 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
            <button type="button" aria-label="Descer" disabled={i === cols.length - 1} onClick={() => move(k, 1)} className="p-1 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
            <button type="button" aria-label="Remover" onClick={() => toggle(k)} className="p-1"><X className="h-3.5 w-3.5" /></button>
          </div>)}</div>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}
