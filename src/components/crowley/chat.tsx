import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Link, useRouterState } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { blocksToHtml, BLOCKS, type BlockType } from '@/lib/page-blocks';
import { loadPages, savePages } from '@/lib/pages';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Trash2, ShieldCheck, Paperclip, Mic, MicOff } from 'lucide-react';
import { transcribeVoice, speakVoice } from '@/lib/voice.functions';
import { getVoiceSettings, speakable, blobToB64, recordUtterance } from '@/lib/voice-client';
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
  z.object({ tipo: z.literal('funil'), nome: z.string().min(1).max(80), etapas: z.array(z.object({ tipo: z.string().min(1), nome: z.string().min(1), conversao: z.number().min(0).max(100).default(30), preco: z.number().min(0).optional(), verba: z.number().min(0).optional() })).min(2).max(15) }),
  z.object({ tipo: z.literal('pagina'), nome: z.string().min(1).max(80), produto: z.string().default(''), checkout: z.string().default(''), blocos: z.array(z.object({ tipo: z.enum(['hero','video','beneficios','oferta','depoimentos','faq','cta','rodape']), titulo: z.string().default(''), texto: z.string().default(''), itens: z.array(z.string()).default([]), extra: z.string().default('') })).min(1).max(20) }),
  z.object({ tipo: z.literal('notificar'), titulo: z.string().min(1).max(120), detalhe: z.string().max(1000).optional() }),
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
  const route = useRouterState({ select: (s) => s.location.pathname });
  const [uploading, setUploading] = useState(false);
  async function attach(files: FileList | null) {
    if (!files?.length) return; setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser(); if (!u.user) throw new Error('Entre na conta para enviar arquivos.');
      const names: string[] = []; const added: any[] = [];
      for (const f of [...files]) {
        const id = crypto.randomUUID(); const path = `${u.user.id}/${id}-${f.name.replace(/[^\w.-]/g, '_')}`;
        const { error } = await supabase.storage.from('creatives').upload(path, f, { contentType: f.type });
        if (error) { toast.error(`${f.name}: ${error.message}`); continue; }
        added.push({ id, name: f.name, kind: f.type.startsWith('video') ? 'video' : 'image', path, size: f.size, tags: [], category: '', productId: '', campaignId: '', adIds: [], notes: 'Enviado no chat do Crowley', createdAt: Date.now() }); names.push(f.name);
      }
      if (added.length) { localStorage.setItem('bg.creatives', JSON.stringify([...added, ...readStore<any[]>('creatives', [])])); window.dispatchEvent(new Event('bg-store-change')); setInput((t) => `${t}${t ? '\n' : ''}[Anexei na Central de Criativos: ${names.join(', ')}]`); toast.success('Arquivo guardado em Criativos.'); }
    } catch (e) { toast.error((e as Error).message); } finally { setUploading(false); }
  }
  const chat = useServerFn(crowleyChat);
  const update = useServerFn(updateObject);
  const overview = useQuery({ queryKey: ['accounts-overview'], queryFn: () => getAccountsOverview(), staleTime: 600000 });
  const campaigns = useQuery({ queryKey: ['crowley-camps',account], enabled: !!account, queryFn: () => getObjects({data:{accountId:account,level:'campaigns',datePreset:'today'}}), staleTime: 900000 });
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [msgs,busy]);
  const msgsRef = useRef(msgs); msgsRef.current = msgs;
  const stt = useServerFn(transcribeVoice); const tts = useServerFn(speakVoice);
  const [voice, setVoice] = useState<'off'|'ouvindo'|'pensando'|'falando'>('off');
  const voiceSig = useRef({ stop: true }); const audioRef = useRef<HTMLAudioElement | null>(null);
  // Push-to-talk: só grava enquanto o dedo está no botão; tocar enquanto ele fala/pensa interrompe.
  const recRef = useRef<{ rec: MediaRecorder; stream: MediaStream; chunks: Blob[]; at: number } | null>(null);
  async function holdStart() {
    voiceSig.current.stop = true; audioRef.current?.pause();
    if (recRef.current) return;
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch { toast.error('Libere o microfone para falar com o Crowley.'); setVoice('off'); return; }
    const rec = new MediaRecorder(stream); const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.start(200); recRef.current = { rec, stream, chunks, at: Date.now() }; setVoice('ouvindo');
  }
  async function holdEnd() {
    const r = recRef.current; if (!r) return; recRef.current = null;
    await new Promise<void>((res) => { r.rec.onstop = () => res(); r.rec.stop(); });
    r.stream.getTracks().forEach((t) => t.stop());
    if (Date.now() - r.at < 500 || !r.chunks.length) { setVoice('off'); toast('Segure o microfone enquanto fala, chefe.'); return; }
    const sig = { stop: false }; voiceSig.current = sig;
    try {
      const blob = new Blob(r.chunks, { type: r.rec.mimeType || 'audio/webm' });
      setVoice('pensando');
      const t = await stt({ data: { audio: await blobToB64(blob), mime: blob.type } });
      if ('error' in t) { toast.error(t.error); return; } if (!t.text || sig.stop) return;
      const reply = await send(t.text); if (sig.stop || !reply) return;
      const said = speakable(reply); if (!said) return;
      const a = await tts({ data: { text: said, ...getVoiceSettings() } }); if ('error' in a) { toast.error(a.error); return; }
      if (sig.stop) return; setVoice('falando');
      await new Promise<void>((res) => { const el = new Audio(`data:audio/mpeg;base64,${a.audio}`); audioRef.current = el; el.onended = () => res(); el.onerror = () => res(); el.onpause = () => res(); el.play().catch(() => res()); });
    } finally { if (voiceSig.current === sig && !recRef.current) setVoice('off'); }
  }
  void recordUtterance;
  useEffect(() => () => { voiceSig.current.stop = true; audioRef.current?.pause(); }, []);
  async function send(spoken?: string): Promise<string | null> {
    const text = (spoken ?? input).trim(); if (!text || (busy && !spoken)) return null;
    const msgs = msgsRef.current;
    const next = [...msgs,{role:'user' as const,content:text}]; saveMsgs(next); msgsRef.current = next; if (!spoken) setInput(''); setBusy(true);
    try {
      const context = JSON.stringify({ adAccountsHistory: (overview.data ?? []).map((a) => ({ id:a.id, name:a.name, bm:a.business, moeda:a.currency, status:a.status, criada:a.created, campanhasTotal:a.campaigns, gastoTotal:a.lifetimeSpend, comprasTotal:a.lifetimePurchases, receitaTotal:a.lifetimeRevenue, dinheiro:{ tipo:a.funds.kind, disponivel:a.funds.available, emAberto:a.funds.owed, nota:a.funds.label } })), account, currency: currency.source, campaigns: campaigns.data ?? [], products: readStore('products',[]), agents:readStore('intel-rules',[]), automations:readStore('automations',[]), offers:readStore('offers',[]), telaAtual:route, funis:readStore<any[]>('funnels',[]).map(f=>f.name), paginas:loadPages().map(p=>({nome:p.name,url:p.publishedUrl})), criativos:readStore<any[]>('creatives',[]).slice(0,15).map(c=>({nome:c.name,tipo:c.kind})), orders:readStore<any[]>('orders',[]).slice(0,50), contacts:readStore<any[]>('contacts',[]).length, now:new Date().toISOString() }).slice(0,19000);
      const result = await chat({data:{provider:'auto',persona:(localStorage.getItem('batgotham.crowley-persona')==='jarvis'?'jarvis':'parceiro'),messages:next.slice(-20),context}});
      if ('error' in result) { toast.error(result.error); return null; }
      const after = [...next,{role:'assistant' as const,content:result.text}]; saveMsgs(after); msgsRef.current = after; return result.text;
    } catch(e) { toast.error((e as Error).message); return null; } finally { setBusy(false); }
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
      } else if (a.tipo === 'funil') {
        const ids = a.etapas.map((_, k) => `s${k}-${crypto.randomUUID().slice(0, 6)}`);
        const nodes = a.etapas.map((e, k) => ({ id: ids[k]!, type: 'step', position: { x: k * 300, y: 120 }, data: { kind: e.tipo, label: e.nome, conversionRate: e.conversao, ...(e.preco ? { price: e.preco } : {}), ...(e.verba ? { budget: e.verba, cpc: 1.5, conversionRate: 100 } : {}) } }));
        const edges = ids.slice(1).map((t, k) => ({ id: `e${k}`, source: ids[k]!, target: t, type: 'conversion', data: { share: 100 } }));
        localStorage.setItem('bg.funnels', JSON.stringify([{ id: crypto.randomUUID(), name: a.nome, nodes, edges, updatedAt: Date.now() }, ...readStore<any[]>('funnels', [])]));
        window.dispatchEvent(new Event('bg-store-change')); toast.success(`Funil "${a.nome}" criado. Abra em Funis → Funis salvos.`);
      } else if (a.tipo === 'pagina') {
        const blocks = a.blocos.map((b) => ({ ...BLOCKS[b.tipo as BlockType].make(), id: crypto.randomUUID(), type: b.tipo as BlockType, ...(b.titulo ? { title: b.titulo } : {}), ...(b.texto ? { text: b.texto } : {}), ...(b.itens.length ? { items: b.itens } : {}), ...(b.extra ? { extra: b.extra } : {}) }));
        const style = { bg: '#0b0c10', fg: '#f4f4f5', accent: '#f5b301' };
        savePages([{ id: crypto.randomUUID(), name: a.nome, product: a.produto, checkoutUrl: a.checkout, pixelId: '', blocks, style, versions: [{ at: Date.now(), html: blocksToHtml(blocks, style, a.nome), note: 'Criada pelo Crowley' }] }, ...loadPages()]);
        window.dispatchEvent(new Event('bg-store-change')); toast.success(`Página "${a.nome}" criada como rascunho em Páginas.`);
      } else if (a.tipo === 'notificar') {
        await createJob({data:{runAt:new Date().toISOString(),job:{kind:'notify',payload:{title:a.titulo,body:a.detalhe,actor:'crowley'}}}});
        toast.success('Aviso enviado.');
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
    <div className="flex items-center gap-3 border-b border-border pb-3"><img src={portrait} width={48} height={48} className="h-12 w-12 rounded-full object-cover ring-1 ring-primary" alt="Crowley"/><div className="flex-1"><div className="font-display text-2xl">{agents ? 'Criar agente ADS' : 'Crowley'}</div><div className="text-xs text-muted-foreground">{voice==='ouvindo'?'Ouvindo… solte quando terminar.':voice==='pensando'?'Pensando… toque no microfone para interromper.':voice==='falando'?'Falando… toque no microfone para interromper.':'Segure o microfone para falar.'}</div></div><Button variant={voice==='off'?'outline':'default'} size="icon" aria-label="Segure para falar com o Crowley" title="Segure para falar" className={`touch-none select-none ${voice==='ouvindo'?'scale-110 animate-pulse':''}`} onContextMenu={(e)=>e.preventDefault()} onPointerDown={(e)=>{e.preventDefault();(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);void holdStart();}} onPointerUp={()=>void holdEnd()} onPointerCancel={()=>void holdEnd()}>{voice==='falando'||voice==='pensando'?<MicOff className="h-4 w-4"/>:<Mic className="h-4 w-4"/>}</Button><Button variant="ghost" size="icon" aria-label="Limpar conversa" title="Limpar conversa" onClick={() => { if(window.confirm('Apagar o histórico desta conversa?')) {saveMsgs([]);saveDone([]);} }}><Trash2 className="h-4 w-4"/></Button></div>
    <div className="flex-1 space-y-4 overflow-y-auto py-4">
      {!msgs.length && <div className="py-8 text-center"><p className="text-lg">{agents ? 'Qual estratégia vamos acompanhar?' : 'Boa hora para uma nova operação.'}</p><p className="mt-2 text-sm text-muted-foreground">{agents ? 'Estou ouvindo, chefe.' : 'No que vamos trabalhar, chefe?'}</p></div>}
      {msgs.map((m,i) => {const a = m.role === 'assistant' ? parseAction(m.content) : null; return <div key={i} className={`max-w-[92%] break-words rounded-lg p-3 text-sm ${m.role === 'user' ? 'ml-auto bg-primary text-primary-foreground':'bg-secondary text-secondary-foreground'}`}><div className="chat-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content.replace(/ACAO:.*$/s,'').trim()}</ReactMarkdown></div>{a && <div className="mt-3 border-t border-border pt-3"><p className="mb-2 text-xs">{a.tipo === 'regra' ? `${a.nome} · ${a.autonomia === 'auto' ? 'agir sozinho' : a.autonomia === 'aprovar' ? 'pedir aprovação' : 'apenas avisar'} · ${currency.source}` : a.tipo === 'orcamento' ? `Orçamento diário: ${a.valor} ${currency.source}` : a.tipo === 'status' ? `${a.status === 'PAUSED' ? 'Pausar' : 'Ativar'} campanha` : a.tipo === 'agendar' ? `Agendar ${a.acao === 'ORCAMENTO' ? `orçamento ${a.valor}` : a.acao === 'ACTIVE' ? 'ativação' : 'pausa'} em ${new Date(a.quando).toLocaleString('pt-BR')}` : a.tipo === 'lembrete' ? `Lembrete: ${a.titulo} em ${new Date(a.quando).toLocaleString('pt-BR')}` : a.tipo === 'produto' ? `Criar produto ${a.nome} (${a.preco})` : a.tipo === 'oferta' ? `Guardar oferta ${a.nome} no radar` : a.tipo === 'funil' ? `Criar funil ${a.nome} (${a.etapas.length} etapas)` : a.tipo === 'pagina' ? `Criar página ${a.nome} (${a.blocos.length} blocos)` : a.tipo === 'notificar' ? `Enviar aviso: ${a.titulo}` : `${a.ativa ? 'Ativar' : 'Pausar'} ${a.nome}`}</p><Button size="sm" disabled={done.includes(i) || executing !== null} onClick={() => approve(i,a)}><ShieldCheck className="h-4 w-4"/>{done.includes(i) ? 'Aprovado' : 'Aprovar ação'}</Button></div>}</div>})}
      {busy && <p className="animate-pulse text-sm text-muted-foreground">Crowley está preparando a resposta…</p>}<div ref={end}/>
    </div>
    <form className="flex items-end gap-2 border-t border-border pt-3" onSubmit={e=>{e.preventDefault();void send();}}><label aria-label="Anexar imagem ou vídeo" title="Anexar imagem ou vídeo" className={`inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border ${uploading?'animate-pulse':''}`}><Paperclip className="h-4 w-4"/><input type="file" multiple accept="image/*,video/*" className="hidden" disabled={uploading} onChange={e=>{void attach(e.target.files); e.target.value='';}}/></label><Textarea aria-label="Mensagem para Crowley" placeholder={agents ? 'Descreva a estratégia do agente…':'Fale com Crowley…'} rows={2} className="min-h-12 resize-none" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send();}}}/><Button size="icon" aria-label="Enviar mensagem" disabled={busy || !input.trim()}><Send className="h-4 w-4"/></Button></form>
    {!compact && <Button asChild variant="link" className="self-start px-0"><Link to={agents ? '/inteligencia':'/agentes'}>{agents ? 'Ver decisões e regras' : 'Agentes ADS'}</Link></Button>}
  </div>;
}
