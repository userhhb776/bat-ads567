import { useQuery } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { getAdAccounts, getStatus } from "@/lib/meta.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AccountBar({
  account,
  setAccount,
  children,
}: {
  account: string;
  setAccount: (id: string) => void;
  children?: ReactNode;
}) {
  const status = useQuery({ queryKey: ["meta-status"], queryFn: () => getStatus() });
  const accounts = useQuery({
    queryKey: ["meta-accounts"],
    queryFn: () => getAdAccounts(),
    enabled: !!status.data?.connected,
  });

  useEffect(() => {
    if (!account && accounts.data?.[0]) setAccount(accounts.data[0].id);
  }, [account, accounts.data, setAccount]);

  if (status.isLoading) return <div className="text-sm text-muted-foreground">Conectando…</div>;
  if (!status.data?.connected)
    return (
      <div className="rounded-lg border border-destructive/50 bg-card p-4 text-sm">
        <div className="font-semibold text-destructive">Conta de anúncios não conectada</div>
        <div className="mt-1 text-muted-foreground">
          Adicione o token de acesso da Meta para carregar suas contas e campanhas.
          {"error" in status.data! && status.data.error ? ` (${status.data.error})` : ""}
        </div>
      </div>
    );

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div>
        <div className="mb-1 text-xs text-muted-foreground">Conta de anúncio</div>
        <Select value={account} onValueChange={setAccount}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Escolha a conta" />
          </SelectTrigger>
          <SelectContent>
            {accounts.data?.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name} ({a.id.replace("act_", "")})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {children}
      <div className="ml-auto text-xs text-muted-foreground">Conectado como {status.data.name}</div>
    </div>
  );
}
