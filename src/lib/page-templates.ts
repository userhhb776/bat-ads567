/** Ready-made sales page templates (BatDev JSX). Real data comes from panel placeholders; nothing invented is presented as real. */
export type TemplateId = "loja" | "vsl" | "servicos" | "suplemento";
type Item = Record<string, string>;
type TemplateData = {
  brand: string; nav: string[];
  colors: { bg: string; fg: string; muted: string; card: string; accent: string; onAccent: string };
  fonts: { url: string; title: string; body: string };
  sections: string[];
  hero: { kicker: string; title: string; subtitle: string; cta: string; image: string };
  video?: { title: string };
  products?: { title: string; items: Item[] };
  services?: { title: string; items: Item[] };
  benefits?: { title: string; items: Item[] };
  steps?: { title: string; items: string[] };
  testimonials: { title: string; items: Item[] };
  offer?: { title: string; includes: Item[]; from: string; price: string; note: string };
  guarantee?: { days: string; text: string };
  faq: Item[];
  cta: { title: string; text: string; button: string };
  footer: string;
};

const img = (id: string, w = 1200) => `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;
const REAL = "[Exemplo — substitua por depoimento real]";
const testimonials = (title: string) => ({ title, items: [1, 2, 3].map((n) => ({ name: `Cliente ${n} [nome real]`, text: REAL })) });

export const TEMPLATES: { id: TemplateId; name: string; description: string; image: string; data: TemplateData }[] = [
  {
    id: "loja", name: "Loja virtual", description: "Vitrine com produtos, carrinho e checkout.", image: img("1523275335684-37898b6baf30", 600),
    data: {
      brand: "Sua Loja", nav: ["Produtos", "Vantagens", "Dúvidas"],
      colors: { bg: "#f6f1ea", fg: "#1d1a16", muted: "#6b6258", card: "#fffaf3", accent: "#c2410c", onAccent: "#fff7ed" },
      fonts: { url: "Fraunces:wght@600;800&family=Manrope:wght@400;600;800", title: "'Fraunces', serif", body: "'Manrope', sans-serif" },
      sections: ["hero", "products", "benefits", "testimonials", "faq", "cta"],
      hero: { kicker: "Nova coleção", title: "Produtos escolhidos a dedo para o seu dia a dia", subtitle: "Qualidade de verdade, entrega rápida e troca fácil. Escolha o seu e finalize em poucos cliques.", cta: "Ver produtos", image: img("1505740420928-5e560c06d30e") },
      products: { title: "Mais vendidos", items: [
        { name: "Relógio Clássico", price: "[PREÇO]", tag: "Destaque", image: img("1523275335684-37898b6baf30", 800) },
        { name: "Fone Sem Fio", price: "[PREÇO]", tag: "Novo", image: img("1505740420928-5e560c06d30e", 800) },
        { name: "Tênis Esportivo", price: "[PREÇO]", tag: "Últimas unidades", image: img("1542291026-7eec264c27ff", 800) },
        { name: "Câmera Retrô", price: "[PREÇO]", tag: "Exclusivo", image: img("1526170375885-4d8ecf77b99f", 800) },
      ] },
      benefits: { title: "Por que comprar aqui", items: [
        { title: "Entrega rápida", text: "Enviamos para todo o Brasil com rastreio." }, { title: "Troca fácil", text: "Não gostou? A troca é simples e sem burocracia." }, { title: "Pagamento seguro", text: "Pix, cartão e boleto em ambiente protegido." },
      ] },
      testimonials: testimonials("Quem comprou, aprovou"),
      faq: [{ q: "Qual o prazo de entrega?", a: "[Informe o prazo real de entrega]" }, { q: "Como faço uma troca?", a: "[Explique a sua política de troca]" }, { q: "Quais formas de pagamento?", a: "Pix, cartão de crédito e boleto." }],
      cta: { title: "Garanta o seu antes que acabe", text: "Estoque limitado nesta coleção.", button: "Finalizar compra" },
      footer: "Todos os direitos reservados.",
    },
  },
  {
    id: "vsl", name: "VSL infoproduto", description: "Vídeo de vendas, oferta, garantia e FAQ.", image: img("1522202176988-66273c2fd55f", 600),
    data: {
      brand: "Seu Método", nav: ["Vídeo", "Oferta", "Garantia"],
      colors: { bg: "#0b0d10", fg: "#f2efe8", muted: "#a39e93", card: "#14171c", accent: "#f5b301", onAccent: "#111111" },
      fonts: { url: "Bebas+Neue&family=Barlow:wght@400;600;700", title: "'Bebas Neue', sans-serif", body: "'Barlow', sans-serif" },
      sections: ["hero", "video", "benefits", "testimonials", "offer", "guarantee", "faq", "cta"],
      hero: { kicker: "Aula gratuita liberada", title: "Descubra o método que transforma iniciantes em resultados reais", subtitle: "Assista ao vídeo abaixo até o final. Ele pode sair do ar a qualquer momento.", cta: "Quero acesso agora", image: "" },
      video: { title: "Assista antes que saia do ar" },
      benefits: { title: "O que você vai conquistar", items: [
        { title: "Passo a passo claro", text: "Do zero ao primeiro resultado, sem enrolação." }, { title: "Aulas curtas", text: "Aprenda no celular, no seu tempo." }, { title: "Suporte direto", text: "Tire dúvidas sempre que precisar." },
        { title: "Materiais prontos", text: "Modelos e checklists para aplicar hoje." }, { title: "Atualizações", text: "Conteúdo novo sem custo adicional." }, { title: "Comunidade", text: "Troque experiências com outros alunos." },
      ] },
      testimonials: testimonials("Resultados de alunos"),
      offer: { title: "Tudo o que você recebe", includes: [{ item: "Curso completo", value: "[VALOR]" }, { item: "Bônus 1", value: "[VALOR]" }, { item: "Bônus 2", value: "[VALOR]" }], from: "[DE]", price: "[PREÇO]", note: "Pagamento único · acesso imediato" },
      guarantee: { days: "[X]", text: "Se não gostar por qualquer motivo, devolvemos 100% do seu dinheiro. Sem perguntas." },
      faq: [{ q: "Como recebo o acesso?", a: "Logo após o pagamento, no seu e-mail." }, { q: "Funciona para iniciantes?", a: "[Explique para quem é o método]" }, { q: "Por quanto tempo tenho acesso?", a: "[Informe o tempo de acesso]" }],
      cta: { title: "Sua vaga está esperando", text: "Comece hoje e veja a diferença.", button: "Quero começar agora" },
      footer: "Este produto não garante resultados. Os resultados variam de pessoa para pessoa.",
    },
  },
  {
    id: "servicos", name: "Serviços / profissional", description: "Psicólogos, médicos, consultores e prestadores.", image: img("1573497019940-1c28c88b4f3e", 600),
    data: {
      brand: "Seu Nome", nav: ["Serviços", "Como funciona", "Dúvidas"],
      colors: { bg: "#f3f5f2", fg: "#18261f", muted: "#5c6b63", card: "#ffffff", accent: "#2f5d50", onAccent: "#ffffff" },
      fonts: { url: "Cormorant+Garamond:wght@600;700&family=Karla:wght@400;600;700", title: "'Cormorant Garamond', serif", body: "'Karla', sans-serif" },
      sections: ["hero", "services", "steps", "testimonials", "faq", "cta"],
      hero: { kicker: "Atendimento presencial e online", title: "Cuidado profissional, do jeito que você merece", subtitle: "Atendimento humano, com hora marcada e acompanhamento de perto.", cta: "Agendar atendimento", image: img("1573497019940-1c28c88b4f3e") },
      services: { title: "Como posso ajudar", items: [
        { name: "Primeira consulta", desc: "[Descreva o serviço, duração e para quem é]" }, { name: "Acompanhamento", desc: "[Descreva o acompanhamento]" }, { name: "Atendimento online", desc: "[Descreva como funciona online]" },
      ] },
      steps: { title: "Como funciona", items: ["Você agenda pelo botão", "Confirmamos o melhor horário", "Atendimento no dia marcado"] },
      testimonials: testimonials("O que dizem os pacientes"),
      faq: [{ q: "Atende por convênio?", a: "[Informe os convênios]" }, { q: "Onde fica o consultório?", a: "[Informe o endereço]" }, { q: "Qual o valor?", a: "[Informe o valor ou como consultar]" }],
      cta: { title: "Vamos conversar?", text: "Escolha o melhor horário para você.", button: "Agendar agora" },
      footer: "[Seu registro profissional]",
    },
  },
  {
    id: "suplemento", name: "Suplemento / encapsulado", description: "Benefícios, modo de uso, kits e garantia.", image: img("1584308666744-24d5c474f2ae", 600),
    data: {
      brand: "Sua Marca", nav: ["Benefícios", "Kits", "Dúvidas"],
      colors: { bg: "#fff8ec", fg: "#2a1a0a", muted: "#7a6650", card: "#ffffff", accent: "#e85d04", onAccent: "#ffffff" },
      fonts: { url: "Archivo+Black&family=Hind:wght@400;600;700", title: "'Archivo Black', sans-serif", body: "'Hind', sans-serif" },
      sections: ["hero", "benefits", "steps", "testimonials", "offer", "guarantee", "faq", "cta"],
      hero: { kicker: "Fórmula natural", title: "Mais disposição para a sua rotina, todos os dias", subtitle: "Cápsulas práticas para incluir no seu dia a dia.", cta: "Escolher meu kit", image: img("1584308666744-24d5c474f2ae") },
      benefits: { title: "Benefícios", items: [
        { title: "Prático", text: "Cápsulas fáceis de levar para qualquer lugar." }, { title: "Ingredientes selecionados", text: "[Liste os ingredientes reais]" }, { title: "Rotina leve", text: "Combine com alimentação equilibrada e atividade física." },
      ] },
      steps: { title: "Como usar", items: ["[Quantidade] cápsulas por dia", "Tome com água", "Mantenha o uso contínuo"] },
      testimonials: testimonials("Quem usa, recomenda"),
      offer: { title: "Escolha seu kit", includes: [{ item: "1 pote", value: "[PREÇO]" }, { item: "3 potes", value: "[PREÇO]" }, { item: "5 potes", value: "[PREÇO]" }], from: "[DE]", price: "[PREÇO]", note: "Frete e prazos conforme sua região" },
      guarantee: { days: "[X]", text: "Se não ficar satisfeito, devolvemos o seu dinheiro." },
      faq: [{ q: "Tem contraindicação?", a: "[Informe as orientações do rótulo]" }, { q: "Em quanto tempo chega?", a: "[Informe o prazo de entrega]" }, { q: "Posso tomar com outros suplementos?", a: "Consulte um profissional de saúde." }],
      cta: { title: "Comece hoje", text: "Estoque limitado.", button: "Quero meu kit" },
      footer: "Este produto não é um medicamento e não substitui uma alimentação equilibrada. Consulte um profissional de saúde.",
    },
  },
];

const APP = `
const CHECKOUT_URL = "{{CHECKOUT_URL}}";
const WHATSAPP_URL = "{{WHATSAPP_URL}}";
const VIDEO_URL = "{{VIDEO_URL}}";

