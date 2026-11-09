import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CrowleyChat } from './chat';
import portrait from '@/assets/crowley-portrait.jpg';
export function FloatingCrowley() {
 const [open,setOpen]=useState(false);
 return <><Button variant="outline" aria-label="Conversar com Crowley" title="Conversar com Crowley" className="fixed bottom-20 right-4 z-40 h-12 w-12 rounded-full border-primary p-0 md:bottom-5" onClick={()=>setOpen(true)}><img src={portrait} alt="" width={48} height={48} loading="lazy" className="h-full w-full rounded-full object-cover"/></Button><Sheet open={open} onOpenChange={setOpen}><SheetContent className="flex w-full flex-col px-4 pb-5 sm:max-w-md"><SheetHeader><SheetTitle className="sr-only">Conversa com Crowley</SheetTitle></SheetHeader><CrowleyChat compact/></SheetContent></Sheet></>;
}
