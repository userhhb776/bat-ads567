import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, RefreshCw, Wallet, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, Field, NativeSelect } from "@/components/ui-kit";
import { getAccountsOverview, getBusinesses, requestClientAccount, requestClientPage } from "@/lib/meta.functions";

const fmt = (v: number, c: string) => { try { return v.toLocaleString("pt-BR", { style: "currency", currency: c }); } catch { return `${c} ${v.toFixed(2)}`; } };

/** Money left and lifetime history of every ad account, best accounts first. */
export function AccountsMoney() {
  const q = useQuery({ queryKey: ["accounts-overview"], queryFn: () => getAccountsOverview(), staleTime: 600000 });
  const rows = [...(q.data ?? [])].sort((a, b) => b.lifetimeSpend - a.lifetimeSpend);
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2"><Wallet className="h-4 w-4 shrink-0 text-primary" /><b className="truncate">Saldo e histórico das contas</b></div>
        <Button size="icon" variant="ghost" aria-label="Atualizar" onClick={() => q.refetch()}><RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} /></Button>
      </div>
      {q.error && <p className="text-xs text-destructive">{(q.error as Error).message}</p>}
      {q.isLoading && <p className="text-xs text-muted-foreground">Consultando contas…</p>}
      <div className="space-y-2">
        {rows.map((a) => (
          <div key={a.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-md border border-border p-2 text-sm">
            <div className="min-w-0"><div className="truncate font-medium">{a.name}</div><div className="truncate text-[11px] text-muted-foreground">{a.business} · {a.campaigns} campanhas · gasto total {fmt(a.lifetimeSpend, a.currency)} · {a.lifetimePurchases} compras</div></div>
            <div className="text-right"><div className={`font-semibold ${a.funds.available !== null && a.funds.available < 20 ? "text-destructive" : "text-primary"}`}>{a.funds.available === null ? "—" : fmt(a.funds.available, a.currency)}</div><div className="text-[10px] text-muted-foreground">{a.funds.label}</div></div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">Você recebe um alerta no celular quando uma conta com campanha ativa tiver dinheiro para menos de um dia e meio.</p>
    </Card>
  );
}

/** Connects new profiles/BMs: official System User path plus agency access requests to other BMs' assets. */
export function ConnectBm() {
  const bms = useQuery({ queryKey: ["businesses"], queryFn: () => getBusinesses(), staleTime: 900000 });
  const [bm, setBm] = useState("");
  const [acc, setAcc] = useState("");
  const [page, setPage] = useState("");
  const [busy, setBusy] = useState(false);
  const id = bm || bms.data?.[0]?.id || "";
  const run = async (fn: () => Promise<{ access_status?: string }>) => { setBusy(true); try { const r = await fn(); toast.success(`Pedido enviado${r.access_status ? ` (${r.access_status})` : ""}. O dono aprova nas Configurações do Negócio dele.`); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); } };
  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2"><UserPlus className="h-4 w-4 text-primary" /><b>Conectar perfil ou BM novo</b></div>
      <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
        <li>Na BM nova, abra <a className="underline" target="_blank" rel="noreferrer" href="https://business.facebook.com/settings/system-users">Usuários do sistema</a> e crie um usuário <b>Administrador</b>.</li>
        <li>Em <b>Atribuir ativos</b>, marque as contas de anúncio, páginas e pixels com controle total.</li>
        <li>Em <a className="underline" target="_blank" rel="noreferrer" href="https://developers.facebook.com/apps">Meta for Developers</a>, adicione o seu app a essa BM e gere o token do usuário com <b>ads_management, business_management, pages_show_list, pages_manage_ads</b>.</li>
        <li>Troque o token na conexão nativa da Meta e toque em atualizar aqui.</li>
      </ol>
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" asChild><a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />Usuários do sistema</a></Button><Button size="sm" variant="outline" onClick={() => bms.refetch()}><RefreshCw className="h-4 w-4" />Atualizar BMs ({bms.data?.length ?? 0})</Button></div>
      <div className="border-t border-border pt-3 text-xs text-muted-foreground">Ou peça acesso direto a uma conta/página de outra BM (de um cliente ou parceiro). Ela entra na sua BM depois que o dono aprovar.</div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="Sua BM"><NativeSelect value={id} onChange={(e) => setBm(e.target.value)}>{bms.data?.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}</NativeSelect></Field>
        <Field label="ID da conta de anúncio"><div className="flex gap-1"><Input value={acc} onChange={(e) => setAcc(e.target.value.trim())} placeholder="act_123…" /><Button disabled={busy || !id || !acc} onClick={() => run(() => requestClientAccount({ data: { businessId: id, accountId: acc } }))}>Pedir</Button></div></Field>
        <Field label="ID da página"><div className="flex gap-1"><Input value={page} onChange={(e) => setPage(e.target.value.trim())} placeholder="1029…" /><Button disabled={busy || !id || !page} onClick={() => run(() => requestClientPage({ data: { businessId: id, pageId: page } }))}>Pedir</Button></div></Field>
      </div>
    </Card>
  );
}
