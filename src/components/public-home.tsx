import { Link } from '@tanstack/react-router';
import { ArrowRight, Bot, Search, FileText, Rocket, MessagesSquare, LineChart, Brain, Workflow, Bell, Check, Flame, TrendingUp } from 'lucide-react';
import { Button } from './ui/button';

const STEPS = [
  { icon: Search, t: 'Minere', d: 'Ache ofertas que já estão escalando na biblioteca de anúncios.' },
  { icon: FileText, t: 'Crie', d: 'Monte página e criativo com pixel e checkout já ligados.' },
  { icon: Rocket, t: 'Escale', d: 'Suba campanhas e deixe os agentes cuidarem da verba.' },
  { icon: MessagesSquare, t: 'Converta', d: 'Recupere Pix e carrinho no WhatsApp, no automático.' },
];

const FEATURES = [
  { icon: LineChart, t: 'Painel central', d: 'Gasto, vendas e resultado em uma tela.' },
  { icon: Search, t: 'Bat Spy', d: 'Ofertas escaladas antes de todo mundo.' },
  { icon: Brain, t: 'Agentes 24h', d: 'Vigiam suas campanhas com a sua estratégia.' },
  { icon: Workflow, t: 'Automações', d: 'Funis e pós-venda rodando sozinhos.' },
  { icon: Bot, t: 'Crowley', d: 'Seu parceiro de IA, por texto ou voz.' },
  { icon: Bell, t: 'Alertas no celular', d: 'Saldo, quedas e vendas na hora.' },
];

const SAMPLE = [
  { icon: Flame, t: 'Oferta escalando', d: '32 anúncios ativos · 21 dias no ar' },
  { icon: TrendingUp, t: 'Campanha vencedora', d: 'Crowley sugere subir a verba em 20%' },
  { icon: Bell, t: 'Venda aprovada', d: 'Pix recuperado pelo WhatsApp' },
];

export function PublicHome() {
  return <div className="landing relative min-h-screen overflow-x-hidden">
    <div aria-hidden className="landing-grid pointer-events-none absolute inset-0 -z-10" />
    <header className="sticky top-0 z-30 border-b border-border/50 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <div className="flex items-center gap-2"><img src="/favicon.svg" alt="" className="h-8 w-8" /><span className="font-display text-2xl">BAT <span className="text-primary">GOTHAM</span></span></div>
        <Button asChild size="sm" variant="outline"><Link to="/entrar">Entrar</Link></Button>
      </div>
    </header>

    <section className="relative">
      <div aria-hidden className="landing-orb absolute -right-24 top-10 -z-10 h-80 w-80 rounded-full" />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-14 text-center md:grid-cols-2 md:pt-24 md:text-left">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />Central de operações</span>
          <h1 className="mt-5 font-display text-5xl leading-[0.95] sm:text-6xl md:text-7xl">Tráfego e vendas <span className="landing-text">em um só comando.</span></h1>
          <p className="mx-auto mt-5 max-w-lg text-base text-muted-foreground sm:text-lg md:mx-0">Anúncios, ofertas, páginas, WhatsApp e IA no mesmo painel. Sem pular de aba em aba.</p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center md:justify-start">
            <Button asChild size="lg" className="landing-glow w-full sm:w-auto"><Link to="/entrar">Entrar na central <ArrowRight /></Link></Button>
            <Button asChild size="lg" variant="ghost" className="w-full sm:w-auto"><a href="#como-funciona">Como funciona</a></Button>
          </div>
          <ul className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground md:justify-start">
            {['Agentes 24h', 'Alertas no celular', 'WhatsApp nativo'].map((t) => <li key={t} className="flex items-center gap-1.5"><Check className="h-4 w-4 text-primary" />{t}</li>)}
          </ul>
        </div>
        <div className="mx-auto w-full max-w-md space-y-3 text-left">
          {SAMPLE.map((s) => <div key={s.t} className="landing-card flex items-center gap-3 rounded-xl p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary"><s.icon className="h-5 w-5" /></div>
            <div className="min-w-0"><p className="font-semibold">{s.t}</p><p className="truncate text-sm text-muted-foreground">{s.d}</p></div>
          </div>)}
          <p className="text-center text-[11px] text-muted-foreground">Exemplo ilustrativo</p>
        </div>
      </div>
    </section>

    <section id="como-funciona" className="scroll-mt-20 border-y border-border/50">
      <div className="mx-auto max-w-6xl px-5 py-20 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Como funciona</p>
        <h2 className="mt-3 font-display text-4xl sm:text-5xl">Da oferta à venda em 4 passos</h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{STEPS.map((s, i) => <div key={s.t} className="landing-card group relative rounded-xl p-6 text-center transition hover:-translate-y-1 sm:text-left">
          <span className="absolute right-4 top-3 font-display text-4xl text-foreground/10 transition group-hover:text-primary/30">0{i + 1}</span>
          <div className="mx-auto grid h-11 w-11 place-items-center rounded-lg bg-primary/15 text-primary sm:mx-0"><s.icon className="h-5 w-5" /></div>
          <h3 className="mt-4 text-lg font-semibold">{s.t}</h3><p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
        </div>)}</div>
      </div>
    </section>

    <section className="mx-auto max-w-6xl px-5 py-20 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">Tudo em um painel</p>
      <h2 className="mt-3 font-display text-4xl sm:text-5xl">O que você tem na mão</h2>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{FEATURES.map((f) => <div key={f.t} className="landing-card rounded-xl p-6 text-center sm:text-left">
        <f.icon className="mx-auto h-5 w-5 text-primary sm:mx-0" /><h3 className="mt-3 font-semibold">{f.t}</h3><p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
      </div>)}</div>
    </section>

    <section className="px-5 pb-24">
      <div className="landing-card landing-cta mx-auto max-w-4xl rounded-2xl px-6 py-14 text-center">
        <h2 className="font-display text-4xl sm:text-5xl">Gotham não dorme. <span className="landing-text">Sua operação também não.</span></h2>
        <Button asChild size="lg" className="landing-glow mt-8 w-full sm:w-auto"><Link to="/entrar">Abrir o painel <ArrowRight /></Link></Button>
      </div>
      <p className="mt-10 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} Bat Gotham</p>
    </section>
  </div>;
}
