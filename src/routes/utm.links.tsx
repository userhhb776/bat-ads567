import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { Copy, Link2, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, Field, NativeSelect, Empty, head } from '@/components/ui-kit';
import { urlParamsTemplate } from '@/lib/tracking/utm';
import { useStore, uid, download, toCsv } from '@/lib/store';
import type { Product } from '@/lib/biz';

export const Route = createFileRoute('/utm/links')({ head: () => head('Links rastreados', 'Gerador de links UTM com histórico por produto e oferta.'), component: LinksPage });

type SavedLink = { id: string; name: string; url: string; productId: string; offer: string; createdAt: number; params: Record<string, string> };
const BASE = { utm_source: '', utm_medium: '', utm_campaign: '', utm_content: '', utm_term: '' };

/** Builds the final URL; only http(s) destinations are accepted. */
export function buildLink(base: string, params: Record<string, string>) {
  try { const url = new URL(base); if (!['https:', 'http:'].includes(url.protocol)) return ''; for (const [k, v] of Object.entries(params)) if (k.trim() && v.trim()) url.searchParams.set(k.trim(), v.trim()); return url.toString(); } catch { return ''; }
}

function LinksPage() {
  const [base, setBase] = useState('');
  const [params, setParams] = useState<Record<string, string>>(BASE);
  const [custom, setCustom] = useState<{ k: string; v: string }[]>([]);
  const [meta, setMeta] = useState({ name: '', productId: '', offer: '' });
  const [links, setLinks] = useStore<SavedLink[]>('utm-links', []);
  const [products] = useStore<Product[]>('products', []);
  const [filter, setFilter] = useState('');
  const all = { ...params, ...Object.fromEntries(custom.map((c) => [c.k, c.v])) };
  const result = useMemo(() => buildLink(base, all), [base, JSON.stringify(all)]);
  async function copy(value: string) { try { await navigator.clipboard.writeText(value); toast.success('Copiado'); } catch { toast.error('Não foi possível copiar.'); } }
  function save() { if (!result) return; setLinks([{ id: uid(), name: meta.name || params['utm_campaign'] || 'Link', url: result, productId: meta.productId, offer: meta.offer, createdAt: Date.now(), params: all }, ...links]); toast.success('Salvo no histórico.'); }
  const shown = links.filter((l) => !filter || l.productId === filter);
  return <div className="max-w-5xl space-y-5 p-4 pb-24 sm:p-7">
    <header><div className="text-xs text-primary">RASTREAMENTO</div><h1 className="mt-2 font-display text-4xl">Links de campanha</h1></header>
    <Card className="space-y-3">
      <Field label="URL de destino"><Input type="url" placeholder="https://" value={base} onChange={(e) => setBase(e.target.value)} /></Field>
      <div className="grid gap-2 sm:grid-cols-5">{Object.keys(BASE).map((k) => <Field key={k} label={k}><Input value={params[k]} onChange={(e) => setParams({ ...params, [k]: e.target.value })} /></Field>)}</div>
      {custom.map((c, i) => <div key={i} className="flex gap-2"><Input placeholder="parâmetro" value={c.k} onChange={(e) => setCustom(custom.map((x, j) => j === i ? { ...x, k: e.target.value } : x))} /><Input placeholder="valor" value={c.v} onChange={(e) => setCustom(custom.map((x, j) => j === i ? { ...x, v: e.target.value } : x))} /><Button variant="ghost" size="sm" onClick={() => setCustom(custom.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button></div>)}
      <Button size="sm" variant="outline" onClick={() => setCustom([...custom, { k: '', v: '' }])}><Plus className="h-3 w-3" />Parâmetro personalizado</Button>
      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="Nome"><Input value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} /></Field>
        <Field label="Produto"><NativeSelect value={meta.productId} onChange={(e) => setMeta({ ...meta, productId: e.target.value })}><option value="">—</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</NativeSelect></Field>
        <Field label="Oferta"><Input value={meta.offer} onChange={(e) => setMeta({ ...meta, offer: e.target.value })} /></Field>
      </div>
      <div className="break-all rounded-md border border-border bg-muted p-3 text-xs">{result || 'Informe uma URL válida.'}</div>
      <div className="flex gap-2"><Button disabled={!result} onClick={() => copy(result)}><Copy className="h-4 w-4" />Copiar</Button><Button variant="outline" disabled={!result} onClick={save}><Link2 className="h-4 w-4" />Salvar no histórico</Button></div>
    </Card>
    <Card className="space-y-2">
      <div className="text-sm font-medium">Parâmetros dinâmicos para anúncios Meta</div>
      <div className="flex gap-2"><code className="flex-1 break-all rounded bg-muted p-2 text-[11px]">{urlParamsTemplate('meta')}</code><Button size="sm" variant="outline" onClick={() => copy(urlParamsTemplate('meta'))}><Copy className="h-3 w-3" /></Button></div>
    </Card>
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-display text-2xl">Histórico</h2><div className="flex gap-2"><NativeSelect value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">Todos os produtos</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</NativeSelect><Button size="sm" variant="outline" onClick={() => download('links-utm.csv', toCsv(shown.map((l) => ({ nome: l.name, url: l.url, produto: products.find((p) => p.id === l.productId)?.name ?? '', oferta: l.offer, criado: new Date(l.createdAt).toISOString() }))))}>CSV</Button></div></div>
    {!shown.length ? <Empty>Nenhum link salvo.</Empty> : shown.map((l) => <Card key={l.id} className="flex items-center gap-2 py-2 text-xs"><div className="min-w-0 flex-1"><div className="font-medium">{l.name}{l.offer ? ` · ${l.offer}` : ''}</div><div className="truncate text-muted-foreground">{l.url}</div></div><Button size="sm" variant="ghost" onClick={() => copy(l.url)}><Copy className="h-3 w-3" /></Button><Button size="sm" variant="ghost" onClick={() => setLinks(links.filter((x) => x.id !== l.id))}><Trash2 className="h-3 w-3" /></Button></Card>)}
  </div>;
}
