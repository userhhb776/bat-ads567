import { installSfx } from "@/lib/sfx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startCloudSync, stopCloudSync } from "@/lib/cloud-sync";
import { LayoutGrid, PlusSquare, BarChart3, Plug, Workflow, Bot, Gauge, ChevronRight, FileText, Package, Zap, Users, MessagesSquare, Radar, Grid3x3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CurrencyToggle } from "@/components/currency-toggle";
import { loadRate } from "@/lib/currency";
import { PublicHome } from "@/components/public-home";
import { FloatingCrowley } from "@/components/crowley/floating-chat";
import { NAV_GROUPS } from "@/lib/nav";
import { NotificationBell } from "@/components/notification-bell";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl text-primary">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Página não encontrada.</p>
        <Link to="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Voltar
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Esta página não carregou</h1>
        <p className="mt-2 text-sm text-muted-foreground">{(error as Error)?.message}</p>
        <Button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Tentar de novo
        </Button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#14161d" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { title: "Bat Gotham" },
      { name: "description", content: "Central de operações: anúncios, métricas, funis e o assistente Crowley." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Bebas+Neue&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('batgotham.theme');if(t)document.documentElement.dataset.theme=t}catch(e){}" }} />
        <HeadContent />
      </head>
      <body className="font-sans">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const mobileNav = [{ to: "/", label: "Central", icon: Gauge }, { to: "/met", label: "Campanhas", icon: LayoutGrid }, { to: "/utm", label: "Métricas", icon: BarChart3 }, { to: "/crowley", label: "Crowley", icon: Bot }, { to: "/mais", label: "Mais", icon: Grid3x3 }] as const;

function Logo({ size = "text-3xl" }: { size?: string }) {
  return (
    <div className="flex items-center gap-2">
      <img src="/favicon.svg" alt="" className="h-8 w-8" />
      <span className={`font-display ${size} text-foreground`}>BAT <span className="text-primary">GOTHAM</span></span>
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const path = useRouterState({ select: (s) => s.location.pathname }).replace(/\/$/, "") || "/";
  useEffect(() => { loadRate(); }, []);
  useEffect(() => installSfx(), []);
  const [email, setEmail] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    const begin = async (uid: string) => {
      const changed = await startCloudSync(uid);
      if (changed && !sessionStorage.getItem("bg-synced")) { sessionStorage.setItem("bg-synced", "1"); location.reload(); }
    };
    supabase.auth.getSession().then(({ data }) => { setChecked(true); if (data.session) { setEmail(data.session.user.email ?? ""); void begin(data.session.user.id); } });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) { setEmail(session.user.email ?? ""); void begin(session.user.id); }
      if (event === "SIGNED_OUT") { setEmail(null); stopCloudSync(); sessionStorage.removeItem("bg-synced"); }
    });
    return () => data.subscription.unsubscribe();
  }, []);
  if (!checked) return <QueryClientProvider client={queryClient}><div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Abrindo a central…</div><Toaster /></QueryClientProvider>;
  if (path === "/entrar" || email === null) return <QueryClientProvider client={queryClient}>{path === "/entrar" ? <Outlet /> : <PublicHome />}<Toaster /></QueryClientProvider>;

  if (path === "/crowley") return <QueryClientProvider client={queryClient}><Outlet /><Toaster /></QueryClientProvider>;

  return (
    <QueryClientProvider client={queryClient}>
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-sidebar-border bg-sidebar px-4 py-2 md:hidden">
        <Logo size="text-2xl" />
        <div className="flex items-center gap-2">
          <NotificationBell />
          <CurrencyToggle />
        </div>
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-5 border-t border-sidebar-border bg-sidebar md:hidden">
        {mobileNav.map((n) => (
          <Link key={n.label} to={n.to} className={`flex flex-col items-center justify-center gap-1 text-[11px] ${path === n.to ? "text-primary" : "text-muted-foreground"}`}>
            <n.icon className="h-5 w-5" />
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="flex min-h-screen w-full pb-16 md:pb-0">
        <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
          <div className="border-b border-sidebar-border px-5 py-6"><Logo /><div className="mt-1 pl-10 text-[10px] uppercase text-muted-foreground">Central de operações</div></div>
          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-4">
            {NAV_GROUPS.map((g) => (
              <div key={g.title}>
                <div className="px-3 pb-1 pt-4 text-[10px] uppercase tracking-wider text-muted-foreground">{g.title}</div>
                {g.items.map((n) => (
                  <Link key={n.to} to={n.to}
                    className={`flex items-center gap-3 rounded-md px-3 py-1.5 text-sm ${path === n.to ? "bg-sidebar-accent text-primary" : "text-sidebar-foreground hover:bg-sidebar-accent"}`}>
                    <n.icon className="h-4 w-4" />
                    {n.label}
                    {path === n.to && <ChevronRight className="ml-auto h-3 w-3" />}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
          <div className="mt-auto space-y-2 border-t border-sidebar-border p-4">
            <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Exibição</span><div className="flex items-center gap-1"><NotificationBell /><CurrencyToggle /></div></div>
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
      <Toaster />
      {path !== "/crowley" && path !== "/agentes" && <FloatingCrowley />}
    </QueryClientProvider>
  );
}
