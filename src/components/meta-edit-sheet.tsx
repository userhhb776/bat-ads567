import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getObjectDetail, updateAdCreative, updateObject } from "@/lib/meta.functions";
import { readCreative } from "@/lib/meta-edit";

export type EditLevel = "campaigns" | "adsets" | "ads";
const BIDS: [string, string][] = [
  ["LOWEST_COST_WITHOUT_CAP", "Volume mais alto (sem limite)"],
  ["COST_CAP", "Meta de custo por resultado"],
  ["LOWEST_COST_WITH_BID_CAP", "Limite de lance"],
  ["LOWEST_COST_WITH_MIN_ROAS", "ROAS mínimo"],
];
const toLocal = (iso?: string) => { if (!iso) return ""; const d = new Date(iso); if (isNaN(+d)) return ""; const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : undefined);
const cents = (v: string) => { const n = Number(v.replace(",", ".")); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : undefined; };
const money = (c?: string | number) => (c ? String(Number(c) / 100) : "");

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="block space-y-1"><span className="text-xs font-medium text-muted-foreground">{label}</span>{children}{hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}</label>;
}

/** Opens a campaign, ad set or ad with its real settings and saves the changes back to the ad account. */
export function MetaEditSheet({ target, onClose, currency }: { target: { id: string; level: EditLevel } | null; onClose: () => void; currency: string }) {
  const detail = useServerFn(getObjectDetail), save = useServerFn(updateObject), saveCreative = useServerFn(updateAdCreative);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["meta-detail", target?.id], queryFn: () => detail({ data: target! }), enabled: !!target, retry: false });
  const [f, setF] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const d = q.data;
  useEffect(() => {
    if (!d) return;
    const t = d.targeting ?? {};
    const c = readCreative(d.creative?.object_story_spec);
    setF({
      name: d.name ?? "", active: d.status === "ACTIVE", daily: money(d.daily_budget), lifetime: money(d.lifetime_budget), cap: money(d.spend_cap),
      bid: d.bid_strategy ?? "", bidAmount: money(d.bid_amount), start: toLocal(d.start_time), end: toLocal(d.end_time ?? d.stop_time),
      ageMin: t.age_min ?? "", ageMax: t.age_max ?? "", gender: t.genders?.length === 1 ? String(t.genders[0]) : "all", countries: (t.geo_locations?.countries ?? []).join(", "),
      ...c, urlTags: d.creative?.url_tags ?? "", creativeKind: c.kind, creativeLocked: !!target && target.level === "ads" && !d.creative?.object_story_spec,
    });
  }, [d, target]);
  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }));

  async function submit() {
    if (!target || !d) return;
    setBusy(true);
    try {
      const p: Record<string, unknown> = { id: target.id };
      if (f.name && f.name !== d.name) p["name"] = f.name;
      const status = f.active ? "ACTIVE" : "PAUSED";
      if (status !== d.status && d.status !== "ARCHIVED") p["status"] = status;
      if (target.level !== "ads") {
        const daily = cents(f.daily), life = cents(f.lifetime);
        if (d.daily_budget && daily && daily !== Number(d.daily_budget)) { p["daily_budget"] = daily; p["before_budget"] = Number(d.daily_budget); }
        if (d.lifetime_budget && life && life !== Number(d.lifetime_budget)) p["lifetime_budget"] = life;
        if (f.bid && f.bid !== d.bid_strategy) p["bid_strategy"] = f.bid;
        if (f.end && f.end !== toLocal(d.end_time ?? d.stop_time)) p[target.level === "campaigns" ? "stop_time" : "end_time"] = fromLocal(f.end);
      }
      if (target.level === "campaigns") { const cap = cents(f.cap); if (cap && cap !== Number(d.spend_cap ?? 0)) p["spend_cap"] = cap; }
      if (target.level === "adsets") {
        const ba = cents(f.bidAmount); if (ba && ba !== Number(d.bid_amount ?? 0)) p["bid_amount"] = ba;
        if (f.start && f.start !== toLocal(d.start_time)) p["start_time"] = fromLocal(f.start);
        const t = { ...(d.targeting ?? {}) } as Record<string, any>;
        const before = JSON.stringify(t);
        if (f.ageMin) t["age_min"] = Number(f.ageMin); if (f.ageMax) t["age_max"] = Number(f.ageMax);
        if (f.gender === "all") delete t["genders"]; else t["genders"] = [Number(f.gender)];
        const countries = String(f.countries ?? "").split(/[\s,]+/).map((x: string) => x.trim().toUpperCase()).filter((x: string) => /^[A-Z]{2}$/.test(x));
        if (countries.length) t["geo_locations"] = { ...(t["geo_locations"] ?? {}), countries };
        if (JSON.stringify(t) !== before) p["targeting"] = t;
      }
      if (Object.keys(p).length > 1) await save({ data: p as never });
      if (target.level === "ads" && !f.creativeLocked) {
        const c = readCreative(d.creative?.object_story_spec);
        const changed = f.message !== c.message || f.headline !== c.headline || f.description !== c.description || f.link !== c.link || f.urlTags !== (d.creative?.url_tags ?? "");
        if (changed) await saveCreative({ data: { adId: target.id, message: f.message, headline: f.headline, description: f.description, link: f.link || undefined, url_tags: f.urlTags || undefined } });
      }
      toast.success("Salvo na conta de anúncios");
      void qc.invalidateQueries({ queryKey: ["objects"] }); void qc.invalidateQueries({ queryKey: ["meta-detail", target.id] });
      onClose();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  const title = target?.level === "campaigns" ? "Editar campanha" : target?.level === "adsets" ? "Editar conjunto" : "Editar anúncio";
  return <Sheet open={!!target} onOpenChange={(o) => { if (!o) onClose(); }}>
    <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
      <SheetHeader><SheetTitle>{title}</SheetTitle></SheetHeader>
      {q.isLoading && <p className="mt-6 text-sm text-muted-foreground">Abrindo…</p>}
      {q.error && <p className="mt-6 text-sm text-destructive">{(q.error as Error).message}</p>}
      {d && <div className="mt-5 space-y-4 pb-10">
        <Field label="Nome"><Input value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} /></Field>
        <label className="flex items-center justify-between rounded-md border border-border p-3 text-sm"><span>{f.active ? "Ativo" : "Pausado"}</span><Switch checked={!!f.active} onCheckedChange={(v) => set("active", v)} disabled={d.status === "ARCHIVED"} /></label>
        {d.status === "ARCHIVED" && <p className="text-xs text-muted-foreground">Item arquivado: dá para ver e duplicar, mas a Meta não deixa reativar.</p>}
        {target?.level === "campaigns" && <p className="text-xs text-muted-foreground">Objetivo: {String(d.objective ?? "—").replace("OUTCOME_", "")} · criada em {d.created_time ? new Date(d.created_time).toLocaleDateString("pt-BR") : "—"}</p>}
        {target?.level === "adsets" && <p className="text-xs text-muted-foreground">Campanha: {d.campaign?.name ?? "—"} · otimização: {d.optimization_goal ?? "—"}</p>}

        {target?.level !== "ads" && <>
          {d.daily_budget && <Field label={`Orçamento diário (${currency})`}><Input inputMode="decimal" value={f.daily ?? ""} onChange={(e) => set("daily", e.target.value)} /></Field>}
          {d.lifetime_budget && <Field label={`Orçamento total (${currency})`}><Input inputMode="decimal" value={f.lifetime ?? ""} onChange={(e) => set("lifetime", e.target.value)} /></Field>}
          {!d.daily_budget && !d.lifetime_budget && <p className="text-xs text-muted-foreground">{target?.level === "campaigns" ? "O orçamento está nos conjuntos (ABO)." : "O orçamento está na campanha (CBO)."}</p>}
          {(d.daily_budget || d.lifetime_budget) && <Field label="Estratégia de lance"><Select value={f.bid || "LOWEST_COST_WITHOUT_CAP"} onValueChange={(v) => set("bid", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{BIDS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></Field>}
        </>}
        {target?.level === "campaigns" && <Field label={`Limite de gasto da campanha (${currency})`} hint="Opcional. A campanha para quando chegar nesse total."><Input inputMode="decimal" value={f.cap ?? ""} onChange={(e) => set("cap", e.target.value)} /></Field>}
        {target?.level === "adsets" && <>
          {(f.bid === "COST_CAP" || f.bid === "LOWEST_COST_WITH_BID_CAP") && <Field label={`Valor do lance/meta de custo (${currency})`}><Input inputMode="decimal" value={f.bidAmount ?? ""} onChange={(e) => set("bidAmount", e.target.value)} /></Field>}
          <Field label="Início"><Input type="datetime-local" value={f.start ?? ""} onChange={(e) => set("start", e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Idade mínima"><Input type="number" min={13} max={65} value={f.ageMin ?? ""} onChange={(e) => set("ageMin", e.target.value)} /></Field><Field label="Idade máxima"><Input type="number" min={13} max={65} value={f.ageMax ?? ""} onChange={(e) => set("ageMax", e.target.value)} /></Field></div>
          <Field label="Gênero"><Select value={f.gender ?? "all"} onValueChange={(v) => set("gender", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="1">Homens</SelectItem><SelectItem value="2">Mulheres</SelectItem></SelectContent></Select></Field>
          <Field label="Países" hint="Siglas separadas por vírgula, ex.: BR, PT"><Input value={f.countries ?? ""} onChange={(e) => set("countries", e.target.value)} /></Field>
        </>}
        {target?.level !== "ads" && <Field label="Término (opcional)"><Input type="datetime-local" value={f.end ?? ""} onChange={(e) => set("end", e.target.value)} /></Field>}

        {target?.level === "ads" && (f.creativeLocked
          ? <p className="rounded-md border border-border p-3 text-xs text-muted-foreground">Este anúncio usa uma publicação existente ou criativo dinâmico: o texto não muda por aqui. Dá para pausar, renomear ou duplicar.</p>
          : <>
            {d.creative?.thumbnail_url && <img src={d.creative.thumbnail_url} alt="Criativo atual" className="h-28 w-28 rounded-md object-cover" />}
            <Field label="Texto principal"><Textarea rows={5} value={f.message ?? ""} onChange={(e) => set("message", e.target.value)} /></Field>
            {f.creativeKind !== "carousel" && <><Field label="Título"><Input value={f.headline ?? ""} onChange={(e) => set("headline", e.target.value)} /></Field><Field label="Descrição"><Input value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} /></Field></>}
            <Field label="Link de destino"><Input type="url" value={f.link ?? ""} onChange={(e) => set("link", e.target.value)} /></Field>
            <Field label="Parâmetros de URL" hint="Ex.: utm_source=fb&utm_campaign={{campaign.name}}"><Input value={f.urlTags ?? ""} onChange={(e) => set("urlTags", e.target.value)} /></Field>
            <p className="text-[11px] text-muted-foreground">Ao mudar texto ou link, o anúncio volta para revisão da Meta e pode reiniciar o aprendizado.</p>
          </>)}
        <Button className="w-full" disabled={busy} onClick={() => void submit()}>{busy ? "Salvando…" : "Salvar alterações"}</Button>
      </div>}
    </SheetContent>
  </Sheet>;
}
