import { useEffect } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { head } from '@/components/ui-kit';
import { CrowleyChat } from '@/components/crowley/chat';
import { AccountBar } from '@/components/account-bar';
import { useAccount } from '@/lib/use-account';
export const Route=createFileRoute('/crowley')({head:()=>head('Crowley','Seu parceiro de operação no Bat Gotham, em tela cheia.'),component:Crowley});
function Crowley(){
  const [account,setAccount]=useAccount();
  // Lets the phone install Crowley as his own home-screen app.
  useEffect(()=>{const l=document.querySelector<HTMLLinkElement>('link[rel="manifest"]');const old=l?.href;if(l)l.href='/crowley.webmanifest';return()=>{if(l&&old)l.href=old;};},[]);
  return <div className="mx-auto flex h-[100dvh] max-w-3xl flex-col gap-2 p-3 sm:p-5"><div className="flex items-center justify-between gap-2"><Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground"><ArrowLeft className="h-4 w-4"/>Painel</Link><div className="min-w-0 max-w-[70%]"><AccountBar account={account} setAccount={setAccount}/></div></div><div className="min-h-0 flex-1"><CrowleyChat compact/></div><p className="text-center text-[10px] text-muted-foreground">Para instalar só o Crowley: menu do navegador → Adicionar à tela inicial.</p></div>;
}
