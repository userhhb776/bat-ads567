ALTER TABLE public.watch_log ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'aviso';
ALTER TABLE public.watch_log ADD COLUMN IF NOT EXISTS campaign_name text;
ALTER TABLE public.watch_log ADD COLUMN IF NOT EXISTS new_budget numeric;
GRANT UPDATE (state) ON public.watch_log TO authenticated;
CREATE POLICY "own log update" ON public.watch_log FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);