import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { Copy, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { urlParamsTemplate } from '@/lib/tracking/utm';

export const Route = createFileRoute('/utm/links')({
  head: () => ({ meta: [
    { title: 'Links rastreados — Bat Gotham' },
    { name: 'description', content: 'Crie links com origem, campanha e criativo para sua operação.' },
    { property: 'og:title', content: 'Links rastreados — Bat Gotham' },
    { property: 'og:description', content: 'Parâmetros de campanha e links rastreados do Bat Gotham.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ] }), component: LinksPage,
});
function LinksPage() {
  const [base,setBase] = useState('');
  const [params,setParams] = useState({utm_source:'',utm_medium:'',utm_campaign:'',utm_content:'',utm_term:''});
  const result = useMemo(() => { try { const url=new URL(base); if (!['https:','http:'].includes(url.protocol)) return ''; for (const [key,value] of Object.entries(params)) { if(value.trim()) url.searchParams.set(key,value.trim()); } return url.toString(); } catch { return ''; } },[base,params]);
  async function copy(value:string) { try { await navigator.clipboard.writeText(value); toast.success('Copiado'); } catch { toast.error('Não foi possível copiar.'); } }
  return <div className="max-w-4xl space-y-6 p-4 sm:p-7"><header><div className="text-xs text-primary">RASTREAMENTO</div><h1 className="mt-2 font-display text-4xl">Links de campanha</h1></header><label className="block space-y-2 text-sm">URL de destino<Input aria-label="URL de destino" type="url" placeholder="https://" value={base} onChange={(e)=>setBase(e.target.value)} /></label><div className="grid gap-4 sm:grid-cols-2">{Object.entries(params).map(([key,value])=><label key={key} className="space-y-2 text-sm"><span>{{utm_source:'Origem',utm_medium:'Mídia / conjunto',utm_campaign:'Campanha',utm_content:'Conteúdo / anúncio',utm_term:'Termo'}[key]}</span><Input aria-label={key} value={value} onChange={(e)=>setParams({...params,[key]:e.target.value})} /></label>)}</div><section className="border-y border-border py-5"><h2 className="mb-3 flex items-center gap-2 font-display text-2xl"><Link2 className="h-5 w-5 text-primary" />Link final</h2><div className="flex items-start gap-3"><output className="min-w-0 flex-1 break-all text-sm text-muted-foreground">{result || '—'}</output><Button size="icon" disabled={!result} aria-label="Copiar link" title="Copiar link" onClick={()=>copy(result)}><Copy /></Button></div></section><section><h2 className="mb-3 font-display text-2xl">Parâmetros dinâmicos dos anúncios</h2><div className="flex items-start gap-3"><code className="min-w-0 flex-1 break-all text-xs text-muted-foreground">{urlParamsTemplate('meta')}</code><Button size="icon" variant="secondary" aria-label="Copiar parâmetros" title="Copiar parâmetros" onClick={()=>copy(urlParamsTemplate('meta'))}><Copy /></Button></div></section></div>;
}