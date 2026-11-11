import { Link } from '@tanstack/react-router';
import { ArrowUpRight, Bot, Radar, Workflow, Zap, ShieldCheck, LineChart, Search, MessagesSquare, FileText, Bell, Brain, Check } from 'lucide-react';
import { Button } from './ui/button';
import operations from '@/assets/gotham-operations.jpg';

const MODULES = [
  { icon: LineChart, t: 'Central de comando', d: 'Gasto, vendas reais do gateway e lucro em uma tela. Sem planilha, sem achismo.' },
  { icon: Zap, t: 'Campanhas sem atrito', d: 'Crie, pause, escale e duplique campanhas direto do painel — mudanças reais, na hora.' },
  { icon: Search, t: 'Bat Spy', d: 'Minere a biblioteca de anúncios e ache ofertas escalando antes de todo mundo.' },
  { icon: Brain, t: 'Agentes 24h', d: 'Robôs que vigiam suas campanhas com a SUA estratégia, mesmo com o celular desligado.' },
  { icon: FileText, t: 'Estúdio de páginas', d: 'Páginas de venda criadas por conversa, com pixel, UTMs e checkout já ligados.' },
  { icon: Workflow, t: 'Funis e automações', d: 'Recuperação de Pix, carrinho e pós-venda rodando sozinhos no WhatsApp.' },
  { icon: MessagesSquare, t: 'Atendimento com IA', d: 'Agentes que respondem clientes por produto e só chamam você quando importa.' },
  { icon: Bell, t: 'Alertas no bolso', d: 'Saldo acabando, campanha caindo, venda aprovada — direto no seu telefone.' },
];
const STATS = [['12', 'módulos integrados'], ['24/7', 'vigilância automática'], ['1', 'central para tudo'], ['0', 'abas abertas a mais']];

