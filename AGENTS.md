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
