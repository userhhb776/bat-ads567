import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Link } from '@tanstack/react-router';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Trash2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useStore, readStore } from '@/lib/store';
import { createJob } from '@/lib/ops.functions';
import { useAccount } from '@/lib/use-account';
import { useCurrency } from '@/lib/currency';
import { crowleyChat } from '@/lib/crowley.functions';
import { getAccountsOverview, getObjects, updateObject } from '@/lib/meta.functions';
import type { IntelRule } from '@/lib/intel';
import portrait from '@/assets/crowley-portrait.jpg';

type Msg = { role: 'user' | 'assistant'; content: string };
const actionSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('status'), id: z.string().min(1), status: z.enum(['ACTIVE','PAUSED']) }),
  z.object({ tipo: z.literal('orcamento'), id: z.string().min(1), valor: z.number().positive() }),
  z.object({ tipo: z.literal('automacao'), nome: z.string().min(1), ativa: z.boolean() }),
  z.object({ tipo: z.literal('agendar'), id: z.string().min(1), quando: z.string().min(10), acao: z.enum(['ACTIVE','PAUSED','ORCAMENTO']), valor: z.number().positive().optional() }),
  z.object({ tipo: z.literal('lembrete'), quando: z.string().min(10), titulo: z.string().min(1).max(120), detalhe: z.string().max(1000).optional() }),
  z.object({ tipo: z.literal('produto'), nome: z.string().min(1), preco: z.number().min(0), custo: z.number().min(0).default(0), checkout: z.string().default('') }),
  z.object({ tipo: z.literal('oferta'), nome: z.string().min(1), link: z.string().default(''), angulo: z.string().default(''), status: z.string().default('Monitorando') }),
  z.object({ tipo: z.literal('regra'), id: z.string().min(1), nome: z.string().min(1), perfil: z.enum(['teste','escala','manutencao']), gastoSemVenda: z.number().min(0).default(0), cpaMax: z.number().min(0).default(0), roasEscala: z.number().min(0).default(0), frequenciaMax: z.number().min(0).default(0), percentualEscala: z.number().min(0).max(100).default(20), tetoDiario: z.number().int().min(0).default(0), horas: z.tuple([z.number().min(0).max(24),z.number().min(0).max(24)]).default([0,24]), autonomia: z.enum(['auto','aprovar','avisar']) }),
]);
function parseAction(text: string) {
  const raw = text.match(/ACAO:\s*(\{[^\n]+\})/)?.[1];
  try { return raw ? actionSchema.parse(JSON.parse(raw)) : null; } catch { return null; }
}
export function CrowleyChat({ compact = false, agents = false }: { compact?: boolean; agents?: boolean }) {
  const [msgs, saveMsgs] = useStore<Msg[]>('crowley-messages', []);
  const [done, saveDone] = useStore<number[]>('crowley-approved-actions', []);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [executing, setExecuting] = useState<number | null>(null);
  const [account] = useAccount();
  const currency = useCurrency();
  const end = useRef<HTMLDivElement>(null);
  const chat = useServerFn(crowleyChat);
  const update = useServerFn(updateObject);
  const overview = useQuery({ queryKey: ['accounts-overview'], queryFn: () => getAccountsOverview(), staleTime: 600000 });
  const campaigns = useQuery({ queryKey: ['crowley-camps',account], enabled: !!account, queryFn: () => getObjects({data:{accountId:account,level:'campaigns',datePreset:'today'}}), staleTime: 900000 });
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [msgs,busy]);
  async function send() {
    const text = input.trim(); if (!text || busy) return;
    const next = [...msgs,{role:'user' as const,content:text}]; saveMsgs(next); setInput(''); setBusy(true);
    try {
      const context = JSON.stringify({ adAccountsHistory: (overview.data ?? []).map((a) => ({ id:a.id, name:a.name, bm:a.business, moeda:a.currency, status:a.status, criada:a.created, campanhasTotal:a.campaigns, gastoTotal:a.lifetimeSpend, comprasTotal:a.lifetimePurchases, receitaTotal:a.lifetimeRevenue, dinheiro:{ tipo:a.funds.kind, disponivel:a.funds.available, emAberto:a.funds.owed, nota:a.funds.label } })), account, currency: currency.source, campaigns: campaigns.data ?? [], products: readStore('products',[]), agents:readStore('intel-rules',[]), automations:readStore('automations',[]), offers:readStore('offers',[]), orders:readStore<any[]>('orders',[]).slice(0,50), contacts:readStore<any[]>('contacts',[]).length, now:new Date().toISOString() }).slice(0,19000);
      const result = await chat({data:{provider:'auto',persona:(localStorage.getItem('batgotham.crowley-persona')==='jarvis'?'jarvis':'parceiro'),messages:next.slice(-20),context}});
      if ('error' in result) toast.error(result.error);
      else saveMsgs([...next,{role:'assistant',content:result.text}]);
    } catch(e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  async function approve(index: number, a: z.infer<typeof actionSchema>) {
    if (executing !== null || done.includes(index)) return; setExecuting(index);
    try {
      if ('id' in a && a.id !== '*' && (a.tipo === 'status' || a.tipo === 'orcamento' || a.tipo === 'agendar' || a.tipo === 'regra') && !campaigns.data?.some((c) => c.id === a.id)) throw new Error('A campanha não pertence à conta carregada. Atualize as campanhas antes de confirmar.');
      if (a.tipo === 'regra') {
        if (!account) throw new Error('Selecione a conta do agente antes de aprovar.');
        if (!(a.gastoSemVenda || a.cpaMax || a.roasEscala || a.frequenciaMax)) throw new Error('Defina pelo menos uma condição para o agente.');
        const rule: IntelRule = {id:crypto.randomUUID(),name:a.nome,profile:a.perfil,campaignId:a.id,accountId:account,maxSpendNoSale:a.gastoSemVenda,maxCpa:a.cpaMax,minRoasToScale:a.roasEscala,scalePercent:a.percentualEscala,maxDailyBudget:a.tetoDiario,maxFrequency:a.frequenciaMax,hours:a.horas,autonomy:a.autonomia,active:true};
        localStorage.setItem('bg.intel-rules',JSON.stringify([...readStore<IntelRule[]>('intel-rules',[]),rule]));
        window.dispatchEvent(new Event('bg-store-change')); toast.success('Agente aprovado. Regras salvas para a vigia.');
      } else if (a.tipo === 'agendar') {
        const at = new Date(a.quando); if (!Number.isFinite(at.getTime()) || at.getTime() < Date.now()) throw new Error('Data inválida ou no passado.');
        const c = campaigns.data?.find((x) => x.id === a.id)!;
        if (a.acao === 'ORCAMENTO' && !a.valor) throw new Error('Falta o valor do orçamento.');
        await createJob({data:{runAt:at.toISOString(),job:{kind:'meta_update',payload:{id:a.id,label:a.acao==='ORCAMENTO'?`Orçamento de ${c.name} → ${a.valor}`:`${a.acao==='ACTIVE'?'Ativar':'Pausar'} ${c.name}`,actor:'crowley',...(a.acao==='ORCAMENTO'?{daily_budget:Math.round(a.valor!*100)}:{status:a.acao})}}}});
        toast.success(`Agendado para ${at.toLocaleString('pt-BR')}. Roda no servidor.`);
      } else if (a.tipo === 'lembrete') {
        const at = new Date(a.quando); if (!Number.isFinite(at.getTime())) throw new Error('Data inválida.');
        await createJob({data:{runAt:at.toISOString(),job:{kind:'notify',payload:{title:a.titulo,body:a.detalhe,actor:'crowley'}}}});
        toast.success('Lembrete agendado.');
      } else if (a.tipo === 'produto') {
        const list = readStore<any[]>('products',[]);
        localStorage.setItem('bg.products',JSON.stringify([{id:crypto.randomUUID(),name:a.nome,kind:'digital',price:a.preco,cost:a.custo,currency:currency.source==='USD'?'USD':'BRL',checkoutUrl:a.checkout,deliveryUrl:'',pageId:'',funnelName:'',campaignIds:'',offers:[],coupons:[],knowledge:''},...list]));
        window.dispatchEvent(new Event('bg-store-change')); toast.success('Produto criado.');
      } else if (a.tipo === 'oferta') {
        const list = readStore<any[]>('offers',[]);
        localStorage.setItem('bg.offers',JSON.stringify([{id:crypto.randomUUID(),name:a.nome,niche:'',status:a.status,library:a.link,page:'',creative:'',angle:a.angulo,price:'',notes:'Guardada pelo Crowley'},...list]));
        window.dispatchEvent(new Event('bg-store-change')); toast.success('Oferta guardada no radar.');
      } else if (a.tipo === 'automacao') {
        const list = readStore<{name:string;active:boolean}[]>('automations',[]);
        if (!list.some((x) => x.name.toLowerCase() === a.nome.toLowerCase())) throw new Error('Automação não encontrada.');
        localStorage.setItem('bg.automations',JSON.stringify(list.map(x => x.name.toLowerCase() === a.nome.toLowerCase() ? {...x,active:a.ativa}:x)));
        window.dispatchEvent(new Event('bg-store-change')); toast.success('Automação atualizada.');
      } else {
        await update({data:a.tipo === 'orcamento' ? {id:a.id,daily_budget:Math.round(a.valor*100),actor:'crowley'} : {id:a.id,status:a.status,actor:'crowley'}});
        await campaigns.refetch(); toast.success('Alteração confirmada.');
      }
      saveDone([...done,index]);
    } catch(e) { toast.error((e as Error).message); } finally {setExecuting(null);}
  }
  return <div className={`flex min-h-0 flex-col ${compact ? 'h-full' : 'h-[70dvh] min-h-[420px]'}`}>
    <div className="flex items-center gap-3 border-b border-border pb-3"><img src={portrait} width={48} height={48} className="h-12 w-12 rounded-full object-cover" alt="Crowley"/><div className="flex-1"><div className="font-display text-2xl">{agents ? 'Criar agente ADS' : 'Crowley'}</div><div className="text-xs text-muted-foreground">Às suas ordens, chefe.</div></div><Button variant="ghost" size="icon" aria-label="Limpar conversa" title="Limpar conversa" onClick={() => { if(window.confirm('Apagar o histórico desta conversa?')) {saveMsgs([]);saveDone([]);} }}><Trash2 className="h-4 w-4"/></Button></div>
    <div className="flex-1 space-y-4 overflow-y-auto py-4">
      {!msgs.length && <div className="py-8 text-center"><p className="text-lg">{agents ? 'Qual estratégia vamos acompanhar?' : 'Boa hora para uma nova operação.'}</p><p className="mt-2 text-sm text-muted-foreground">{agents ? 'Estou ouvindo, chefe.' : 'No que vamos trabalhar, chefe?'}</p></div>}
      {msgs.map((m,i) => {const a = m.role === 'assistant' ? parseAction(m.content) : null; return <div key={i} className={`max-w-[92%] break-words rounded-lg p-3 text-sm ${m.role === 'user' ? 'ml-auto bg-primary text-primary-foreground':'bg-secondary text-secondary-foreground'}`}><div className="chat-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content.replace(/ACAO:.*$/s,'').trim()}</ReactMarkdown></div>{a && <div className="mt-3 border-t border-border pt-3"><p className="mb-2 text-xs">{a.tipo === 'regra' ? `${a.nome} · ${a.autonomia === 'auto' ? 'agir sozinho' : a.autonomia === 'aprovar' ? 'pedir aprovação' : 'apenas avisar'} · ${currency.source}` : a.tipo === 'orcamento' ? `Orçamento diário: ${a.valor} ${currency.source}` : a.tipo === 'status' ? `${a.status === 'PAUSED' ? 'Pausar' : 'Ativar'} campanha` : a.tipo === 'agendar' ? `Agendar ${a.acao === 'ORCAMENTO' ? `orçamento ${a.valor}` : a.acao === 'ACTIVE' ? 'ativação' : 'pausa'} em ${new Date(a.quando).toLocaleString('pt-BR')}` : a.tipo === 'lembrete' ? `Lembrete: ${a.titulo} em ${new Date(a.quando).toLocaleString('pt-BR')}` : a.tipo === 'produto' ? `Criar produto ${a.nome} (${a.preco})` : a.tipo === 'oferta' ? `Guardar oferta ${a.nome} no radar` : `${a.ativa ? 'Ativar' : 'Pausar'} ${a.nome}`}</p><Button size="sm" disabled={done.includes(i) || executing !== null} onClick={() => approve(i,a)}><ShieldCheck className="h-4 w-4"/>{done.includes(i) ? 'Aprovado' : 'Aprovar ação'}</Button></div>}</div>})}
      {busy && <p className="animate-pulse text-sm text-muted-foreground">Crowley está preparando a resposta…</p>}<div ref={end}/>
    </div>
    <form className="flex items-end gap-2 border-t border-border pt-3" onSubmit={e=>{e.preventDefault();void send();}}><Textarea aria-label="Mensagem para Crowley" placeholder={agents ? 'Descreva a estratégia do agente…':'Fale com Crowley…'} rows={2} className="min-h-12 resize-none" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send();}}}/><Button size="icon" aria-label="Enviar mensagem" disabled={busy || !input.trim()}><Send className="h-4 w-4"/></Button></form>
    {!compact && <Button asChild variant="link" className="self-start px-0"><Link to={agents ? '/inteligencia':'/agentes'}>{agents ? 'Ver decisões e regras' : 'Agentes ADS'}</Link></Button>}
  </div>;
}
