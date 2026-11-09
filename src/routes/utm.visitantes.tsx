import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, Empty, head } from '@/components/ui-kit';
import { supabase } from '@/integrations/supabase/client';
import { useSession, useWebhookToken } from '@/lib/sales';
import { buildJourneys, bySource, type TrackEvent } from '@/lib/tracking/attribution';

export const Route = createFileRoute('/utm/visitantes')({ head: () => head('Visitantes e atribuição', 'Visitantes, sessões e origem por primeiro e último clique.'), component: VisitorsPage });

function script(endpoint: string) {
  return `<script>(function(){var E="${endpoint}",K="bg_v",S="bg_s",l=localStorage,ss=sessionStorage;function id(){return Math.random().toString(36).slice(2)+Date.now().toString(36)}var v=l.getItem(K)||id();l.setItem(K,v);var s=ss.getItem(S)||id();ss.setItem(S,s);var q=new URLSearchParams(location.search),u={};["utm_source","utm_medium","utm_campaign","utm_content","utm_term","fbclid","gclid","ttclid"].forEach(function(k){if(q.get(k))u[k]=q.get(k)});function send(e,x){fetch(E,{method:"POST",keepalive:true,headers:{"content-type":"application/json"},body:JSON.stringify(Object.assign({v:v,s:s,e:e,u:location.href,r:document.referrer,utm:u},x||{}))}).catch(function(){})}window.batTrack=send;send("pageview");document.addEventListener("submit",function(ev){var f=ev.target,m=f.querySelector("[type=email]"),p=f.querySelector("[type=tel]");send("lead",{email:m&&m.value||undefined,phone:p&&p.value||undefined})},true)})();</script>`;
}

function VisitorsPage() {
  const session = useSession();
  const on = !!session.data;
  const token = useWebhookToken(on);
  const [days, setDays] = useState(7);
  const [model, setModel] = useState<'first' | 'last'>('last');
  const events = useQuery({
    queryKey: ['track-events', days], enabled: on, refetchInterval: 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - days * 864e5).toISOString();
      const { data, error } = await (supabase as any).from('track_events').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(5000);
      if (error) throw error; return (data ?? []) as TrackEvent[];
    },
  });
  const journeys = useMemo(() => buildJourneys(events.data ?? []), [events.data]);
  const sources = bySource(journeys, model);
  const endpoint = token.data && typeof window !== 'undefined' ? `${window.location.origin}/api/public/track?token=${token.data}` : '';
  const sessions = new Set((events.data ?? []).map((e) => e.session_id)).size;
  const leads = journeys.filter((j) => j.converted).length;
  async function copy() { try { await navigator.clipboard.writeText(script(endpoint)); toast.success('Script copiado'); } catch { toast.error('Não foi possível copiar.'); } }

  return <div className="max-w-5xl space-y-5 p-4 pb-24 sm:p-7">
    <header><div className="text-xs text-primary">RASTREAMENTO</div><h1 className="mt-2 font-display text-4xl">Visitantes</h1></header>
    {!on ? <Empty title="Entre na sua conta" description="Os visitantes ficam salvos na sua conta." /> : <>
      <Card className="space-y-2">
        <div className="text-sm font-medium">Script de rastreamento</div>
        <p className="text-xs text-muted-foreground">Cole no &lt;head&gt; das suas páginas. Registra visitas, sessões, UTMs, fbclid/gclid e formulários enviados (lead). Para compras, chame <code>batTrack("purchase")</code> na página de obrigado.</p>
        <Button size="sm" disabled={!endpoint} onClick={copy}><Copy className="mr-1 h-3 w-3" />Copiar script</Button>
      </Card>
      <div className="flex flex-wrap gap-2">
        {[1, 7, 30].map((d) => <Button key={d} size="sm" variant={d === days ? 'default' : 'outline'} onClick={() => setDays(d)}>{d === 1 ? 'Hoje' : `${d} dias`}</Button>)}
        <span className="mx-2" />
        <Button size="sm" variant={model === 'first' ? 'default' : 'outline'} onClick={() => setModel('first')}>Primeiro clique</Button>
        <Button size="sm" variant={model === 'last' ? 'default' : 'outline'} onClick={() => setModel('last')}>Último clique</Button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[['Visitantes', journeys.length], ['Sessões', sessions], ['Leads/compras', leads]].map(([l, v]) => <Card key={l as string}><div className="text-xs text-muted-foreground">{l}</div><div className="text-2xl font-semibold">{v}</div></Card>)}
      </div>
      <Card>
        <div className="mb-2 text-sm font-medium">Origem ({model === 'first' ? 'primeiro' : 'último'} clique)</div>
        {sources.length === 0 ? <p className="text-sm text-muted-foreground">{events.isLoading ? 'Carregando…' : 'Nenhuma visita ainda. Instale o script.'}</p> :
          <table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted-foreground"><th>Origem</th><th>Visitantes</th><th>Conversões</th><th>Taxa</th></tr></thead>
            <tbody>{sources.map(([s, x]) => <tr key={s} className="border-t border-border"><td className="py-1">{s}</td><td>{x.visitors}</td><td>{x.conversions}</td><td>{((x.conversions / x.visitors) * 100).toFixed(1)}%</td></tr>)}</tbody></table>}
      </Card>
      <Card>
        <div className="mb-2 text-sm font-medium">Jornadas recentes</div>
        {journeys.slice(0, 30).map((j) => <div key={j.visitor} className="flex justify-between border-t border-border py-1 text-xs"><span>{j.email ?? j.phone ?? j.visitor.slice(0, 8)}</span><span className="text-muted-foreground">{j.first} → {j.last} · {j.sessions} sessões{j.converted ? ' · ✓' : ''}</span></div>)}
      </Card>
    </>}
  </div>;
}
