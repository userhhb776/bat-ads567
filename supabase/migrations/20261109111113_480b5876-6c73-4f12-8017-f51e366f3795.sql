DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['products','orders','contacts','conversations','messages','automations','automation_runs','monitor_rules','monitor_history','offer_radar','sales_pages','crowley_messages'] LOOP
    EXECUTE format('CREATE TABLE IF NOT EXISTS public.%I (
      id text NOT NULL,
      user_id uuid NOT NULL,
      data jsonb NOT NULL DEFAULT ''{}''::jsonb,
      name text GENERATED ALWAYS AS (coalesce(data->>''name'', data->>''title'', data->>''nome'')) STORED,
      status text GENERATED ALWAYS AS (data->>''status'') STORED,
      position integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, id))', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "own rows" ON public.%I FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (user_id, status)', t || '_status_idx', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t || '_updated', t);
  END LOOP;
END $$;

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  actor text NOT NULL DEFAULT 'usuario',
  module text NOT NULL,
  action text NOT NULL,
  target text,
  before jsonb,
  after jsonb,
  result text NOT NULL DEFAULT 'ok',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own audit read" ON public.audit_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own audit insert" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX audit_log_user_idx ON public.audit_log (user_id, created_at DESC);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications" ON public.notifications FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX notifications_user_idx ON public.notifications (user_id, created_at DESC);

CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text,
  status text NOT NULL DEFAULT 'queued',
  run_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  locked_at timestamptz,
  last_error text,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, dedupe_key)
);
GRANT SELECT, INSERT, UPDATE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own jobs read" ON public.jobs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own jobs insert" ON public.jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND status = 'queued' AND attempts = 0);
CREATE POLICY "own jobs cancel" ON public.jobs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND status IN ('cancelled','paused','queued'));
CREATE INDEX jobs_due_idx ON public.jobs (status, run_at);
CREATE TRIGGER jobs_updated BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Copy existing device data (saved in app_state) into the new tables without deleting it.
DO $$
DECLARE m record;
BEGIN
  FOR m IN SELECT * FROM (VALUES
    ('bg.products','products'),('bg.orders','orders'),('bg.contacts','contacts'),('bg.conversations','conversations'),
    ('bg.messages','messages'),('bg.automations','automations'),('bg.automation-logs','automation_runs'),
    ('bg.intel-rules','monitor_rules'),('bg.intel-history','monitor_history'),('bg.offers','offer_radar'),
    ('bat-gotham-pages','sales_pages'),('bg.crowley-messages','crowley_messages')) v(k,t) LOOP
    EXECUTE format($q$
      INSERT INTO public.%I (id, user_id, data, position)
      SELECT coalesce(e.value->>'id', md5(e.value::text)), s.user_id, e.value, (e.ord - 1)::int
      FROM public.app_state s, jsonb_array_elements(s.value) WITH ORDINALITY e(value, ord)
      WHERE s.key = %L AND jsonb_typeof(s.value) = 'array' AND jsonb_typeof(e.value) = 'object'
      ON CONFLICT (user_id, id) DO NOTHING$q$, m.t, m.k);
  END LOOP;
END $$;