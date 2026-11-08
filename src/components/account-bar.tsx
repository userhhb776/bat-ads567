import { useQuery } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { getAdAccounts, getStatus } from "@/lib/meta.functions";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { currencyStore } from "@/lib/currency";

export function useAdAccounts() {
  const status = useQuery({ queryKey: ["meta-status"], queryFn: () => getStatus(), staleTime: 5 * 60_000 });
  const accounts = useQuery({ queryKey: ["meta-accounts"], queryFn: () => getAdAccounts(), enabled: !!status.data?.connected, staleTime: 5 * 60_000 });
  return { status, accounts };
}

export function AccountBar({ account, setAccount, children }: { account: string; setAccount: (id: string) => void; children?: ReactNode }) {
  const { status, accounts } = useAdAccounts();

  useEffect(() => {
    if (accounts.data?.length && !accounts.data.some((a) => a.id === account)) setAccount(accounts.data[0]!.id);
  }, [account, accounts.data, setAccount]);
  useEffect(() => {
    const cur = accounts.data?.find((a) => a.id === account)?.currency;
    if (cur) currencyStore.setSource(cur);
  }, [account, accounts.data]);

  if (status.isLoading) return <div className="text-sm text-muted-foreground">Conectando…</div>;
  if (!status.data?.connected)
    return (
      <div className="rounded-lg border border-destructive/50 bg-card p-4 text-sm">
        <div className="font-semibold text-destructive">Conta da Meta não conectada</div>
        <div className="mt-1 break-words text-muted-foreground">{status.data?.error}</div>
      </div>
    );

  const groups = new Map<string, NonNullable<typeof accounts.data>>();
  for (const a of accounts.data ?? []) groups.set(a.business, [...(groups.get(a.business) ?? []), a]);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:flex sm:flex-wrap sm:gap-4">
      <div className="min-w-0">
        <div className="mb-1 text-xs text-muted-foreground">Conta de anúncio · {accounts.data?.length ?? 0} disponíveis</div>
        <Select value={account} onValueChange={setAccount}>
          <SelectTrigger className="w-full sm:w-80"><SelectValue placeholder="Escolha a conta" /></SelectTrigger>
          <SelectContent>
            {[...groups.entries()].map(([biz, list]) => (
              <SelectGroup key={biz}>
                <SelectLabel>{biz}</SelectLabel>
                {list.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} · {a.currency} {a.account_status !== 1 ? "(inativa)" : ""}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="secondary" size="sm" className="shrink-0"><Plus className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Conectar mais</span></Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 text-sm">
          <div className="font-semibold">Adicionar contas ou BMs</div>
          <p className="mt-2 text-muted-foreground">
            Todas as contas que o seu perfil do Facebook acessa aparecem aqui automaticamente, de qualquer BM. Para incluir outra BM ou perfil,
            reconecte a Meta nos conectores do Lovable e marque as novas contas e páginas.
          </p>
          <Button size="sm" className="mt-3 w-full" onClick={() => { accounts.refetch(); }}>Atualizar lista de contas</Button>
        </PopoverContent>
      </Popover>
      {children}
      <div className="col-span-2 text-xs text-muted-foreground sm:ml-auto sm:self-center">Conectado como {status.data.name}</div>
    </div>
  );
}
