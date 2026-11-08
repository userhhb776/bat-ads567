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
import { useEffect, type ReactNode } from "react";
import { LayoutGrid, PlusSquare, BarChart3, Plug, Workflow, Bot } from "lucide-react";
import { CurrencyToggle } from "@/components/currency-toggle";
import { loadRate, useCurrency } from "@/lib/currency";

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
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Tentar de novo
        </button>
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
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body className="font-sans">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const nav = [
  { to: "/met", label: "Campanhas", icon: LayoutGrid },
  { to: "/met/criar", label: "Criar", icon: PlusSquare },
  { to: "/utm", label: "Métricas", icon: BarChart3 },
  { to: "/funis", label: "Funis", icon: Workflow },
  { to: "/crowley", label: "Crowley", icon: Bot },
] as const;

function Logo({ size = "text-3xl" }: { size?: string }) {
  return (
    <div className="flex items-center gap-2">
      <img src="/favicon.svg" alt="" className="h-8 w-8" />
      <span className={`font-display ${size} tracking-wide text-primary`}>BAT GOTHAM</span>
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const path = useRouterState({ select: (s) => s.location.pathname }).replace(/\/$/, "") || "/";
  const currency = useCurrency();
  useEffect(() => { loadRate(); }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-sidebar-border bg-sidebar px-4 py-2 md:hidden">
        <Logo size="text-2xl" />
        <div className="flex items-center gap-2">
          <CurrencyToggle />
          <Link to="/utm/integracoes" className="text-muted-foreground" aria-label="Integrações"><Plug className="h-5 w-5" /></Link>
        </div>
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-5 border-t border-sidebar-border bg-sidebar md:hidden">
        {nav.map((n) => (
          <Link key={n.label} to={n.to} className={`flex flex-col items-center justify-center gap-1 text-[11px] ${path === n.to ? "text-primary" : "text-muted-foreground"}`}>
            <n.icon className="h-5 w-5" />
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="flex min-h-screen w-full pb-16 md:pb-0">
        <aside className="hidden w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
          <div className="px-5 py-5"><Logo /></div>
          <nav className="flex flex-col gap-1 px-3">
            {[...nav, { to: "/utm/integracoes", label: "Integrações", icon: Plug } as const].map((n) => (
              <Link key={n.label} to={n.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${path === n.to ? "bg-sidebar-accent text-primary" : "text-sidebar-foreground hover:bg-sidebar-accent"}`}>
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto space-y-1 p-4">
            <div className="text-xs text-muted-foreground">Moeda</div>
            <CurrencyToggle />
          </div>
        </aside>
        <main className="min-w-0 flex-1" key={currency.view + currency.source + currency.rate}>
          <Outlet />
        </main>
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}
