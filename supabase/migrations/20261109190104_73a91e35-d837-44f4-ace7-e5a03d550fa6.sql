CREATE TABLE public.track_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  visitor_id text not null,
  session_id text not null,
  event text not null default 'pageview',
  url text,
  referrer text,
  utm jsonb not null default '{}'::jsonb,
  source text,
  email text,
  phone text,
  created_at timestamptz not null default now()
);
GRANT SELECT, DELETE ON public.track_events TO authenticated;
GRANT ALL ON public.track_events TO service_role;
ALTER TABLE public.track_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own track events read" ON public.track_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own track events delete" ON public.track_events FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX track_events_user_time ON public.track_events (user_id, created_at desc);
CREATE INDEX track_events_visitor ON public.track_events (user_id, visitor_id);