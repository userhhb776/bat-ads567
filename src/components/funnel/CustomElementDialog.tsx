import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createCustomItem, type CatalogItem, type PropertyField } from "@/lib/funnel/catalog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AppearanceControls } from "./AppearanceControls";

export function CustomElementDialog({ open, onOpenChange, onCreate }: { open: boolean; onOpenChange: (v: boolean) => void; onCreate: (item: CatalogItem) => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("custom");
  const [icon, setIcon] = useState("Star");
  const [fields, setFields] = useState<PropertyField[]>([]);
  const inputClass = "w-full min-w-0 rounded-md border border-input bg-background p-2 text-sm";
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90dvh] w-[calc(100%-24px)] overflow-y-auto rounded-lg"><DialogHeader><DialogTitle>Novo elemento personalizado</DialogTitle><DialogDescription>Biblioteca pessoal</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; onCreate(createCustomItem(name.trim(), icon, color, fields.filter((f) => f.label.trim()))); setName(""); setFields([]); onOpenChange(false); }}>
    <label className="block text-xs text-muted-foreground">Nome<input autoFocus required aria-label="Nome do elemento" value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} mt-1 text-foreground`} /></label>
    <AppearanceControls color={color} iconName={icon} onColor={setColor} onIcon={setIcon} />
    <div className="flex items-center justify-between"><span className="text-sm">Propriedades</span><Button type="button" variant="outline" size="sm" onClick={() => setFields((f) => [...f, { key: crypto.randomUUID(), label: "", type: "text" }])}><Plus /> Propriedade</Button></div>
    {fields.map((f, i) => <div key={f.key} className="flex gap-2"><input required aria-label={`Propriedade ${i + 1}`} placeholder="Nome da propriedade" value={f.label} onChange={(e) => setFields((fs) => fs.map((v) => v.key === f.key ? { ...v, label: e.target.value } : v))} className={inputClass} /><select aria-label={`Tipo da propriedade ${i + 1}`} className="rounded-md border border-input bg-background text-xs" value={f.type} onChange={(e) => setFields((fs) => fs.map((v) => v.key === f.key ? { ...v, type: e.target.value as "text" | "number" | "textarea" } : v))}><option value="text">Texto</option><option value="number">Número</option><option value="textarea">Texto longo</option></select><Button type="button" variant="ghost" size="icon" aria-label={`Excluir propriedade ${i + 1}`} onClick={() => setFields((fs) => fs.filter((v) => v.key !== f.key))}><Trash2 /></Button></div>)}
    <Button type="submit" className="w-full"><Plus /> Criar elemento</Button>
  </form></DialogContent></Dialog>;
}
