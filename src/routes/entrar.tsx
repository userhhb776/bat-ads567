import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/entrar")({
  head: () => ({ meta: [
    { title: "Entrar — Bat Gotham" },
    { name: "description", content: "Acesso exclusivo ao Bat Gotham." },
    { property: "og:title", content: "Entrar — Bat Gotham" },
    { property: "og:description", content: "Acesse sua central de operações." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Entrar,
});

function Entrar() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const res = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (res.error) { toast.error("E-mail ou senha incorretos."); return; }
    toast.success("Bem-vindo de volta, chefe."); nav({ to: "/" });
  }

  return (
    <div className="mx-auto flex min-h-[80dvh] max-w-sm flex-col justify-center gap-6 p-6">
      <div className="text-center">
        <img src="/favicon.svg" alt="" className="mx-auto h-16 w-16" />
        <h1 className="mt-3 font-display text-4xl">BAT <span className="text-primary">GOTHAM</span></h1>
        <p className="mt-1 text-sm text-muted-foreground">Acesso exclusivo.</p>
      </div>
      <form onSubmit={submit} className="space-y-3 rounded-xl border border-border bg-card p-5">
        <Input type="email" required autoComplete="username" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input type="password" required autoComplete="current-password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button className="w-full" disabled={busy}>Entrar</Button>
      </form>
    </div>
  );
}
