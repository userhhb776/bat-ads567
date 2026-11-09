import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ChevronDown, Eye, ImagePlus, Trash2 } from "lucide-react";
import { AccountBar } from "@/components/account-bar";
import { TargetSearch, type TargetItem } from "@/components/target-search";
import { useAccount } from "@/lib/use-account";
import { createPixel, getAssets, publishCampaign, uploadMedia } from "@/lib/meta.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/met/criar")({
  head: () => ({
    meta: [
      { title: "Criar anúncio — Bat Gotham" },
      { name: "description", content: "Crie campanha, conjunto e anúncio e publique de verdade." },
      { property: "og:title", content: "Criar anúncio — Bat Gotham" },
      { property: "og:description", content: "Crie campanha, conjunto e anúncio e publique de verdade." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Create,
});

type Opt = [string, string];
const objectives: Opt[] = [
  ["OUTCOME_AWARENESS", "Reconhecimento"],
  ["OUTCOME_TRAFFIC", "Tráfego"],
  ["OUTCOME_ENGAGEMENT", "Engajamento"],
  ["OUTCOME_LEADS", "Cadastros"],
  ["OUTCOME_APP_PROMOTION", "Promoção do app"],
  ["OUTCOME_SALES", "Vendas"],
];
const specials: Opt[] = [
  ["FINANCIAL_PRODUCTS_SERVICES", "Produtos e serviços financeiros"],
  ["EMPLOYMENT", "Emprego"],
  ["HOUSING", "Moradia"],
  ["ISSUES_ELECTIONS_POLITICS", "Questões sociais, eleições ou política"],
];
const destinations: Record<string, Opt[]> = {
  OUTCOME_SALES: [["WEBSITE", "Site"], ["APP", "App"], ["WHATSAPP", "WhatsApp"], ["MESSENGER", "Messenger"], ["INSTAGRAM_DIRECT", "Instagram Direct"], ["MESSAGING_MESSENGER_WHATSAPP", "Messenger + WhatsApp"], ["MESSAGING_INSTAGRAM_DIRECT_MESSENGER", "Instagram + Messenger"], ["MESSAGING_INSTAGRAM_DIRECT_WHATSAPP", "Instagram + WhatsApp"], ["MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP", "Messenger + Instagram + WhatsApp"], ["PHONE_CALL", "Ligações"]],
  OUTCOME_LEADS: [["WEBSITE", "Site"], ["ON_AD", "Formulário instantâneo"], ["WHATSAPP", "WhatsApp"], ["MESSENGER", "Messenger"], ["INSTAGRAM_DIRECT", "Instagram Direct"], ["MESSAGING_MESSENGER_WHATSAPP", "Messenger + WhatsApp"], ["MESSAGING_INSTAGRAM_DIRECT_MESSENGER", "Instagram + Messenger"], ["MESSAGING_INSTAGRAM_DIRECT_WHATSAPP", "Instagram + WhatsApp"], ["MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP", "Messenger + Instagram + WhatsApp"], ["PHONE_CALL", "Ligações"]],
  OUTCOME_TRAFFIC: [["WEBSITE", "Site"], ["APP", "App"], ["WHATSAPP", "WhatsApp"], ["MESSENGER", "Messenger"], ["INSTAGRAM_DIRECT", "Instagram Direct"], ["MESSAGING_MESSENGER_WHATSAPP", "Messenger + WhatsApp"], ["MESSAGING_INSTAGRAM_DIRECT_MESSENGER", "Instagram + Messenger"], ["MESSAGING_INSTAGRAM_DIRECT_WHATSAPP", "Instagram + WhatsApp"], ["MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP", "Messenger + Instagram + WhatsApp"], ["PHONE_CALL", "Ligações"]],
  OUTCOME_ENGAGEMENT: [["ON_POST", "No seu anúncio"], ["WHATSAPP", "WhatsApp"], ["MESSENGER", "Messenger"], ["WEBSITE", "Site"]],
  OUTCOME_AWARENESS: [["", "—"]],
  OUTCOME_APP_PROMOTION: [["APP", "App"]],
};
const isMessaging = (d: string) => d === "WHATSAPP" || d === "MESSENGER" || d === "INSTAGRAM_DIRECT" || d.startsWith("MESSAGING_");
function goalsFor(obj: string, dest: string): Opt[] {
  const msg = isMessaging(dest);
  if (dest === "PHONE_CALL") return [["QUALITY_CALL", "Ligações de qualidade"]];
  if (dest === "ON_AD" && obj === "OUTCOME_LEADS") return [["LEAD_GENERATION", "Maximizar leads"], ["QUALITY_LEAD", "Leads de qualidade"]];
  if (msg) return [["CONVERSATIONS", "Maximizar conversas"], ["LINK_CLICKS", "Cliques no link"]];
  switch (obj) {
    case "OUTCOME_SALES":
      return [["OFFSITE_CONVERSIONS", "Maximizar conversões"], ["VALUE", "Maximizar valor das conversões"], ["LANDING_PAGE_VIEWS", "Visualizações da página de destino"], ["LINK_CLICKS", "Cliques no link"], ["IMPRESSIONS", "Impressões"], ["REACH", "Alcance diário único"]];
    case "OUTCOME_LEADS":
      return [["OFFSITE_CONVERSIONS", "Maximizar conversões"], ["LANDING_PAGE_VIEWS", "Visualizações da página de destino"], ["LINK_CLICKS", "Cliques no link"], ["QUALITY_LEAD", "Leads de qualidade"]];
    case "OUTCOME_TRAFFIC":
      return [["LANDING_PAGE_VIEWS", "Visualizações da página de destino"], ["LINK_CLICKS", "Cliques no link"], ["REACH", "Alcance diário único"], ["IMPRESSIONS", "Impressões"]];
    case "OUTCOME_ENGAGEMENT":
      return [["POST_ENGAGEMENT", "Engajamento com a publicação"], ["THRUPLAY", "ThruPlay"], ["TWO_SECOND_CONTINUOUS_VIDEO_VIEWS", "Visualizações de 2s"], ["PAGE_LIKES", "Curtidas na página"], ["OFFSITE_CONVERSIONS", "Conversões"]];
    case "OUTCOME_AWARENESS":
      return [["REACH", "Alcance"], ["IMPRESSIONS", "Impressões"], ["AD_RECALL_LIFT", "Lembrança do anúncio"], ["THRUPLAY", "ThruPlay"]];
    default:
      return [["APP_INSTALLS", "Instalações do app"], ["LINK_CLICKS", "Cliques no link"]];
  }
}
const events: Opt[] = [
  ["PURCHASE", "Compra"], ["INITIATED_CHECKOUT", "Iniciar finalização da compra"], ["ADD_PAYMENT_INFO", "Adicionar informações de pagamento"],
  ["ADD_TO_CART", "Adicionar ao carrinho"], ["ADD_TO_WISHLIST", "Adicionar à lista de desejos"], ["CONTENT_VIEW", "Visualizar conteúdo"],
  ["LEAD", "Lead"], ["COMPLETE_REGISTRATION", "Concluir cadastro"], ["CONTACT", "Contato"], ["SEARCH", "Pesquisar"],
  ["START_TRIAL", "Iniciar avaliação"], ["SUBSCRIBE", "Assinar"], ["SCHEDULE", "Agendar"], ["DONATE", "Doar"],
];
const bids: Opt[] = [
  ["LOWEST_COST_WITHOUT_CAP", "Volume mais alto"],
  ["COST_CAP", "Meta de custo por resultado"],
  ["LOWEST_COST_WITH_BID_CAP", "Limite de lance"],
  ["LOWEST_COST_WITH_MIN_ROAS", "Meta de ROAS"],
];
const attributions: Opt[] = [
  ["CLICK_THROUGH:7+VIEW_THROUGH:1", "7 dias após clique ou 1 dia após visualização"],
  ["CLICK_THROUGH:7", "7 dias após clique"],
  ["CLICK_THROUGH:1+VIEW_THROUGH:1", "1 dia após clique ou visualização"],
  ["CLICK_THROUGH:1", "1 dia após clique"],
];
const ctas: Opt[] = [
  ["LEARN_MORE", "Saiba mais"], ["SHOP_NOW", "Comprar agora"], ["BUY_NOW", "Comprar"], ["ORDER_NOW", "Peça agora"], ["SIGN_UP", "Cadastre-se"],
  ["SUBSCRIBE", "Assinar"], ["GET_OFFER", "Obter oferta"], ["GET_QUOTE", "Solicitar orçamento"], ["CONTACT_US", "Fale conosco"],
  ["APPLY_NOW", "Candidate-se"], ["BOOK_TRAVEL", "Reservar"], ["DOWNLOAD", "Baixar"], ["WATCH_MORE", "Assistir mais"],
  ["SEND_MESSAGE", "Enviar mensagem"], ["WHATSAPP_MESSAGE", "Enviar mensagem pelo WhatsApp"], ["NO_BUTTON", "Sem botão"],
];
const fbPositions: Opt[] = [
  ["feed", "Feed"], ["profile_feed", "Feed do perfil"], ["marketplace", "Marketplace"], ["video_feeds", "Feed de vídeos"],
  ["right_hand_column", "Coluna da direita"], ["search", "Resultados da pesquisa"], ["story", "Stories"], ["facebook_reels", "Reels"],
  ["instream_video", "Vídeos in-stream"], ["notification", "Notificações"],
];
const igPositions: Opt[] = [
  ["stream", "Feed"], ["profile_feed", "Feed do perfil"], ["explore", "Explorar"], ["explore_home", "Página inicial do Explorar"],
  ["story", "Stories"], ["reels", "Reels"], ["ig_search", "Resultados da pesquisa"],
];
const anPositions: Opt[] = [["classic", "Nativo, banner e intersticial"], ["rewarded_video", "Vídeos premiados"]];
const msgPositions: Opt[] = [["story", "Stories"], ["messenger_home", "Caixa de entrada"], ["sponsored_messages", "Mensagens patrocinadas"]];
const DEFAULT_UTM =
  "utm_source=FB&utm_campaign={{campaign.name}}|{{campaign.id}}&utm_medium={{adset.name}}|{{adset.id}}&utm_content={{ad.name}}|{{ad.id}}&utm_term={{placement}}";

function Field({ label, hint, children, wide }: { label: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`block min-w-0 space-y-1 ${wide ? "md:col-span-2" : ""}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}
function Pick({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: Opt[]; placeholder?: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full"><SelectValue placeholder={placeholder ?? "Escolha"} /></SelectTrigger>
      <SelectContent>{options.filter(([v]) => v !== "").map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
    </Select>
  );
}
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Switch checked={checked} onCheckedChange={onChange} /> {label}
    </label>
  );
}
function Checks({ options, value, onChange }: { options: Opt[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.map(([v, l]) => (
        <label key={v} className="flex items-center gap-2 text-sm">
          <Checkbox checked={value.includes(v)} onCheckedChange={(on) => onChange(on ? [...value, v] : value.filter((x) => x !== v))} />
          {l}
        </label>
      ))}
    </div>
  );
}
function Section({ n, title, children, sub }: { n: number; title: string; sub?: string | undefined; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="rounded-lg border border-border bg-card">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 p-4 text-left sm:p-5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{n}</span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl tracking-wide">{title}</h2>
          {sub && <div className="truncate text-xs text-muted-foreground">{sub}</div>}
        </div>
        <ChevronDown className={`h-5 w-5 shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="space-y-6 border-t border-border p-4 sm:p-5">{children}</div>}
    </section>
  );
}
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-3 text-sm font-semibold">{title}</div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </div>
  );
}

type Media = { kind: "image" | "video"; base64: string; preview: string; fileName: string; headline: string; description: string; link: string };
const money = (v: string) => (v ? Math.round(Number(v.replace(",", ".")) * 100) : undefined);

function Create() {
  const [account, setAccount] = useAccount();
  const navigate = useNavigate();
  const assets = useQuery({ queryKey: ["assets", account], queryFn: () => getAssets({ data: { accountId: account } }), enabled: !!account });

  const [c, setC] = useState({
    name: "", objective: "OUTCOME_SALES", buying_type: "AUCTION", specials: [] as string[], cbo: true,
    budget_type: "daily" as "daily" | "lifetime", budget: "50", bid_strategy: "LOWEST_COST_WITHOUT_CAP", spend_cap: "",
  });
  const [s, setS] = useState({
    name: "", budget: "50", bid_amount: "", roas: "", destination: "WEBSITE", optimization_goal: "OFFSITE_CONVERSIONS",
    pixel_id: "", event: "PURCHASE", attribution: "CLICK_THROUGH:7+VIEW_THROUGH:1", start: "", end: "",
    locations: [{ id: "BR", name: "Brasil", type: "country" }] as TargetItem[], age_min: "18", age_max: "65", gender: "all",
    locales: [] as TargetItem[], interests: [] as TargetItem[], audIn: [] as string[], audOut: [] as string[],
    advantage: true, autoPlacements: true, platforms: ["facebook", "instagram"] as string[], fb: ["feed", "story", "facebook_reels"] as string[],
    ig: ["stream", "story", "reels"] as string[], an: [] as string[], msg: [] as string[], devices: "all",
    saved: "", dsaBen: "", dsaPay: "", dsaDiff: false, daypart: false, days: ["1", "2", "3", "4", "5"] as string[], hFrom: "8", hTo: "22", fcap: "", fdays: "7",
  });
  const [a, setA] = useState({
    name: "", page_id: "", ig_id: "", format: "single" as "single" | "carousel", message: "", headline: "", description: "",
    link: "", display_link: "", cta: "SHOP_NOW", url_tags: DEFAULT_UTM, tracking: true, enhancements: false, multi: true,
  });
  const [media, setMedia] = useState<Media[]>([]);
  const [publishActive, setPublishActive] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [step, setStep] = useState("");

  const isConv = s.optimization_goal === "OFFSITE_CONVERSIONS" || s.optimization_goal === "VALUE";
  const isMsg = isMessaging(s.destination);
  const needsBid = c.bid_strategy === "COST_CAP" || c.bid_strategy === "LOWEST_COST_WITH_BID_CAP";

  function buildTargeting() {
    const inc = s.locations.filter((l) => !l.exclude);
    const exc = s.locations.filter((l) => l.exclude);
    const geo = (list: TargetItem[]) => {
      const g: Record<string, unknown> = {};
      const countries = list.filter((l) => l.type === "country").map((l) => l.id);
      const regions = list.filter((l) => l.type === "region").map((l) => ({ key: l.id }));
      const cities = list.filter((l) => l.type === "city").map((l) => ({ key: l.id }));
      if (countries.length) g["countries"] = countries;
      if (regions.length) g["regions"] = regions;
      if (cities.length) g["cities"] = cities;
      return g;
    };
    const t: Record<string, unknown> = {
      geo_locations: geo(inc),
      age_min: Number(s.age_min),
      targeting_automation: { advantage_audience: s.advantage && !c.specials.length ? 1 : 0 },
    };
    if (!(s.advantage && Number(s.age_max) === 65)) t["age_max"] = Number(s.age_max);
    if (exc.length) t["excluded_geo_locations"] = geo(exc);
    if (s.gender !== "all") t["genders"] = [Number(s.gender)];
    if (s.locales.length) t["locales"] = s.locales.map((l) => Number(l.id));
    const ints = s.interests.filter((i) => !i.exclude).map((i) => ({ id: i.id, name: i.name }));
    const exInts = s.interests.filter((i) => i.exclude).map((i) => ({ id: i.id, name: i.name }));
    if (ints.length) t["flexible_spec"] = [{ interests: ints }];
    if (exInts.length) t["exclusions"] = { interests: exInts };
    if (s.audIn.length) t["custom_audiences"] = s.audIn.map((id) => ({ id }));
    if (s.audOut.length) t["excluded_custom_audiences"] = s.audOut.map((id) => ({ id }));
    if (!s.autoPlacements) {
      t["publisher_platforms"] = s.platforms;
      if (s.platforms.includes("facebook")) t["facebook_positions"] = s.fb;
      if (s.platforms.includes("instagram")) t["instagram_positions"] = s.ig;
      if (s.platforms.includes("audience_network")) t["audience_network_positions"] = s.an;
      if (s.platforms.includes("messenger")) t["messenger_positions"] = s.msg;
    }
    if (s.devices !== "all") t["device_platforms"] = [s.devices];
    const base = assets.data?.saved?.find((x) => x.id === s.saved)?.targeting;
    return base ? { ...base, ...t, geo_locations: inc.length ? t["geo_locations"] : base["geo_locations"] } : t;
  }

  const pub = useMutation({
    mutationFn: async () => {
      if (!media.length) throw new Error("Envie pelo menos uma imagem ou vídeo.");
      const uploaded = [];
      for (const [i, m] of media.entries()) {
        setStep(`Enviando criativo ${i + 1}/${media.length}…`);
        const r = await uploadMedia({ data: { accountId: account, kind: m.kind, base64: m.base64, name: m.fileName } });
        uploaded.push({ image_hash: r.image_hash ?? undefined, video_id: r.video_id ?? undefined, headline: m.headline || undefined, description: m.description || undefined, link: m.link || undefined });
      }
      setStep("Criando campanha, conjunto e anúncio…");
      return publishCampaign({
        data: {
          accountId: account,
          status: publishActive ? "ACTIVE" : "PAUSED",
          campaign: {
            name: c.name, objective: c.objective, buying_type: c.buying_type, special_ad_categories: c.specials,
            special_ad_category_country: c.specials.length ? s.locations.filter((l) => l.type === "country" && !l.exclude).map((l) => l.id) : undefined,
            cbo: c.cbo, budget_type: c.budget_type, budget: c.cbo ? money(c.budget) : undefined, bid_strategy: c.bid_strategy, spend_cap: money(c.spend_cap),
          },
          adset: {
            name: s.name || `${c.name} - Conjunto`,
            budget: c.cbo ? undefined : money(s.budget),
            bid_amount: needsBid ? money(s.bid_amount) : undefined,
            roas_floor: c.bid_strategy === "LOWEST_COST_WITH_MIN_ROAS" && s.roas ? Number(s.roas.replace(",", ".")) : undefined,
            optimization_goal: s.optimization_goal,
            billing_event: s.optimization_goal === "THRUPLAY" ? "THRUPLAY" : "IMPRESSIONS",
            destination_type: s.destination || undefined,
            pixel_id: isConv ? s.pixel_id || undefined : undefined,
            custom_event_type: isConv ? s.event : undefined,
            page_id_promoted: isMsg || s.destination === "ON_AD" || s.destination === "PHONE_CALL" || s.optimization_goal === "PAGE_LIKES" ? a.page_id : undefined,
            attribution: isConv ? s.attribution : undefined,
            start_time: s.start ? new Date(s.start).toISOString() : undefined,
            end_time: s.end ? new Date(s.end).toISOString() : undefined,
            targeting: buildTargeting(),
            schedule: c.budget_type === "lifetime" && s.daypart && s.days.length ? [{ days: s.days.map(Number), start_minute: Number(s.hFrom) * 60, end_minute: Math.min(24, Number(s.hTo)) * 60 }] : undefined,
            dsa_beneficiary: s.dsaBen || undefined,
            dsa_payor: s.dsaDiff ? s.dsaPay || undefined : s.dsaBen || undefined,
            frequency_cap: s.optimization_goal === "REACH" && Number(s.fcap) > 0 ? { events: Number(s.fcap), days: Number(s.fdays) || 7 } : undefined,
          },
          ad: {
            name: a.name || `${c.name} - Anúncio`, page_id: a.page_id, instagram_user_id: a.ig_id || undefined, format: a.format,
            media: uploaded, message: a.message, headline: a.headline, description: a.description, link: a.link,
            display_link: a.display_link || undefined, cta: a.cta, url_tags: a.url_tags || undefined,
            pixel_tracking: a.tracking && s.pixel_id ? s.pixel_id : undefined,
            enhancements: a.enhancements,
            multi_advertiser: a.multi,
          },
        },
      });
    },
    onSuccess: () => {
      setStep("");
      toast.success(publishActive ? "Publicado e ativo na Meta!" : "Publicado na Meta (pausado).");
      navigate({ to: "/met" });
    },
    onError: (e) => {
      setStep("");
      toast.error((e as Error).message, { duration: 15000 });
    },
  });

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    const list = a.format === "single" ? [files[0]!] : Array.from(files);
    list.forEach((f) => {
      const r = new FileReader();
      r.onload = () => {
        const url = String(r.result);
        const m: Media = { kind: f.type.startsWith("video") ? "video" : "image", base64: url.split(",")[1] ?? "", preview: url, fileName: f.name, headline: "", description: "", link: "" };
        setMedia((cur) => (a.format === "single" ? [m] : [...cur, m].slice(0, 10)));
      };
      r.readAsDataURL(f);
    });
  };

  const ready = account && c.name && a.page_id && a.link && media.length && (!isConv || s.pixel_id) && s.locations.some((l) => !l.exclude);
  const checklist: [string, boolean][] = [
    ["Conta de anúncios escolhida", !!account],
    ["Nome da campanha", !!c.name],
    ["Objetivo e local da conversão", !!c.objective && !!s.destination],
    ["Categoria especial revisada", true],
    ["Orçamento definido", c.cbo ? !!money(c.budget) : !!money(s.budget)],
    ["Pixel e evento (se conversão)", !isConv || !!s.pixel_id],
    ["Meta de custo / lance (se exigido)", !needsBid || !!money(s.bid_amount)],
    ["Data de término (orçamento total)", c.budget_type !== "lifetime" || !!s.end],
    ["Localização incluída", s.locations.some((l) => !l.exclude)],
    ["Página do Facebook", !!a.page_id],
    ["Instagram vinculado", !!a.ig_id],
    ["Criativo enviado", media.length > 0],
    ["Texto principal e título", !!a.message && !!a.headline],
    ["Link de destino", !!a.link],
    ["UTMs no link", !!a.url_tags],
  ];
  const pageName = assets.data?.pages.find((p) => p.id === a.page_id)?.name ?? "Sua página";

  const preview = (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="p-3 text-sm font-semibold">{pageName}<div className="text-xs font-normal text-muted-foreground">Patrocinado</div></div>
      <div className="whitespace-pre-wrap px-3 pb-3 text-sm">{a.message || "Texto principal do anúncio…"}</div>
      <div className={a.format === "carousel" ? "flex snap-x gap-2 overflow-x-auto px-3 pb-3" : ""}>
        {(media.length ? media : [null]).map((m, i) => (
          <div key={i} className={a.format === "carousel" ? "w-56 shrink-0 snap-start overflow-hidden rounded border border-border" : ""}>
            {m ? (m.kind === "video" ? <video src={m.preview} controls className="w-full" /> : <img src={m.preview} alt="Prévia do criativo" className="w-full" />) : <div className="flex aspect-square items-center justify-center bg-muted text-muted-foreground">Mídia</div>}
            <div className="flex items-center justify-between gap-2 bg-muted p-3">
              <div className="min-w-0">
                <div className="truncate text-xs text-muted-foreground">{a.display_link || a.link.replace(/^https?:\/\//, "").split("/")[0] || "seusite.com"}</div>
                <div className="truncate text-sm font-semibold">{m?.headline || a.headline || "Título"}</div>
              </div>
              {a.cta !== "NO_BUTTON" && <span className="shrink-0 rounded bg-secondary px-2 py-1.5 text-xs font-semibold">{ctas.find((x) => x[0] === a.cta)?.[1]}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="grid gap-6 p-3 pb-28 sm:p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-4 sm:space-y-5">
        <h1 className="font-display text-3xl tracking-wide sm:text-4xl">Criar anúncio</h1>
        <AccountBar account={account} setAccount={setAccount} />

        <Section n={1} title="Campanha" sub={objectives.find((o) => o[0] === c.objective)?.[1]}>
          <Group title="Detalhes da campanha">
            <Field label="Nome da campanha" wide><Input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} placeholder="CP01 - CBO - 1-5-1 - AD1" /></Field>
            <Field label="Tipo de compra"><Pick value={c.buying_type} onChange={(v) => setC({ ...c, buying_type: v })} options={[["AUCTION", "Leilão"], ["RESERVED", "Reserva"]]} /></Field>
            <Field label="Objetivo da campanha">
              <Pick value={c.objective} onChange={(v) => {
                const dest = destinations[v]?.[0]?.[0] ?? "";
                setC({ ...c, objective: v });
                setS({ ...s, destination: dest, optimization_goal: goalsFor(v, dest)[0]![0] });
              }} options={objectives} />
            </Field>
          </Group>
          <Group title="Categorias especiais de anúncio">
            <div className="md:col-span-2"><Checks options={specials} value={c.specials} onChange={(v) => setC({ ...c, specials: v })} />
              <p className="mt-2 text-[11px] text-muted-foreground">Declare se o anúncio for sobre crédito, emprego, moradia ou política. Com categoria, o público Advantage+ é desligado.</p></div>
          </Group>
          <Group title="Orçamento">
            <div className="md:col-span-2"><Toggle checked={c.cbo} onChange={(v) => setC({ ...c, cbo: v })} label="Orçamento da campanha Advantage+ (CBO)" /></div>
            {c.cbo && (
              <>
                <Field label="Tipo de orçamento"><Pick value={c.budget_type} onChange={(v) => setC({ ...c, budget_type: v as "daily" | "lifetime" })} options={[["daily", "Orçamento diário"], ["lifetime", "Orçamento total"]]} /></Field>
                <Field label="Valor (R$)"><Input inputMode="decimal" value={c.budget} onChange={(e) => setC({ ...c, budget: e.target.value })} /></Field>
              </>
            )}
            <Field label="Estratégia de lance"><Pick value={c.bid_strategy} onChange={(v) => setC({ ...c, bid_strategy: v })} options={bids} /></Field>
            <Field label="Limite de gastos da campanha (R$, opcional)"><Input inputMode="decimal" value={c.spend_cap} onChange={(e) => setC({ ...c, spend_cap: e.target.value })} /></Field>
          </Group>
        </Section>

        <Section n={2} title="Conjunto de anúncios" sub={goalsFor(c.objective, s.destination).find((g) => g[0] === s.optimization_goal)?.[1]}>
          <Group title="Detalhes">
            <Field label="Nome do conjunto" wide><Input value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} placeholder="Aberto - BR - 18+" /></Field>
          </Group>
          <Group title="Conversão">
            {(destinations[c.objective]?.length ?? 0) > 1 && (
              <Field label="Local da conversão">
                <Pick value={s.destination} onChange={(v) => setS({ ...s, destination: v, optimization_goal: goalsFor(c.objective, v)[0]![0] })} options={destinations[c.objective] ?? []} />
              </Field>
            )}
            <Field label="Meta de desempenho"><Pick value={s.optimization_goal} onChange={(v) => setS({ ...s, optimization_goal: v })} options={goalsFor(c.objective, s.destination)} /></Field>
            {isConv && (
              <>
                <Field label="Conjunto de dados (pixel)">
                  <Pick value={s.pixel_id} onChange={(v) => setS({ ...s, pixel_id: v })} options={(assets.data?.pixels ?? []).map((p) => [p.id, p.name])} placeholder={assets.data?.pixels.length === 0 ? "Nenhum pixel nesta conta" : "Escolha o pixel"} />
                  <button type="button" className="text-[11px] text-primary underline" onClick={async () => {
                    const name = window.prompt("Nome do novo pixel", c.name || "Pixel Bat Gotham");
                    if (!name) return;
                    try { const r = await createPixel({ data: { accountId: account, name } }); await assets.refetch(); setS((x) => ({ ...x, pixel_id: r.id })); toast.success(`Pixel criado: ${r.id}`); }
                    catch (e) { toast.error((e as Error).message); }
                  }}>+ Criar novo pixel nesta conta</button>
                </Field>
                <Field label="Evento de conversão"><Pick value={s.event} onChange={(v) => setS({ ...s, event: v })} options={events} /></Field>
                <Field label="Configuração de atribuição"><Pick value={s.attribution} onChange={(v) => setS({ ...s, attribution: v })} options={attributions} /></Field>
              </>
            )}
            {needsBid && <Field label={c.bid_strategy === "COST_CAP" ? "Meta de custo por resultado (R$)" : "Limite de lance (R$)"}><Input inputMode="decimal" value={s.bid_amount} onChange={(e) => setS({ ...s, bid_amount: e.target.value })} /></Field>}
            {c.bid_strategy === "LOWEST_COST_WITH_MIN_ROAS" && <Field label="ROAS mínimo (ex.: 2,5)"><Input inputMode="decimal" value={s.roas} onChange={(e) => setS({ ...s, roas: e.target.value })} /></Field>}
          </Group>
          <Group title="Orçamento e programação">
            {!c.cbo && <Field label={`Orçamento ${c.budget_type === "daily" ? "diário" : "total"} (R$)`}><Input inputMode="decimal" value={s.budget} onChange={(e) => setS({ ...s, budget: e.target.value })} /></Field>}
            {!c.cbo && <Field label="Tipo de orçamento"><Pick value={c.budget_type} onChange={(v) => setC({ ...c, budget_type: v as "daily" | "lifetime" })} options={[["daily", "Orçamento diário"], ["lifetime", "Orçamento total"]]} /></Field>}
            <Field label="Data de início"><Input type="datetime-local" value={s.start} onChange={(e) => setS({ ...s, start: e.target.value })} /></Field>
            <Field label={`Data de término${c.budget_type === "lifetime" ? " (obrigatória)" : " (opcional)"}`}><Input type="datetime-local" value={s.end} onChange={(e) => setS({ ...s, end: e.target.value })} /></Field>
            {c.budget_type === "lifetime" && (
              <div className="md:col-span-2 space-y-2 rounded-md border border-border p-3">
                <Toggle checked={s.daypart} onChange={(v) => setS({ ...s, daypart: v })} label="Programação de anúncios (só em horários escolhidos)" />
                {s.daypart && <div className="grid grid-cols-2 gap-3">
                  <Field label="Dias"><Checks options={[["0", "Dom"], ["1", "Seg"], ["2", "Ter"], ["3", "Qua"], ["4", "Qui"], ["5", "Sex"], ["6", "Sáb"]]} value={s.days} onChange={(v) => setS({ ...s, days: v })} /></Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Das (hora)"><Input inputMode="numeric" value={s.hFrom} onChange={(e) => setS({ ...s, hFrom: e.target.value })} /></Field>
                    <Field label="Até (hora)"><Input inputMode="numeric" value={s.hTo} onChange={(e) => setS({ ...s, hTo: e.target.value })} /></Field>
                  </div>
                </div>}
              </div>
            )}
            {s.optimization_goal === "REACH" && (
              <div className="grid grid-cols-2 gap-3 md:col-span-2">
                <Field label="Limite de frequência (impressões)"><Input inputMode="numeric" value={s.fcap} onChange={(e) => setS({ ...s, fcap: e.target.value })} placeholder="ex.: 2" /></Field>
                <Field label="A cada (dias)"><Input inputMode="numeric" value={s.fdays} onChange={(e) => setS({ ...s, fdays: e.target.value })} /></Field>
              </div>
            )}
          </Group>
          <Group title="Público">
            {(assets.data?.saved?.length ?? 0) > 0 && (
              <Field label="Usar um público salvo (opcional)" wide>
                <Pick value={s.saved || "none"} onChange={(v) => setS({ ...s, saved: v === "none" ? "" : v })} options={[["none", "Nenhum"], ...(assets.data?.saved ?? []).map((x) => [x.id, x.name] as Opt)]} />
              </Field>
            )}
            <div className="md:col-span-2 rounded-md border border-border p-3">
              <Toggle checked={s.advantage && !c.specials.length} onChange={(v) => setS({ ...s, advantage: v })} label="Público Advantage+ (a Meta expande além das sugestões)" />
            </div>
            <Field label="Localizações (+ incluir / − excluir)" wide>
              <TargetSearch kind="geo" value={s.locations} onChange={(v) => setS({ ...s, locations: v })} placeholder="Busque país, estado ou cidade" allowExclude />
            </Field>
            <div className="grid grid-cols-3 gap-3 md:col-span-2">
              <Field label="Idade mín."><Input inputMode="numeric" value={s.age_min} onChange={(e) => setS({ ...s, age_min: e.target.value })} /></Field>
              <Field label="Idade máx."><Input inputMode="numeric" value={s.age_max} onChange={(e) => setS({ ...s, age_max: e.target.value })} /></Field>
              <Field label="Gênero"><Pick value={s.gender} onChange={(v) => setS({ ...s, gender: v })} options={[["all", "Todos"], ["1", "Homens"], ["2", "Mulheres"]]} /></Field>
            </div>
            <Field label="Direcionamento detalhado (interesses, + / − excluir)" wide>
              <TargetSearch kind="interest" value={s.interests} onChange={(v) => setS({ ...s, interests: v })} placeholder="Busque interesses, ex.: emagrecimento" allowExclude />
            </Field>
            <Field label="Idiomas" wide>
              <TargetSearch kind="locale" value={s.locales} onChange={(v) => setS({ ...s, locales: v })} placeholder="Busque idioma, ex.: Português" />
            </Field>
            <Field label="Públicos personalizados — incluir" wide>
              <Checks options={(assets.data?.audiences ?? []).map((x) => [x.id, x.name])} value={s.audIn} onChange={(v) => setS({ ...s, audIn: v })} />
              {assets.data?.audiences.length === 0 && <span className="text-xs text-muted-foreground">Nenhum público salvo nesta conta.</span>}
            </Field>
            {(assets.data?.audiences.length ?? 0) > 0 && (
              <Field label="Públicos personalizados — excluir" wide>
                <Checks options={(assets.data?.audiences ?? []).map((x) => [x.id, x.name])} value={s.audOut} onChange={(v) => setS({ ...s, audOut: v })} />
              </Field>
            )}
          </Group>
          <Group title="Transparência dos anúncios">
            <Field label="Anunciante (opcional)" hint="Nome exibido na Biblioteca de Anúncios. Obrigatório só para público na União Europeia."><Input value={s.dsaBen} onChange={(e) => setS({ ...s, dsaBen: e.target.value })} placeholder="Nome da sua empresa" /></Field>
            <div className="space-y-2">
              <Toggle checked={s.dsaDiff} onChange={(v) => setS({ ...s, dsaDiff: v })} label="O anunciante e o pagador são diferentes" />
              {s.dsaDiff && <Input value={s.dsaPay} onChange={(e) => setS({ ...s, dsaPay: e.target.value })} placeholder="Quem paga" />}
            </div>
          </Group>
          <Group title="Posicionamentos">
            <div className="md:col-span-2 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
                <label className="flex items-center gap-2 text-sm"><input type="radio" checked={s.autoPlacements} onChange={() => setS({ ...s, autoPlacements: true })} className="accent-[var(--primary)]" /> Advantage+ (automático)</label>
                <label className="flex items-center gap-2 text-sm"><input type="radio" checked={!s.autoPlacements} onChange={() => setS({ ...s, autoPlacements: false })} className="accent-[var(--primary)]" /> Manuais</label>
              </div>
              <Field label="Dispositivos"><Pick value={s.devices} onChange={(v) => setS({ ...s, devices: v })} options={[["all", "Todos os dispositivos"], ["mobile", "Apenas celular"], ["desktop", "Apenas computador"]]} /></Field>
              {!s.autoPlacements && (
                <>
                  <Field label="Plataformas"><Checks options={[["facebook", "Facebook"], ["instagram", "Instagram"], ["audience_network", "Audience Network"], ["messenger", "Messenger"]]} value={s.platforms} onChange={(v) => setS({ ...s, platforms: v })} /></Field>
                  {s.platforms.includes("facebook") && <Field label="Facebook"><Checks options={fbPositions} value={s.fb} onChange={(v) => setS({ ...s, fb: v })} /></Field>}
                  {s.platforms.includes("instagram") && <Field label="Instagram"><Checks options={igPositions} value={s.ig} onChange={(v) => setS({ ...s, ig: v })} /></Field>}
                  {s.platforms.includes("audience_network") && <Field label="Audience Network"><Checks options={anPositions} value={s.an} onChange={(v) => setS({ ...s, an: v })} /></Field>}
                  {s.platforms.includes("messenger") && <Field label="Messenger"><Checks options={msgPositions} value={s.msg} onChange={(v) => setS({ ...s, msg: v })} /></Field>}
                </>
              )}
            </div>
          </Group>
        </Section>

        <Section n={3} title="Anúncio" sub={a.format === "single" ? "Imagem ou vídeo único" : "Carrossel"}>
          <Group title="Identidade">
            <Field label="Nome do anúncio" wide><Input value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} placeholder="AD1 - Vídeo depoimento" /></Field>
            <Field label="Página do Facebook"><Pick value={a.page_id} onChange={(v) => setA({ ...a, page_id: v })} options={(assets.data?.pages ?? []).map((p) => [p.id, p.name])} placeholder="Escolha a página" /></Field>
            <Field label="Conta do Instagram"><Pick value={a.ig_id} onChange={(v) => setA({ ...a, ig_id: v === "none" ? "" : v })} options={[["none", "Usar a página do Facebook"], ...(assets.data?.instagram ?? []).map((i) => [i.id, `@${i.name}`] as Opt)]} placeholder="Usar a página do Facebook" /></Field>
          </Group>
          <Group title="Configuração do anúncio">
            <Field label="Formato"><Pick value={a.format} onChange={(v) => { setA({ ...a, format: v as "single" | "carousel" }); setMedia((m) => (v === "single" ? m.slice(0, 1) : m)); }} options={[["single", "Imagem ou vídeo único"], ["carousel", "Carrossel (2 a 10 cards)"]]} /></Field>
          </Group>
          <Group title="Criativo">
            <div className="md:col-span-2 space-y-3">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-sm text-muted-foreground hover:border-primary">
                <ImagePlus className="h-6 w-6" />
                {a.format === "single" ? "Enviar imagem ou vídeo" : "Adicionar cards (imagens ou vídeos)"}
                <input type="file" accept="image/*,video/mp4" multiple={a.format === "carousel"} className="hidden" onChange={(e) => onFiles(e.target.files)} />
              </label>
              {media.map((m, i) => (
                <div key={i} className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-start gap-3 rounded-md border border-border p-2">
                  {m.kind === "video" ? <video src={m.preview} className="h-16 w-16 rounded object-cover" /> : <img src={m.preview} alt="" className="h-16 w-16 rounded object-cover" />}
                  <div className="min-w-0 space-y-1.5">
                    <div className="truncate text-xs text-muted-foreground">{m.fileName}</div>
                    {a.format === "carousel" && (
                      <>
                        <Input className="h-8" placeholder="Título do card" value={m.headline} onChange={(e) => setMedia(media.map((x, j) => (j === i ? { ...x, headline: e.target.value } : x)))} />
                        <Input className="h-8" placeholder="Link do card (opcional)" value={m.link} onChange={(e) => setMedia(media.map((x, j) => (j === i ? { ...x, link: e.target.value } : x)))} />
                      </>
                    )}
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => setMedia(media.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </Group>
          <Group title="Texto e destino">
            <Field label="Texto principal" hint={`${a.message.length}/125 recomendado`} wide><Textarea rows={4} value={a.message} onChange={(e) => setA({ ...a, message: e.target.value })} /></Field>
            <Field label="Título" hint={`${a.headline.length}/40`}><Input value={a.headline} onChange={(e) => setA({ ...a, headline: e.target.value })} /></Field>
            <Field label="Descrição" hint={`${a.description.length}/30`}><Input value={a.description} onChange={(e) => setA({ ...a, description: e.target.value })} /></Field>
            <Field label="Chamada para ação"><Pick value={a.cta} onChange={(v) => setA({ ...a, cta: v })} options={ctas} /></Field>
            <Field label={isMsg ? "Link (ex.: https://wa.me/55...)" : "URL do site"}><Input inputMode="url" value={a.link} onChange={(e) => setA({ ...a, link: e.target.value })} placeholder="https://..." /></Field>
            <Field label="Link de exibição (opcional)"><Input value={a.display_link} onChange={(e) => setA({ ...a, display_link: e.target.value })} placeholder="seusite.com" /></Field>
            <Field label="Parâmetros de URL (UTMs)" wide><Textarea rows={2} value={a.url_tags} onChange={(e) => setA({ ...a, url_tags: e.target.value })} className="font-mono text-xs" /></Field>
          </Group>
          <Group title="Rastreamento">
            <div className="md:col-span-2"><Toggle checked={a.tracking} onChange={(v) => setA({ ...a, tracking: v })} label="Rastrear eventos do site com o pixel do conjunto" /></div>
            <div className="md:col-span-2"><Toggle checked={a.multi} onChange={(v) => setA({ ...a, multi: v })} label="Anúncios com múltiplos anunciantes (pode aparecer junto de outros anúncios)" /></div>
            <div className="md:col-span-2"><Toggle checked={a.enhancements} onChange={(v) => setA({ ...a, enhancements: v })} label="Melhorias de criativo Advantage+ (a Meta ajusta brilho, texto e formato)" /></div>
          </Group>
        </Section>

        <div className="xl:hidden"><Checklist items={checklist} /></div>
        <div className="hidden items-center justify-end gap-4 sm:flex">
          <Toggle checked={publishActive} onChange={setPublishActive} label="Publicar já ativo" />
          <Button size="lg" disabled={!ready || pub.isPending} onClick={() => pub.mutate()}>{pub.isPending ? step || "Publicando…" : "Publicar"}</Button>
        </div>
      </div>

      <aside className="hidden xl:sticky xl:top-6 xl:block xl:self-start">
        <div className="mb-2 text-xs uppercase text-muted-foreground">Pré-visualização</div>
        {preview}
        <Checklist items={checklist} />
      </aside>

      {showPreview && (
        <div className="fixed inset-0 z-50 overflow-auto bg-background/95 p-4 xl:hidden" onClick={() => setShowPreview(false)}>
          <div className="mx-auto max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between"><span className="text-sm font-semibold">Pré-visualização</span><Button size="sm" variant="secondary" onClick={() => setShowPreview(false)}>Fechar</Button></div>
            {preview}
          </div>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-16 z-40 flex items-center gap-2 border-t border-border bg-card/95 p-3 backdrop-blur sm:hidden">
        <Button variant="secondary" size="icon" onClick={() => setShowPreview(true)}><Eye className="h-4 w-4" /></Button>
        <label className="flex min-w-0 flex-1 items-center gap-2 text-xs"><Switch checked={publishActive} onCheckedChange={setPublishActive} /> Já ativo</label>
        <Button disabled={!ready || pub.isPending} onClick={() => pub.mutate()}>{pub.isPending ? "Publicando…" : "Publicar"}</Button>
      </div>
      <div className="hidden sm:block xl:hidden">
        <Button variant="secondary" onClick={() => setShowPreview(true)}><Eye className="mr-2 h-4 w-4" /> Ver prévia</Button>
      </div>
    </div>
  );
}

function Checklist({ items }: { items: [string, boolean][] }) {
  const done = items.filter((i) => i[1]).length;
  return (
    <div className="mt-4 rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between text-sm font-semibold"><span>Não esqueça nada</span><span className="text-xs text-muted-foreground">{done}/{items.length}</span></div>
      <ul className="space-y-1 text-xs">
        {items.map(([l, ok]) => <li key={l} className={ok ? "text-muted-foreground line-through" : "text-foreground"}>{ok ? "✓" : "○"} {l}</li>)}
      </ul>
    </div>
  );
}
