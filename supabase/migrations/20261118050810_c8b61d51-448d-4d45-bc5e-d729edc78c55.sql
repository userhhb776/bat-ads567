CREATE TABLE IF NOT EXISTS public.spy_page_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_id text NOT NULL CHECK (length(page_id) BETWEEN 1 AND 120),
  page_name text NOT NULL DEFAULT '',
  day date NOT NULL DEFAULT current_date,
  active integer NOT NULL DEFAULT 0 CHECK (active >= 0),
  launched7 integer NOT NULL DEFAULT 0 CHECK (launched7 >= 0),
  exact boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, page_id, day)
);
CREATE INDEX IF NOT EXISTS spy_page_snapshots_lookup_idx ON public.spy_page_snapshots(user_id, page_id, day DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spy_page_snapshots TO authenticated;
GRANT ALL ON public.spy_page_snapshots TO service_role;
ALTER TABLE public.spy_page_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads page snapshots" ON public.spy_page_snapshots FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner writes page snapshots" ON public.spy_page_snapshots FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner updates page snapshots" ON public.spy_page_snapshots FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner deletes page snapshots" ON public.spy_page_snapshots FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.spy_traffic (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain text NOT NULL CHECK (length(domain) BETWEEN 3 AND 255),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT '',
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, domain)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spy_traffic TO authenticated;
GRANT ALL ON public.spy_traffic TO service_role;
ALTER TABLE public.spy_traffic ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads traffic" ON public.spy_traffic FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner writes traffic" ON public.spy_traffic FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner updates traffic" ON public.spy_traffic FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner deletes traffic" ON public.spy_traffic FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS site_stores_user_id_idx ON public.site_stores(user_id);