export function PublicHome() {
  return <div className="landing relative overflow-x-hidden">
    <div aria-hidden className="landing-grid pointer-events-none absolute inset-0 -z-10" />
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/50 bg-background/70 px-5 py-3 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-2"><img src="/favicon.svg" alt="" className="h-8 w-8 shrink-0" /><span className="truncate font-display text-2xl">BAT <span className="text-primary">GOTHAM</span></span></div>
      <Button asChild size="sm" className="landing-glow"><Link to="/entrar">Entrar</Link></Button>
    </header>

    <section className="relative isolate flex min-h-[88dvh] items-center overflow-hidden">
      <img src={operations} width={1536} height={1024} alt="Central de operações Gotham" className="absolute inset-0 -z-20 h-full w-full scale-105 object-cover opacity-60" />
      <div className="public-cover absolute inset-0 -z-10" />
      <div aria-hidden className="landing-orb absolute -right-24 top-10 -z-10 h-80 w-80 rounded-full" />
      <div aria-hidden className="landing-scan absolute inset-x-0 top-0 -z-10 h-40" />
      <div className="mx-auto w-full max-w-6xl px-5 py-20">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-primary"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />Sistema online</span>
        <h1 className="mt-6 font-display text-6xl leading-[0.9] sm:text-8xl lg:text-9xl">A noite é de quem<br /><span className="landing-text">vê primeiro.</span></h1>
        <p className="mt-6 max-w-xl text-base text-foreground/85 sm:text-lg">Bat Gotham é a central que une tráfego, ofertas, páginas, automações e um estrategista de IA em um só comando. Enquanto outros abrem dez ferramentas, você já decidiu a próxima jogada.</p>
        <div className="mt-8 flex flex-wrap gap-3"><Button asChild size="lg" className="landing-glow"><Link to="/entrar">Entrar na central <ArrowUpRight /></Link></Button><Button asChild size="lg" variant="outline"><a href="#modulos">Ver o arsenal</a></Button></div>
        <div className="mt-14 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">{STATS.map(([n, l]) => <div key={l} className="landing-card rounded-xl p-4"><div className="font-display text-4xl text-primary">{n}</div><div className="text-xs text-muted-foreground">{l}</div></div>)}</div>
      </div>
    </section>

    <section className="mx-auto max-w-6xl px-5 py-20">
      <p className="text-xs uppercase tracking-[0.25em] text-primary">O problema</p>
      <h2 className="mt-3 max-w-3xl font-display text-4xl sm:text-6xl">Dinheiro vaza no intervalo entre uma aba e outra.</h2>
      <div className="mt-10 grid gap-4 md:grid-cols-3">{[['Campanha queimando de madrugada', 'Sem ninguém olhando, o orçamento vai embora até você acordar.'], ['Oferta validada que você viu tarde', 'Quando chega no seu feed, o concorrente já escalou.'], ['Pix gerado e esquecido', 'Cada venda não recuperada é lucro deixado na mesa.']].map(([t, d]) => <div key={t} className="landing-card rounded-xl p-5"><h3 className="font-semibold">{t}</h3><p className="mt-2 text-sm text-muted-foreground">{d}</p></div>)}</div>
    </section>

    <section id="modulos" className="relative mx-auto max-w-6xl scroll-mt-20 px-5 py-20">
      <p className="text-xs uppercase tracking-[0.25em] text-primary">O arsenal</p>
      <h2 className="mt-3 font-display text-4xl sm:text-6xl">Tudo que a operação precisa. Conectado.</h2>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{MODULES.map((m) => <div key={m.t} className="landing-card group rounded-xl p-5 transition hover:-translate-y-1"><div className="mb-4 grid h-11 w-11 place-items-center rounded-lg bg-primary/15 text-primary transition group-hover:shadow-lg"><m.icon className="h-5 w-5" /></div><h3 className="font-display text-2xl">{m.t}</h3><p className="mt-1 text-sm text-muted-foreground">{m.d}</p></div>)}</div>
    </section>

    <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 md:grid-cols-2">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-primary">Crowley</p>
        <h2 className="mt-3 font-display text-4xl sm:text-6xl">Não é um assistente. É um parceiro de operação.</h2>
        <p className="mt-4 text-muted-foreground">Ele lê suas contas, vendas e ofertas, discorda quando os números não batem e propõe a próxima ação. Você aprova com um toque — ou deixa os agentes agirem dentro dos limites que você definiu.</p>
        <ul className="mt-6 space-y-2 text-sm">{['Fala como gente, por texto ou voz', 'Sabe qual conta tem saldo e qual vende mais', 'Monta campanha, página, funil e agente por conversa', 'Nunca age fora dos seus limites'].map((x) => <li key={x} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-primary" />{x}</li>)}</ul>
      </div>
      <div className="landing-card relative rounded-2xl p-5">
        <div aria-hidden className="landing-orb absolute -left-10 -top-10 -z-10 h-40 w-40 rounded-full" />
        <div className="flex items-center gap-2 border-b border-border/60 pb-3"><Bot className="h-5 w-5 text-primary" /><span className="text-sm font-semibold">Crowley</span><span className="ml-auto text-[10px] uppercase text-primary">online</span></div>
        <div className="space-y-3 pt-4 text-sm">
          <p className="ml-10 rounded-lg bg-primary/15 p-3">Como tá a operação hoje?</p>
          <p className="mr-10 rounded-lg bg-muted/50 p-3">Bom dia, chefe. A campanha principal está vendendo bem, mas a conta reserva fica sem dinheiro até amanhã. Quer que eu suba a verba da vencedora e te lembre de recarregar?</p>
          <div className="mr-10 flex gap-2"><span className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Aprovar ação</span><span className="rounded-md border border-border px-3 py-1.5 text-xs">Agora não</span></div>
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-6xl px-5 py-20">
      <div className="grid gap-4 md:grid-cols-3">{[[ShieldCheck, 'Blindado', 'Chaves e tokens ficam só no servidor. Cada ação fica registrada.'], [Radar, 'Sempre vigiando', 'Ciclos automáticos a cada poucos minutos, com novas tentativas se algo falhar.'], [Zap, 'Botão de pânico', 'Um toque congela todos os robôs, automações e agendamentos.']].map(([I, t, d]) => { const Icon = I as typeof Zap; return <div key={t as string} className="landing-card rounded-xl p-5"><Icon className="mb-3 h-6 w-6 text-primary" /><h3 className="font-display text-2xl">{t as string}</h3><p className="text-sm text-muted-foreground">{d as string}</p></div>; })}</div>
    </section>

    <section className="relative mx-auto max-w-6xl px-5 pb-24">
      <div className="landing-card landing-cta relative overflow-hidden rounded-3xl p-10 text-center">
        <h2 className="font-display text-5xl sm:text-7xl">Gotham não dorme.<br /><span className="landing-text">Sua operação também não.</span></h2>
        <Button asChild size="lg" className="landing-glow mt-8"><Link to="/entrar">Assumir o comando <ArrowUpRight /></Link></Button>
      </div>
      <p className="mt-10 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} Bat Gotham · Central de operações</p>
    </section>
  </div>;
}
