import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AccountBar } from "@/components/account-bar";
import { useAccount } from "@/lib/use-account";
import { getAssets, publishCampaign } from "@/lib/meta.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/met/criar")({
  head: () => ({
    meta: [
      { title: "Criar anúncio — Bat Ads" },
      { name: "description", content: "Crie campanha, conjunto e anúncio e publique." },
      { property: "og:title", content: "Criar anúncio — Bat Ads" },
      { property: "og:description", content: "Crie campanha, conjunto e anúncio e publique." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Create,
});

const objectives = [
  ["OUTCOME_SALES", "Vendas"],
  ["OUTCOME_LEADS", "Cadastros"],
  ["OUTCOME_TRAFFIC", "Tráfego"],
  ["OUTCOME_ENGAGEMENT", "Engajamento"],
  ["OUTCOME_AWARENESS", "Reconhecimento"],
  ["OUTCOME_APP_PROMOTION", "Promoção do app"],
];
const optGoals: Record<string, string[][]> = {
  OUTCOME_SALES: [["OFFSITE_CONVERSIONS", "Conversões"], ["VALUE", "Valor"], ["LINK_CLICKS", "Cliques no link"], ["LANDING_PAGE_VIEWS", "Visualizações da página"]],
  OUTCOME_LEADS: [["OFFSITE_CONVERSIONS", "Conversões"], ["LEAD_GENERATION", "Formulário instantâneo"], ["LINK_CLICKS", "Cliques no link"]],
  OUTCOME_TRAFFIC: [["LINK_CLICKS", "Cliques no link"], ["LANDING_PAGE_VIEWS", "Visualizações da página"], ["REACH", "Alcance"]],
  OUTCOME_ENGAGEMENT: [["POST_ENGAGEMENT", "Engajamento"], ["THRUPLAY", "ThruPlay"]],
  OUTCOME_AWARENESS: [["REACH", "Alcance"], ["IMPRESSIONS", "Impressões"], ["AD_RECALL_LIFT", "Lembrança do anúncio"]],
  OUTCOME_APP_PROMOTION: [["APP_INSTALLS", "Instalações"], ["LINK_CLICKS", "Cliques no link"]],
};
const events = [["PURCHASE", "Compra"], ["INITIATED_CHECKOUT", "Iniciar finalização"], ["LEAD", "Lead"], ["COMPLETE_REGISTRATION", "Cadastro"], ["ADD_TO_CART", "Adicionar ao carrinho"], ["CONTENT_VIEW", "Ver conteúdo"]];
const bids = [["LOWEST_COST_WITHOUT_CAP", "Maior volume"], ["COST_CAP", "Meta de custo por resultado"], ["LOWEST_COST_WITH_BID_CAP", "Limite de lance"]];
const ctas = [["LEARN_MORE", "Saiba mais"], ["SHOP_NOW", "Comprar agora"], ["SIGN_UP", "Cadastre-se"], ["BUY_NOW", "Comprar"], ["CONTACT_US", "Fale conosco"], ["DOWNLOAD", "Baixar"], ["GET_OFFER", "Obter oferta"], ["SUBSCRIBE", "Assinar"], ["WHATSAPP_MESSAGE", "Enviar mensagem"]];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
function Pick({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[][]; placeholder?: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
    </Select>
  );
}
function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-4 flex items-center gap-3 font-display text-2xl tracking-wide">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary font-sans text-sm font-bold text-primary-foreground">{n}</span>
        {title}
      </h2>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Create() {
  const [account, setAccount] = useAccount();
  const navigate = useNavigate();
  const assets = useQuery({
    queryKey: ["assets", account],
    queryFn: () => getAssets({ data: { accountId: account } }),
    enabled: !!account,
  });

  const [c, setC] = useState({ name: "", objective: "OUTCOME_SALES", cbo: true, budget: "50", bid_strategy: "LOWEST_COST_WITHOUT_CAP", special: false });
  const [s, setS] = useState({ name: "", budget: "50", optimization_goal: "OFFSITE_CONVERSIONS", pixel_id: "", event: "PURCHASE", countries: "BR", age_min: "18", age_max: "65", gender: "all", start: "", advantage: true });
  const [a, setA] = useState({ name: "", page_id: "", message: "", headline: "", description: "", link: "", cta: "LEARN_MORE", url_tags: "utm_source=FB&utm_campaign={{campaign.name}}|{{campaign.id}}&utm_medium={{adset.name}}|{{adset.id}}&utm_content={{ad.name}}|{{ad.id}}&utm_term={{placement}}", image: "" as string, preview: "" });
  const [publishActive, setPublishActive] = useState(false);

  const pub = useMutation({
    mutationFn: () =>
      publishCampaign({
        data: {
          accountId: account,
          status: publishActive ? "ACTIVE" : "PAUSED",
          campaign: {
            name: c.name,
            objective: c.objective,
            cbo: c.cbo,
            daily_budget: c.cbo ? Math.round(Number(c.budget) * 100) : undefined,
            bid_strategy: c.bid_strategy,
            special_ad_categories: c.special ? ["CREDIT"] : [],
          },
          adset: {
            name: s.name || `${c.name} - Conjunto`,
            daily_budget: c.cbo ? undefined : Math.round(Number(s.budget) * 100),
            optimization_goal: s.optimization_goal,
            billing_event: "IMPRESSIONS",
            pixel_id: s.optimization_goal === "OFFSITE_CONVERSIONS" || s.optimization_goal === "VALUE" ? s.pixel_id || undefined : undefined,
            custom_event_type: s.event,
            countries: s.countries.split(",").map((x) => x.trim().toUpperCase()).filter(Boolean),
            age_min: Number(s.age_min),
            age_max: Number(s.age_max),
            genders: s.gender === "all" ? [] : [Number(s.gender)],
            start_time: s.start ? new Date(s.start).toISOString() : undefined,
            advantage_audience: s.advantage,
          },
          ad: {
            name: a.name || `${c.name} - Anúncio`,
            page_id: a.page_id,
            imageBase64: a.image || undefined,
            message: a.message,
            headline: a.headline,
            description: a.description,
            link: a.link,
            cta: a.cta,
            url_tags: a.url_tags || undefined,
          },
        },
      }),
    onSuccess: () => {
      toast.success("Campanha publicada na Meta!");
      navigate({ to: "/met" });
    },
    onError: (e) => toast.error((e as Error).message, { duration: 12000 }),
  });

  const onFile = (f?: File) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const url = String(r.result);
      setA((x) => ({ ...x, image: url.split(",")[1], preview: url }));
    };
    r.readAsDataURL(f);
  };

  const ready = account && c.name && a.page_id && a.link && (a.image || true);

  return (
    <div className="grid gap-6 p-6 xl:grid-cols-[1fr_340px]">
      <div className="space-y-5">
        <h1 className="font-display text-4xl tracking-wide">Criar anúncio</h1>
        <AccountBar account={account} setAccount={setAccount} />

        <Section n={1} title="Campanha">
          <Field label="Nome da campanha"><Input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} placeholder="CP01 - CBO - 1-5-1 - AD1" /></Field>
          <Field label="Objetivo">
            <Pick value={c.objective} onChange={(v) => { setC({ ...c, objective: v }); setS({ ...s, optimization_goal: optGoals[v][0][0] }); }} options={objectives} />
          </Field>
          <Field label="Estratégia de lance"><Pick value={c.bid_strategy} onChange={(v) => setC({ ...c, bid_strategy: v })} options={bids} /></Field>
          <div className="flex items-center gap-6 pt-5">
            <label className="flex items-center gap-2 text-sm"><Switch checked={c.cbo} onCheckedChange={(v) => setC({ ...c, cbo: v })} /> Orçamento da campanha (CBO)</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={c.special} onCheckedChange={(v) => setC({ ...c, special: v })} /> Categoria especial</label>
          </div>
          {c.cbo && <Field label="Orçamento diário (R$)"><Input type="number" value={c.budget} onChange={(e) => setC({ ...c, budget: e.target.value })} /></Field>}
        </Section>

        <Section n={2} title="Conjunto de anúncios">
          <Field label="Nome do conjunto"><Input value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} placeholder="Aberto - BR - 18+" /></Field>
          {!c.cbo && <Field label="Orçamento diário (R$)"><Input type="number" value={s.budget} onChange={(e) => setS({ ...s, budget: e.target.value })} /></Field>}
          <Field label="Meta de desempenho"><Pick value={s.optimization_goal} onChange={(v) => setS({ ...s, optimization_goal: v })} options={optGoals[c.objective]} /></Field>
          {(s.optimization_goal === "OFFSITE_CONVERSIONS" || s.optimization_goal === "VALUE") && (
            <>
              <Field label="Pixel / conjunto de dados">
                <Pick value={s.pixel_id} onChange={(v) => setS({ ...s, pixel_id: v })} options={(assets.data?.pixels ?? []).map((p) => [p.id, p.name])} placeholder="Escolha o pixel" />
              </Field>
              <Field label="Evento de conversão"><Pick value={s.event} onChange={(v) => setS({ ...s, event: v })} options={events} /></Field>
            </>
          )}
          <Field label="Países (códigos, separados por vírgula)"><Input value={s.countries} onChange={(e) => setS({ ...s, countries: e.target.value })} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Idade mín."><Input type="number" value={s.age_min} onChange={(e) => setS({ ...s, age_min: e.target.value })} /></Field>
            <Field label="Idade máx."><Input type="number" value={s.age_max} onChange={(e) => setS({ ...s, age_max: e.target.value })} /></Field>
            <Field label="Gênero"><Pick value={s.gender} onChange={(v) => setS({ ...s, gender: v })} options={[["all", "Todos"], ["1", "Homens"], ["2", "Mulheres"]]} /></Field>
          </div>
          <Field label="Início (opcional)"><Input type="datetime-local" value={s.start} onChange={(e) => setS({ ...s, start: e.target.value })} /></Field>
          <label className="flex items-center gap-2 pt-5 text-sm"><Switch checked={s.advantage} onCheckedChange={(v) => setS({ ...s, advantage: v })} /> Público Advantage+</label>
        </Section>

        <Section n={3} title="Anúncio">
          <Field label="Nome do anúncio"><Input value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} placeholder="AD1 - Vídeo depoimento" /></Field>
          <Field label="Página do Facebook">
            <Pick value={a.page_id} onChange={(v) => setA({ ...a, page_id: v })} options={(assets.data?.pages ?? []).map((p) => [p.id, p.name])} placeholder="Escolha a página" />
          </Field>
          <Field label="Imagem"><Input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} /></Field>
          <Field label="Chamada para ação"><Pick value={a.cta} onChange={(v) => setA({ ...a, cta: v })} options={ctas} /></Field>
          <div className="md:col-span-2"><Field label="Texto principal"><Textarea rows={4} value={a.message} onChange={(e) => setA({ ...a, message: e.target.value })} /></Field></div>
          <Field label="Título"><Input value={a.headline} onChange={(e) => setA({ ...a, headline: e.target.value })} /></Field>
          <Field label="Descrição"><Input value={a.description} onChange={(e) => setA({ ...a, description: e.target.value })} /></Field>
          <Field label="URL do site"><Input value={a.link} onChange={(e) => setA({ ...a, link: e.target.value })} placeholder="https://..." /></Field>
          <Field label="Parâmetros de URL (UTMs)"><Input value={a.url_tags} onChange={(e) => setA({ ...a, url_tags: e.target.value })} /></Field>
        </Section>

        <div className="flex items-center justify-end gap-4">
          <label className="flex items-center gap-2 text-sm"><Switch checked={publishActive} onCheckedChange={setPublishActive} /> Publicar já ativo</label>
          <Button size="lg" disabled={!ready || pub.isPending} onClick={() => pub.mutate()}>
            {pub.isPending ? "Publicando…" : "Publicar"}
          </Button>
        </div>
      </div>

      <aside className="xl:sticky xl:top-6 xl:self-start">
        <div className="mb-2 text-xs uppercase text-muted-foreground">Pré-visualização</div>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="p-3 text-sm font-semibold">{assets.data?.pages.find((p) => p.id === a.page_id)?.name ?? "Sua página"}<div className="text-xs font-normal text-muted-foreground">Patrocinado</div></div>
          <div className="whitespace-pre-wrap px-3 pb-3 text-sm">{a.message || "Texto principal do anúncio…"}</div>
          {a.preview ? <img src={a.preview} alt="Prévia do criativo" className="w-full" /> : <div className="flex aspect-square items-center justify-center bg-muted text-muted-foreground">Imagem</div>}
          <div className="flex items-center justify-between gap-2 bg-muted p-3">
            <div className="min-w-0">
              <div className="truncate text-xs text-muted-foreground">{a.link.replace(/^https?:\/\//, "").split("/")[0] || "seusite.com"}</div>
              <div className="truncate text-sm font-semibold">{a.headline || "Título"}</div>
            </div>
            <span className="shrink-0 rounded bg-secondary px-3 py-1.5 text-xs font-semibold">{ctas.find((x) => x[0] === a.cta)?.[1]}</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
