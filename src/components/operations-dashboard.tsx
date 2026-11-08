import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Activity, ArrowUpRight, Bot, Gauge, ShoppingCart, Target, TrendingUp, Wallet, Workflow } from 'lucide-react';
import { AccountBar } from './account-bar';
import { Button } from './ui/button';
import { getObjects } from '@/lib/meta.functions';
import { actionValue, useAccount } from '@/lib/use-account';
import { money, useCurrency } from '@/lib/currency';

export function OperationsDashboard() {
  useCurrency();
  const [account, setAccount] = useAccount();
  const [funnelCount, setFunnelCount] = useState(0);
  useEffect(() => { try { const value = JSON.parse(localStorage.getItem('batgotham.funnel:v2') ?? '{}'); setFunnelCount(Array.isArray(value.nodes) && value.nodes.length > 0 ? 1 : 0); } catch { /* no valid draft */ } }, []);
  const campaigns = useQuery({ queryKey: ['central-campaigns', account], enabled: Boolean(account), queryFn: () => getObjects({ data: { accountId: account, level: 'campaigns', datePreset: 'today' } }), staleTime: 300000 });
  const rows = campaigns.data ?? [];
  const totals = rows.reduce((total, campaign) => {
    total.spend += Number(campaign.insights?.spend ?? 0);
    total.revenue += actionValue(campaign.insights?.action_values, ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase']);
    total.sales += actionValue(campaign.insights?.actions, ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase']);
    total.leads += actionValue(campaign.insights?.actions, ['lead', 'offsite_conversion.fb_pixel_lead']);
    return total;
  }, { spend: 0, revenue: 0, sales: 0, leads: 0 });
  const ready = Boolean(campaigns.data);
  const stats = [
    { label: 'Investimento hoje', value: money(totals.spend), icon: Wallet },
    { label: 'Receita atribuída', value: money(totals.revenue), icon: TrendingUp },
    { label: 'ROAS', value: totals.spend ? (totals.revenue / totals.spend).toFixed(2) + 'x' : '—', icon: Target },
    { label: 'Compras atribuídas', value: String(totals.sales), icon: ShoppingCart },
    { label: 'Leads', value: String(totals.leads), icon: Activity },
    { label: 'CPA', value: totals.sales ? money(totals.spend / totals.sales) : '—', icon: Gauge },
    { label: 'CPL', value: totals.leads ? money(totals.spend / totals.leads) : '—', icon: Target },
    { label: 'Resultado antes de taxas', value: money(totals.revenue - totals.spend), icon: TrendingUp },
  ];
  return <div className="p-4 sm:p-7">
    <header className="ops-header -mx-4 mb-6 border-b border-border px-4 pb-6 pt-3 sm:-mx-7 sm:px-7">
      <div className="mb-2 flex items-center gap-2 text-xs text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> CENTRAL DE OPERAÇÕES</div>
      <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="font-display text-4xl sm:text-5xl">BAT <span className="text-primary">GOTHAM</span></h1><p className="mt-1 text-sm text-muted-foreground">Visão geral · Hoje</p></div><Button asChild><Link to="/met/criar">Criar campanha <ArrowUpRight /></Link></Button></div>
    </header>
    <AccountBar account={account} setAccount={setAccount} />
    {campaigns.error && <p className="mt-4 text-sm text-destructive">Não foi possível consultar as campanhas.</p>}
    <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">{stats.map(({label,value,icon: Icon}) => <div key={label} className="metric-card min-w-0 rounded-lg border border-border bg-card p-4 sm:p-5"><div className="flex items-start justify-between gap-2"><span className="text-xs text-muted-foreground">{label}</span><span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span></div><div className="mt-5 break-words text-xl font-semibold tabular-nums sm:text-3xl">{ready ? value : '—'}</div></div>)}</div>
    <p className="mt-3 text-xs text-muted-foreground">Compras e receita atribuídas pelos anúncios. Vendas aprovadas dos gateways ainda não conectadas.</p>
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section><div className="mb-4 flex items-center justify-between"><h2 className="font-display text-2xl">Campanhas em operação</h2><Button asChild variant="ghost" size="sm"><Link to="/met">Ver todas <ArrowUpRight /></Link></Button></div><div className="flex gap-6 border-y border-border py-4"><span className="text-sm"><b className="text-success">{ready ? rows.filter((c) => c.status === 'ACTIVE').length : '—'}</b> ativas</span><span className="text-sm text-muted-foreground"><b className="text-foreground">{ready ? rows.filter((c) => c.status === 'PAUSED').length : '—'}</b> pausadas</span></div>{rows.slice(0,6).map((c) => <div key={c.id} className="flex items-center justify-between gap-3 border-b border-border py-4"><div className="min-w-0"><div className="truncate text-sm font-medium">{c.name}</div><div className="mt-1 text-xs text-muted-foreground">{c.status === 'ACTIVE' ? 'Ativa' : c.status === 'PAUSED' ? 'Pausada' : c.status}</div></div><div className="shrink-0 text-sm tabular-nums">{money(c.insights?.spend ?? 0)}</div></div>)}{!rows.length && <p className="py-8 text-sm text-muted-foreground">{campaigns.isFetching ? 'Consultando campanhas…' : 'Nenhuma campanha carregada.'}</p>}</section>
      <section className="space-y-5"><h2 className="font-display text-2xl">Sua central</h2><Link to="/funis" className="flex items-center gap-3 border-b border-border pb-5"><Workflow className="h-5 w-5 text-primary" /><div className="flex-1"><div className="text-sm font-semibold">Funis</div><div className="text-xs text-muted-foreground">{funnelCount} rascunho neste aparelho</div></div><ArrowUpRight className="h-4 w-4" /></Link><Link to="/crowley" className="flex items-center gap-3 border-b border-border pb-5"><Bot className="h-5 w-5 text-primary" /><div className="flex-1"><div className="text-sm font-semibold">Crowley</div><div className="text-xs text-muted-foreground">Análise e comandos</div></div><ArrowUpRight className="h-4 w-4" /></Link><div className="border-l-2 border-primary pl-4"><div className="text-sm font-semibold">Vigia em segundo plano</div><p className="mt-1 text-xs text-muted-foreground">Ainda não ativado. As regras atuais verificam campanhas somente com o app aberto.</p></div></section>
    </div>
  </div>;
}