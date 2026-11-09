<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- Meta Marketing API calls live only in `src/lib/meta.functions.ts` server functions, routed through the Lovable connector gateway (`LOVABLE_API_KEY` + `META_ADS_API_KEY`) — keeps credentials server-side.
- Mobile layout: below `md` the sidebar becomes a top bar + fixed bottom nav (h-16); pages add bottom padding so content clears it.
- AI assistant (Crowley) calls DeepSeek/Ollama only from `src/lib/crowley.functions.ts` server functions using `DEEPSEEK_API_KEY` / `OLLAMA_API_KEY` — keeps AI keys server-side.
- Money display goes through `money()` in `src/lib/currency.ts` (account currency → chosen view with live USD/BRL rate); pages call `useCurrency()` to re-render on toggle.
- Reused funnel catalog, graph model and simulation live in `src/lib/funnel`; render the editor through a lazy client boundary to isolate React Flow from SSR. Graph validation prevents cycles and traffic duplication.
- The central dashboard uses one selected ad account at a time and labels ad-attributed purchases separately from approved gateway payments, avoiding mixed-currency totals and false sales claims.
- Reused attribution parsing lives in `src/lib/tracking`; keep click identifiers and provider IDs intact to support later order/event ingestion.
- Crowley full-page, floating chat and conversational ADS creation reuse one persisted chat and validated action parser; tools require explicit approval and campaigns must match the loaded account.
- ADS rules carry an optional account scope, enforced in both client and scheduled evaluation, to prevent applying a strategy to a different selected account.
- Public presentation and login render outside operational navigation; session controls live in Settings to keep the mobile header compact.
- Account creation uses the official Business `/adaccount` edge through the existing connector after review; never store a second raw token or infer unlimited access from administrator status.
- Dashboard filters and currency-safe payment aggregation live in `src/lib/dashboard.ts`; attributed ad revenue is never combined with gateway revenue or labeled net profit without costs.
- Operational lists sync per-row into domain tables via `TABLE_KEYS` in `src/lib/cloud-sync.ts`; localStorage is only a cache, so pages keep `useStore` while the database stays the source of truth.
- Background work runs in `src/lib/worker.server.ts`, invoked by the secret-protected `/api/public/cron/watch` pass: jobs are claimed with an atomic status switch, retried with backoff, and skipped for users with `bg.kill-switch`; automations share `runEngine` with the client so behavior never diverges.
- Every Meta write and scheduled/agent action records an `audit_log` row and user-facing results go to `notifications`; menu entries live only in `src/lib/nav.ts`.
- Gateway tokens live in service-role-only `gateway_credentials` via `src/lib/integrations.functions.ts`; webhooks reject events missing a saved verification secret — keeps credentials out of the browser.
