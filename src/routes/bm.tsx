import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { FlaskConical, RefreshCw, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, Empty, Field, NativeSelect, PageHead, head } from "@/components/ui-kit";
import { useAdAccounts } from "@/components/account-bar";
import { getBusinessDetail, getBusinesses, getPixelHealth, getStatus, sendTestEvent, shareObjectToAccount } from "@/lib/meta.functions";

export const Route = createFileRoute("/bm")({
  head: () => head("BMs e pixels", "Business Managers, contas, páginas, pessoas, catálogos e saúde dos pixels."),
  component: BusinessCenter,
});

const ACCOUNT_STATUS: Record<number, string> = { 1: "Ativa", 2: "Desativada", 3: "Pendência de pagamento", 7: "Em análise", 8: "Encerramento pendente", 9: "Em período de carência", 100: "Fechamento pendente", 101: "Fechada" };

function BusinessCenter() {
  const status = useQuery({ queryKey: ["meta-status"], queryFn: () => getStatus(), staleTime: 300000 });
  const list = useQuery({ queryKey: ["businesses"], queryFn: () => getBusinesses(), staleTime: 900000 });
  const [bm, setBm] = useState("");
  const id = bm || list.data?.[0]?.id || "";
  const detail = useQuery({ queryKey: ["bm", id], enabled: !!id, queryFn: () => getBusinessDetail({ data: { businessId: id } }), staleTime: 600000 });
  const d = detail.data;
  const Section = ({ title, block, render }: { title: string; block?: { items: any[]; error: string | null }; render: (x: any) => React.ReactNode }) => (
    <Card>
      <div className="mb-2 flex justify-between text-sm font-medium">{title}<span className="text-xs text-muted-foreground">{block?.items.length ?? 0}</span></div>
      {block?.error ? <p className="text-xs text-destructive">Sem permissão ou indisponível: {block.error.slice(0, 160)}</p> : !block?.items.length ? <p className="text-xs text-muted-foreground">Nada vinculado.</p> : <div className="max-h-64 space-y-1 overflow-y-auto">{block.items.map((x) => <div key={x.id} className="flex justify-between gap-2 border-b border-border py-1 text-xs">{render(x)}</div>)}</div>}
    </Card>
  );
  return (
    <div className="space-y-4 p-4 pb-24 md:p-6">
      <PageHead title="BMs e pixels" sub={status.data?.connected ? `Conectado como ${status.data.name}` : status.data ? `Conexão com problema: ${status.data.error}` : "Verificando conexão…"}>
        <Button size="sm" variant="outline" onClick={() => { void list.refetch(); void detail.refetch(); void status.refetch(); }}><RefreshCw className="h-4 w-4" />Atualizar</Button>
        <Button size="sm" variant="outline" asChild><Link to="/ativos">Criar conta / pixel</Link></Button>
      </PageHead>
      <p className="text-xs text-muted-foreground">Para adicionar outra BM, autorize-a na conexão da Meta (Conexões do workspace) e toque em Atualizar. Cartões e pagamentos são configurados direto na Meta.</p>
      {list.error ? <Empty>{(list.error as Error).message}</Empty> : !list.data?.length ? <Empty>{list.isLoading ? "Carregando…" : "Nenhuma BM autorizada nesta conexão."}</Empty> : (
        <>
          <NativeSelect value={id} onChange={(e) => setBm(e.target.value)}>{list.data.map((b) => <option key={b.id} value={b.id}>{b.name} · {b.id}</option>)}</NativeSelect>
          {detail.isLoading ? <Empty>Carregando BM…</Empty> : d && (
            <div className="space-y-3">
              <Card className="text-sm">
                {"error" in d.info ? <span className="text-destructive">{String((d.info as any).error)}</span> : <div className="flex flex-wrap gap-4"><span><b>{(d.info as any).name}</b></span><span className="text-muted-foreground">ID {(d.info as any).id}</span><span className="text-muted-foreground">Verificação: {(d.info as any).verification_status ?? "—"}</span></div>}
              </Card>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <Section title="Contas próprias" block={d.owned} render={(x) => <><span className="truncate">{x.name}</span><span className="text-muted-foreground">{x.currency} · {ACCOUNT_STATUS[x.account_status] ?? x.account_status}</span></>} />
                <Section title="Contas de clientes" block={d.client} render={(x) => <><span className="truncate">{x.name}</span><span className="text-muted-foreground">{ACCOUNT_STATUS[x.account_status] ?? x.account_status}</span></>} />
                <Section title="Páginas" block={d.pages} render={(x) => <><span className="truncate">{x.name}</span><span className="text-muted-foreground">{x.id}</span></>} />
                <Section title="Instagram" block={d.instagram} render={(x) => <span>@{x.username}</span>} />
                <Section title="Pessoas e permissões" block={d.people} render={(x) => <><span className="truncate">{x.name}</span><span className="text-muted-foreground">{x.role}</span></>} />
                <Section title="Catálogos" block={d.catalogs} render={(x) => <><span className="truncate">{x.name}</span><span className="text-muted-foreground">{x.product_count ?? 0} itens</span></>} />
              </div>
              <h2 className="font-display text-2xl">Pixels e conjuntos de dados</h2>
              {d.pixels.error ? <p className="text-xs text-destructive">{d.pixels.error}</p> : !d.pixels.items.length ? <Empty>Nenhum pixel nesta BM.</Empty> : d.pixels.items.map((p) => <PixelCard key={p.id} pixel={p} businessId={id} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PixelCard({ pixel, businessId }: { pixel: { id: string; name: string; last_fired_time?: string }; businessId: string }) {
  const [open, setOpen] = useState(false);
  const health = useQuery({ queryKey: ["pixel", pixel.id], enabled: open, queryFn: () => getPixelHealth({ data: { pixelId: pixel.id } }) });
  const accounts = useAdAccounts().accounts.data ?? [];
  const [test, setTest] = useState({ code: "", event: "PageView" as const, url: "https://" });
  const [share, setShare] = useState("");
  const [busy, setBusy] = useState(false);
  const last = pixel.last_fired_time ? new Date(pixel.last_fired_time) : null;
  const stale = !last || Date.now() - last.getTime() > 86400000;
  return (
    <Card className="space-y-3">
      <button className="flex w-full flex-wrap items-center gap-2 text-left text-sm" onClick={() => setOpen(!open)}>
        <span className={`h-2 w-2 rounded-full ${stale ? "bg-destructive" : "bg-primary"}`} /><b>{pixel.name}</b><span className="text-xs text-muted-foreground">{pixel.id}</span>
        <span className="ml-auto text-xs text-muted-foreground">Último evento: {last ? last.toLocaleString("pt-BR") : "nunca"}</span>
      </button>
      {open && (
        <div className="space-y-3">
          {health.isLoading ? <p className="text-xs text-muted-foreground">Consultando…</p> : health.error ? <p className="text-xs text-destructive">{(health.error as Error).message}</p> : (
            <div className="flex flex-wrap gap-2 text-xs">
              {health.data?.stats.length ? health.data.stats.map((s) => <span key={s.event} className="rounded-full border border-border px-2 py-0.5">{s.event}: {s.count.toLocaleString("pt-BR")}</span>) : <span className="text-muted-foreground">Sem estatísticas de eventos recentes disponíveis.</span>}
              <span className="rounded-full border border-border px-2 py-0.5">Correspondência automática: {health.data?.info?.enable_automatic_matching ? "ligada" : "desligada"}</span>
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-4">
            <Field label="Código de teste (Gerenciador de Eventos)"><Input value={test.code} onChange={(e) => setTest({ ...test, code: e.target.value })} placeholder="TEST12345" /></Field>
            <Field label="Evento"><NativeSelect value={test.event} onChange={(e) => setTest({ ...test, event: e.target.value as never })}>{["PageView", "ViewContent", "Lead", "AddToCart", "InitiateCheckout", "Purchase"].map((e) => <option key={e}>{e}</option>)}</NativeSelect></Field>
            <Field label="URL da página"><Input value={test.url} onChange={(e) => setTest({ ...test, url: e.target.value })} /></Field>
            <Button className="self-end" disabled={busy || !test.code} onClick={async () => { setBusy(true); try { const r = await sendTestEvent({ data: { pixelId: pixel.id, testCode: test.code, event: test.event, url: test.url } }); toast.success(`Meta recebeu ${r.received} evento(s) via Conversions API. ID ${r.eventId}`); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); } }}><FlaskConical className="h-4 w-4" />Testar CAPI</Button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Compartilhar com a conta"><NativeSelect value={share} onChange={(e) => setShare(e.target.value)}><option value="">Escolha</option>{accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</NativeSelect></Field>
            <Button variant="outline" disabled={busy || !share} onClick={async () => { setBusy(true); try { await shareObjectToAccount({ data: { pixelId: pixel.id, businessId, accountId: share } }); toast.success("Pixel compartilhado com a conta."); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); } }}><Share2 className="h-4 w-4" />Compartilhar</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
