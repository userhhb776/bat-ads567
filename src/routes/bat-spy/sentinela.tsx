import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PageHead, Field, NativeSelect, head } from "@/components/ui-kit";
import { SpyAdCard } from "@/components/spy-ad-card";
import { useStore, uid } from "@/lib/store";
import { spySentinelStatus } from "@/lib/spy.functions";
import { COUNTRIES, DEFAULT_FILTERS, MIN_DAYS, type SpyAd, type SpyFilters, type SpySentinel } from "@/lib/spy";

export const Route = createFileRoute("/bat-spy/sentinela")({ head: () => head("Bat Spy — Sentinela", "Vigia termos e concorrentes e avisa quando uma oferta passa do tempo mínimo no ar."), component: Sentinela });

type Status = Record<string, { at: string; checked: string; running: boolean; error: string; hits: SpyAd[] }>;
const EMPTY: Omit<SpySentinel, "id"> = { label: "", q: "", pageUrl: "", country: "BR", minDays: 15, everyHours: 24, whatsapp: "", active: true };
const when = (iso: string) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "ainda não");

function Sentinela() {
  const nav = useNavigate();
  const statusFn = useServerFn(spySentinelStatus);
  const [list, setList] = useStore<SpySentinel[]>("spy-sentinels", []);
  const [, setF] = useStore<SpyFilters>("spy-filters", DEFAULT_FILTERS);
  const [draft, setDraft] = useState(EMPTY);
  const [status, setStatus] = useState<Status>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState("");
  useEffect(() => { statusFn().then(setStatus).catch(() => toast.error("Não consegui ler o histórico da sentinela.")).finally(() => setLoading(false)); }, [statusFn]);
  const patch = (id: string, p: Partial<SpySentinel>) => setList(list.map((s) => (s.id === id ? { ...s, ...p } : s)));
  const add = () => {
    if (!draft.q.trim() && !draft.pageUrl.trim()) { toast.error("Digite um termo ou o link da página."); return; }
    setList([...list, { ...draft, id: uid(), label: draft.label.trim() || draft.q.trim() || "Página vigiada" }]);
    setDraft(EMPTY); toast.success("Sentinela ligada");
  };
  return <div className="space-y-5 p-4 pb-32 sm:p-7">
    <PageHead title="Sentinela" sub="O Bat Spy re-minera sozinho, mesmo com o painel fechado, e avisa no celular quando uma oferta passa do tempo mínimo no ar."><Button asChild variant="outline"><Link to="/bat-spy">Minerador</Link></Button></PageHead>
    <form className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-4" onSubmit={(e) => { e.preventDefault(); add(); }}>
      <Field label="Nome"><Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="ex.: Emagrecimento BR" /></Field>
      <Field label="Termo / nicho"><Input value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} placeholder="ex.: chá emagrecedor" /></Field>
      <div className="md:col-span-2"><Field label="Ou link da página / biblioteca do concorrente"><Input value={draft.pageUrl} onChange={(e) => setDraft({ ...draft, pageUrl: e.target.value })} inputMode="url" placeholder="https://www.facebook.com/ads/library/?...view_all_page_id=..." /></Field></div>
      <Field label="País"><NativeSelect value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value })}>{COUNTRIES.map(([c, l]) => <option key={c} value={c}>{l}</option>)}</NativeSelect></Field>
      <Field label="Avisar quando passar de"><NativeSelect value={String(draft.minDays)} onChange={(e) => setDraft({ ...draft, minDays: Number(e.target.value) })}>{MIN_DAYS.filter(Boolean).map((n) => <option key={n} value={n}>{n} dias no ar</option>)}</NativeSelect></Field>
      <Field label="Verificar a cada"><NativeSelect value={String(draft.everyHours)} onChange={(e) => setDraft({ ...draft, everyHours: Number(e.target.value) })}>{[6, 12, 24, 48, 72].map((h) => <option key={h} value={h}>{h < 24 ? `${h} horas` : `${h / 24} dia(s)`}</option>)}</NativeSelect></Field>
      <Field label="WhatsApp para avisar (opcional)"><Input value={draft.whatsapp} onChange={(e) => setDraft({ ...draft, whatsapp: e.target.value })} inputMode="tel" placeholder="5511999999999" /></Field>
      <div className="flex flex-wrap items-center gap-2 md:col-span-4"><Button><Plus className="h-4 w-4" />Ligar sentinela</Button><p className="text-xs text-muted-foreground">Cada verificação busca até 40 anúncios e gasta crédito da Apify (centavos). O aviso chega no sino, no celular e no WhatsApp se preenchido.</p></div>
    </form>
    <div className="space-y-3">
      {list.map((s) => { const st = status[s.id]; return <div key={s.id} className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center gap-3 p-3">
          <BellRing className={`h-5 w-5 shrink-0 ${s.active ? "text-primary" : "text-muted-foreground"}`} />
          <div className="min-w-0 flex-1"><p className="truncate font-semibold">{s.label}</p><p className="text-xs text-muted-foreground">{s.q || "página"} · {s.country} · {s.minDays}+ dias · a cada {s.everyHours}h · última verificação {loading ? "…" : when(st?.checked ?? st?.at ?? "")}{st?.running ? " · buscando agora" : ""}</p>{st?.error && <p className="text-xs text-destructive">{st.error}</p>}</div>
          <Switch checked={s.active} onCheckedChange={(v) => patch(s.id, { active: v })} aria-label="Ligar ou desligar" />
          <Button size="sm" variant="outline" onClick={() => setOpen(open === s.id ? "" : s.id)}>Achados ({st?.hits.length ?? 0})</Button>
          <Button size="sm" variant="outline" onClick={() => { setF({ ...DEFAULT_FILTERS, q: s.q, pageUrl: s.pageUrl, country: s.country, minDays: s.minDays }); void nav({ to: "/bat-spy" }); }}><Search className="h-3.5 w-3.5" />Minerar agora</Button>
          <Button size="icon" variant="ghost" aria-label="Apagar sentinela" onClick={() => setList(list.filter((x) => x.id !== s.id))}><Trash2 className="h-4 w-4" /></Button>
        </div>
        {open === s.id && <div className="border-t border-border p-3">{st?.hits.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{st.hits.map((a) => <SpyAdCard key={a.id} ad={a} niche={s.q} />)}</div> : <p className="py-6 text-center text-sm text-muted-foreground">{loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Nenhum achado ainda. A primeira verificação roda na próxima passada automática."}</p>}</div>}
      </div>; })}
      {!list.length && <p className="border-y border-border py-10 text-center text-sm text-muted-foreground">Nenhuma sentinela. Crie acima ou toque em “Vigiar esta busca” no minerador.</p>}
    </div>
  </div>;
}
