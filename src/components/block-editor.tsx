import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BLOCKS, type Block, type BlockType, type Style } from "@/lib/page-blocks";

export const DEFAULT_STYLE: Style = { bg: "#0b0b0f", fg: "#f5f5f5", accent: "#d4af37" };

export function BlockEditor({ blocks, style, onChange, onApply }: { blocks: Block[]; style: Style; onChange: (b: Block[], s: Style) => void; onApply: () => void }) {
  const set = (i: number, p: Partial<Block>) => onChange(blocks.map((b, j) => (j === i ? { ...b, ...p } : b)), style);
  const move = (i: number, d: number) => { const n = [...blocks]; const t = n[i + d]; if (!t) return; n[i + d] = n[i]!; n[i] = t; onChange(n, style); };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {(["bg", "fg", "accent"] as const).map((k) => (
          <label key={k} className="flex items-center gap-1">{k === "bg" ? "Fundo" : k === "fg" ? "Texto" : "Destaque"}
            <input type="color" value={style[k]} onChange={(e) => onChange(blocks, { ...style, [k]: e.target.value })} className="h-7 w-9 rounded border border-border bg-transparent" />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {(Object.keys(BLOCKS) as BlockType[]).map((t) => (
          <Button key={t} size="sm" variant="outline" className="h-7 text-xs" onClick={() => onChange([...blocks, { id: crypto.randomUUID(), ...BLOCKS[t].make() }], style)}><Plus className="h-3 w-3" /> {BLOCKS[t].label}</Button>
        ))}
      </div>
      {blocks.length === 0 && <p className="text-sm text-muted-foreground">Adicione blocos acima para montar a página.</p>}
      {blocks.map((b, i) => (
        <div key={b.id} className="space-y-2 rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-display text-primary">{i + 1}</span><span className="font-medium">{BLOCKS[b.type].label}</span>
            <div className="ml-auto flex">
              <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-3 w-3" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === blocks.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-3 w-3" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onChange(blocks.filter((_, j) => j !== i), style)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          </div>
          {b.type !== "rodape" && <Input value={b.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="Título" />}
          {["hero", "oferta", "cta", "rodape"].includes(b.type) && <Input value={b.text} onChange={(e) => set(i, { text: e.target.value })} placeholder="Texto" />}
          {["beneficios", "oferta", "depoimentos", "faq"].includes(b.type) && (
            <Textarea value={b.items.join("\n")} onChange={(e) => set(i, { items: e.target.value.split("\n") })} placeholder={b.type === "faq" ? "Pergunta | Resposta (uma por linha)" : "Um item por linha"} className="min-h-16 text-xs" />
          )}
          {["hero", "cta", "oferta", "video"].includes(b.type) && (
            <Input value={b.extra} onChange={(e) => set(i, { extra: e.target.value })} placeholder={b.type === "video" ? "Link de incorporação https://…" : b.type === "oferta" ? "Preço" : "Texto do botão"} />
          )}
        </div>
      ))}
      <Button onClick={onApply} disabled={!blocks.length}>Salvar como nova versão</Button>
    </div>
  );
}
