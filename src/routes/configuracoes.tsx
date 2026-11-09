import { createFileRoute, Link } from '@tanstack/react-router';
import { useNavigate } from '@tanstack/react-router';
import { Cloud, LogOut, Plug } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { PageHead, head } from '@/components/ui-kit';
import { CurrencyToggle } from '@/components/currency-toggle';
import { PushButton } from '@/components/push-button';
export const Route = createFileRoute('/configuracoes')({head:()=>head('Configurações','Conta pessoal, sincronização, moeda e notificações do Bat Gotham.'),component:Settings});
function Settings(){
 const nav=useNavigate(); const user=useQuery({queryKey:['settings-user'],queryFn:async()=>{const {data,error}=await supabase.auth.getUser();if(error)throw error;return data.user;}});
 return <div className="space-y-7 p-4 sm:p-7"><PageHead title="Configurações"/><section className="space-y-4 border-y border-border py-6"><h2 className="font-display text-2xl">Acesso pessoal</h2><div className="flex items-center gap-3"><Cloud className="h-5 w-5 text-primary"/><div className="min-w-0"><p className="break-all text-sm">{user.data?.email ?? 'Consultando conta…'}</p><p className="text-xs text-muted-foreground">Sincronização da conta conectada</p></div></div><Button variant="outline" onClick={async()=>{await supabase.auth.signOut();await nav({to:'/entrar'});}}><LogOut className="h-4 w-4"/>Sair</Button></section><section className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6"><h2 className="font-display text-2xl">Moeda de exibição</h2><CurrencyToggle/></section><section className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6"><h2 className="font-display text-2xl">Alertas no aparelho</h2><PushButton/></section><section className="space-y-3"><h2 className="font-display text-2xl">Conexões</h2><div className="flex flex-wrap gap-3"><Button asChild variant="outline"><Link to="/utm/integracoes"><Plug className="h-4 w-4"/>Gateways e integrações</Link></Button><Button asChild variant="outline"><Link to="/ativos">Contas e ativos</Link></Button></div></section></div>;
}
