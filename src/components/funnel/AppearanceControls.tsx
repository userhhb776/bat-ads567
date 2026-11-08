import { COLORS, ICON_NAMES, getIcon } from "@/lib/funnel/catalog";
import { Button } from "@/components/ui/button";

export function AppearanceControls({ color, iconName, onColor, onIcon }: { color: string; iconName: string; onColor: (v: string) => void; onIcon: (v: string) => void }) {
  return <div className="space-y-3">
    <fieldset><legend className="mb-2 text-xs text-muted-foreground">Cor de identificação</legend><div className="flex flex-wrap gap-1.5">{COLORS.map((c) => <Button key={c} type="button" variant="ghost" size="icon" aria-label={`Cor ${c}`} aria-pressed={color === c} title={c} onClick={() => onColor(c)} data-color={c} className={`element-accent h-7 w-7 rounded-full border-2 ${color === c ? "border-foreground" : "border-transparent"}`}><span className="color-swatch h-4 w-4 rounded-full" /></Button>)}</div></fieldset>
    <label className="block"><span className="mb-1 block text-xs text-muted-foreground">Ícone</span><select aria-label="Ícone" value={iconName} onChange={(e) => onIcon(e.target.value)} className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm">{Array.from(new Set([...ICON_NAMES, iconName])).map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
    <div className="flex flex-wrap gap-1">{ICON_NAMES.slice(0, 16).map((name) => { const Icon = getIcon(name); return <Button key={name} type="button" size="icon" variant={iconName === name ? "secondary" : "ghost"} className="h-7 w-7" title={name} aria-label={`Ícone ${name}`} onClick={() => onIcon(name)}><Icon /></Button>; })}</div>
  </div>;
}
