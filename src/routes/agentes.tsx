import { createFileRoute, Link } from '@tanstack/react-router';
import { useStore } from '@/lib/store';
import type { IntelRule } from '@/lib/intel';
import { PageHead, head } from '@/components/ui-kit';
import { Button } from '@/components/ui/button';
import { CrowleyChat } from '@/components/crowley/chat';
import { useAccount } from '@/lib/use-account';
import { AccountBar } from '@/components/account-bar';
export const Route=createFileRoute('/agentes')({head:()=>head('Agentes ADS','Estratégias conversacionais, revisão e decisões dos agentes de anúncios.'),component:Agents});
function Agents(){const [rules,setRules]=useStore<IntelRule[]>('intel-rules',[]);const [account,setAccount]=useAccount();return <div className="space-y-5 p-4 sm:p-7"><PageHead title="Agentes ADS"><Button asChild variant="outline"><Link to="/inteligencia">Decisões e notificações</Link></Button></PageHead><AccountBar account={account} setAccount={setAccount}/><div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_300px]"><CrowleyChat agents/><section><h2 className="mb-4 font-display text-2xl">Sua equipe ADS</h2>{!rules.length&&<p className="text-sm text-muted-foreground">Nenhum agente aprovado.</p>}{rules.map(r=><div key={r.id} className="mb-3 space-y-2 rounded-lg border border-border bg-card p-4"><h3 className="font-semibold">{r.name}</h3><p className="text-xs text-muted-foreground">{r.profile} · {r.autonomy === 'auto'?'Autônomo':r.autonomy === 'aprovar'?'Com aprovação':'Somente alertas'}</p><p className="break-all text-xs text-muted-foreground">{r.accountId ?? 'Conta selecionada'} · {r.campaignId==='*'?'Todas as campanhas':r.campaignId}</p><Button size="sm" variant={r.active?'outline':'default'} onClick={()=>setRules(rules.map(x=>x.id===r.id?{...x,active:!x.active}:x))}>{r.active?'Pausar agente':'Ativar agente'}</Button></div>)}</section></div></div>;}
