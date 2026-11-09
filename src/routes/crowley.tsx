import { createFileRoute } from '@tanstack/react-router';
import { PageHead, head } from '@/components/ui-kit';
import { CrowleyChat } from '@/components/crowley/chat';
import { AccountBar } from '@/components/account-bar';
import { useAccount } from '@/lib/use-account';
export const Route=createFileRoute('/crowley')({head:()=>head('Crowley','Seu mordomo e estrategista pessoal no Bat Gotham.'),component:Crowley});
function Crowley(){const [account,setAccount]=useAccount();return <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-7"><PageHead title="Crowley"/><AccountBar account={account} setAccount={setAccount}/><CrowleyChat/></div>;}