function App() {
  const [open, setOpen] = useState(-1);
  const [menu, setMenu] = useState(false);
  const [cart, setCart] = useState([]);
  const c = DATA.colors;
  useEffect(() => {
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=" + DATA.fonts.url + "&display=swap"; document.head.appendChild(l);
    batTracking.configure({ pixelId: "{{PIXEL_ID}}" }); batTracking.setConsent(true); batTracking.track("PageView");
  }, []);
  const href = batTracking.attributedUrl(CHECKOUT_URL);
  const buy = () => batTracking.track("InitiateCheckout");
  const hasWa = WHATSAPP_URL.indexOf("http") === 0;
  const video = VIDEO_URL.indexOf("http") === 0 ? VIDEO_URL : "";
  const isFile = /\\.(mp4|webm|mov)(\\?|$)/i.test(video) || video.indexOf("/storage/v1/object/") > -1;
  const embed = video.indexOf("watch?v=") > -1 ? video.replace("watch?v=", "embed/") : video.indexOf("youtu.be/") > -1 ? video.replace("youtu.be/", "www.youtube.com/embed/") : video.indexOf("vimeo.com/") > -1 && video.indexOf("player.") < 0 ? video.replace("vimeo.com/", "player.vimeo.com/video/") : video;
  const title = { fontFamily: DATA.fonts.title };
  const wrap = "mx-auto w-full max-w-6xl px-5 sm:px-8";
  const Btn = ({ children, full }) => (
    <a href={href} onClick={buy} className={"inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-8 py-3 text-base font-bold shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl " + (full ? "w-full" : "w-full sm:w-auto")} style={{ background: c.accent, color: c.onAccent }}>{children} <ArrowRight className="h-5 w-5" /></a>
  );
  const H2 = ({ children }) => <h2 className="mb-10 text-center text-3xl leading-tight sm:text-5xl" style={title}>{children}</h2>;
  const card = { background: c.card, borderColor: c.fg + "14" };

  const section = (s) => {
    if (s === "hero") return (
      <section key={s} className={wrap + " grid items-center gap-10 py-14 sm:py-24 " + (DATA.hero.image ? "md:grid-cols-2" : "")}>
        <div className={"up text-center " + (DATA.hero.image ? "md:text-left" : "mx-auto max-w-3xl")}>
          <span className="inline-block rounded-full px-4 py-1 text-xs font-bold uppercase tracking-widest" style={{ background: c.accent + "22", color: c.accent }}>{DATA.hero.kicker}</span>
          <h1 className="mt-5 break-words text-4xl leading-tight sm:text-6xl" style={title}>{DATA.hero.title}</h1>
          <p className="mt-5 text-lg" style={{ color: c.muted }}>{DATA.hero.subtitle}</p>
          <div className="mt-8"><Btn>{DATA.hero.cta}</Btn></div>
        </div>
        {DATA.hero.image && <img src={DATA.hero.image} alt={DATA.hero.title} className="up aspect-[4/3] w-full rounded-3xl object-cover shadow-2xl" />}
      </section>
    );
    if (s === "video") return (
      <section key={s} className={wrap + " pb-16"}>
        <p className="mb-4 text-center text-sm font-bold uppercase tracking-widest" style={{ color: c.accent }}>{DATA.video.title}</p>
        <div className="mx-auto aspect-video w-full max-w-4xl overflow-hidden rounded-2xl border shadow-2xl" style={card}>
          {!video ? <div className="flex h-full flex-col items-center justify-center gap-3" style={{ color: c.muted }}><Play className="h-14 w-14" style={{ color: c.accent }} /><span>Seu vídeo aqui</span></div>
            : isFile ? <video src={video} controls playsInline className="h-full w-full object-cover" />
            : <iframe src={embed} title="Vídeo" className="h-full w-full" allow="autoplay; fullscreen" allowFullScreen />}
        </div>
        <div className="mt-8 text-center"><Btn>{DATA.hero.cta}</Btn></div>
      </section>
    );
    if (s === "products") return (
      <section key={s} id="produtos" className={wrap + " py-16"}>
        <H2>{DATA.products.title}</H2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {DATA.products.items.map((p, i) => (
            <div key={i} className="group overflow-hidden rounded-2xl border transition hover:-translate-y-1 hover:shadow-xl" style={card}>
              <div className="relative"><img src={p.image} alt={p.name} loading="lazy" className="aspect-square w-full object-cover" /><span className="absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold" style={{ background: c.accent, color: c.onAccent }}>{p.tag}</span></div>
              <div className="space-y-2 p-4"><h3 className="text-lg font-bold">{p.name}</h3><p style={{ color: c.muted }}>{p.price}</p>
                <button onClick={() => setCart(cart.concat(p.name))} className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border font-semibold" style={{ borderColor: c.accent, color: c.accent }}><ShoppingCart className="h-4 w-4" /> Adicionar</button></div>
            </div>
          ))}
        </div>
      </section>
    );
    if (s === "services") return (
      <section key={s} className={wrap + " py-16"}>
        <H2>{DATA.services.title}</H2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {DATA.services.items.map((x, i) => <div key={i} className="rounded-2xl border p-7" style={card}><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full" style={{ background: c.accent + "1f", color: c.accent }}><Check className="h-5 w-5" /></div><h3 className="text-2xl" style={title}>{x.name}</h3><p className="mt-2" style={{ color: c.muted }}>{x.desc}</p></div>)}
        </div>
      </section>
    );
    if (s === "benefits") return (
      <section key={s} className={wrap + " py-16"}>
        <H2>{DATA.benefits.title}</H2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {DATA.benefits.items.map((b, i) => <div key={i} className="rounded-2xl border p-6 transition hover:-translate-y-1" style={card}><Check className="mb-3 h-6 w-6" style={{ color: c.accent }} /><h3 className="text-lg font-bold">{b.title}</h3><p className="mt-1" style={{ color: c.muted }}>{b.text}</p></div>)}
        </div>
      </section>
    );
    if (s === "steps") return (
      <section key={s} className={wrap + " py-16"}>
        <H2>{DATA.steps.title}</H2>
        <ol className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {DATA.steps.items.map((t, i) => <li key={i} className="flex items-center gap-4 rounded-2xl border p-6" style={card}><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl font-bold" style={{ background: c.accent, color: c.onAccent }}>{i + 1}</span><span className="font-semibold">{t}</span></li>)}
        </ol>
      </section>
    );
    if (s === "testimonials") return (
      <section key={s} className={wrap + " py-16"}>
        <H2>{DATA.testimonials.title}</H2>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {DATA.testimonials.items.map((t, i) => <figure key={i} className="rounded-2xl border p-6" style={card}><div className="mb-3 flex gap-1" style={{ color: c.accent }}>{[0, 1, 2, 3, 4].map((k) => <Star key={k} className="h-4 w-4" />)}</div><blockquote style={{ color: c.muted }}>{t.text}</blockquote><figcaption className="mt-4 font-bold">{t.name}</figcaption></figure>)}
        </div>
      </section>
    );
    if (s === "offer") return (
      <section key={s} id="oferta" className={wrap + " py-16"}>
        <div className="mx-auto max-w-xl rounded-3xl border-2 p-7 text-center shadow-2xl sm:p-10" style={{ background: c.card, borderColor: c.accent }}>
          <h2 className="text-3xl sm:text-4xl" style={title}>{DATA.offer.title}</h2>
          <ul className="my-6 space-y-3 text-left">{DATA.offer.includes.map((x, i) => <li key={i} className="flex items-center justify-between gap-3 border-b pb-3" style={{ borderColor: c.fg + "14" }}><span className="flex items-center gap-2"><Check className="h-5 w-5" style={{ color: c.accent }} />{x.item}</span><span style={{ color: c.muted }}>{x.value}</span></li>)}</ul>
          <p className="line-through" style={{ color: c.muted }}>De {DATA.offer.from}</p>
          <p className="my-2 text-5xl font-bold" style={{ ...title, color: c.accent }}>{DATA.offer.price}</p>
          <p className="mb-6 text-sm" style={{ color: c.muted }}>{DATA.offer.note}</p>
          <Btn full>{DATA.cta.button}</Btn>
        </div>
      </section>
    );
    if (s === "guarantee") return (
      <section key={s} className={wrap + " py-12"}>
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 rounded-3xl border p-8 text-center md:flex-row md:text-left" style={card}>
          <ShieldCheck className="h-20 w-20 shrink-0" style={{ color: c.accent }} />
          <div><h3 className="text-2xl" style={title}>Garantia de {DATA.guarantee.days} dias</h3><p className="mt-2" style={{ color: c.muted }}>{DATA.guarantee.text}</p></div>
        </div>
      </section>
    );
    if (s === "faq") return (
      <section key={s} id="duvidas" className={wrap + " max-w-3xl py-16"}>
        <H2>Perguntas frequentes</H2>
        <div className="space-y-3">{DATA.faq.map((f, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border" style={card}>
            <button onClick={() => setOpen(open === i ? -1 : i)} className="flex min-h-[52px] w-full items-center justify-between gap-3 px-5 text-left font-semibold">{f.q}<ChevronDown className={"h-5 w-5 shrink-0 transition " + (open === i ? "rotate-180" : "")} /></button>
            {open === i && <p className="px-5 pb-5" style={{ color: c.muted }}>{f.a}</p>}
          </div>
        ))}</div>
      </section>
    );
    if (s === "cta") return (
      <section key={s} className="py-20 text-center" style={{ background: c.accent + "14" }}>
        <div className={wrap}><h2 className="text-3xl leading-tight sm:text-5xl" style={title}>{DATA.cta.title}</h2><p className="mx-auto mt-4 max-w-xl" style={{ color: c.muted }}>{DATA.cta.text}</p><div className="mt-8"><Btn>{DATA.cta.button}</Btn></div></div>
      </section>
    );
    return null;
  };

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: c.bg, color: c.fg, fontFamily: DATA.fonts.body }}>
      <style>{"@keyframes up{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}.up{animation:up .7s ease both}"}</style>
      <header className="sticky top-0 z-30 border-b backdrop-blur" style={{ background: c.bg + "e6", borderColor: c.fg + "14" }}>
        <div className={wrap + " flex h-16 items-center justify-between"}>
          <span className="text-xl" style={title}>{DATA.brand}</span>
          <nav className="hidden gap-8 md:flex">{DATA.nav.map((n) => <a key={n} href={"#" + n.toLowerCase()} className="text-sm font-semibold opacity-80 hover:opacity-100">{n}</a>)}</nav>
          <div className="flex items-center gap-2">
            {cart.length > 0 && <a href={href} onClick={buy} className="flex items-center gap-1 rounded-full px-3 py-2 text-sm font-bold" style={{ background: c.accent, color: c.onAccent }}><ShoppingCart className="h-4 w-4" />{cart.length}</a>}
            <button className="flex h-11 w-11 items-center justify-center md:hidden" onClick={() => setMenu(!menu)} aria-label="Menu">{menu ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}</button>
          </div>
        </div>
        {menu && <nav className="flex flex-col border-t px-5 py-3 md:hidden" style={{ borderColor: c.fg + "14" }}>{DATA.nav.map((n) => <a key={n} href={"#" + n.toLowerCase()} onClick={() => setMenu(false)} className="py-3 font-semibold">{n}</a>)}</nav>}
      </header>
      <main>{DATA.sections.map(section)}</main>
      <footer className="border-t py-10 text-center text-sm" style={{ borderColor: c.fg + "14", color: c.muted }}><div className={wrap}><p className="font-bold" style={{ color: c.fg }}>{DATA.brand}</p><p className="mt-2">{DATA.footer}</p></div></footer>
      {hasWa && <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" aria-label="Falar no WhatsApp" className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-2xl" style={{ background: "#25d366", color: "#fff" }}><MessageCircle className="h-7 w-7" /></a>}
    </div>
  );
}`;

/** Builds the editable JSX for a template; product name, if given, replaces the generic brand. */
export function templateCode(id: TemplateId, brand?: string): string {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error("Modelo não encontrado.");
  const data = { ...t.data, brand: brand?.trim() || t.data.brand };
  return `const DATA = ${JSON.stringify(data, null, 2)};\n${APP}`;
}
