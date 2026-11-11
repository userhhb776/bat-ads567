import { createFileRoute } from "@tanstack/react-router";
import { PageHead, head } from "@/components/ui-kit";
import { SpyAdCard } from "@/components/spy-ad-card";
import { useStore } from "@/lib/store";
import type { SpyAd } from "@/lib/spy";

export const Route = createFileRoute("/bat-spy/salvos")({ head: () => head("Bat Spy — Swipe file", "Anúncios salvos para modelar criativos e copys."), component: Saved });

function Saved() {
  const [saved] = useStore<SpyAd[]>("spy-saved", []);
  return <div className="space-y-5 p-4 pb-24 sm:p-7"><PageHead title="Swipe file" sub="Criativos e copys que você guardou." />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{saved.map((a) => <SpyAdCard key={a.id} ad={a} />)}</div>
    {!saved.length && <p className="border-y border-border py-10 text-center text-sm text-muted-foreground">Toque em Salvar num anúncio minerado.</p>}</div>;
}
