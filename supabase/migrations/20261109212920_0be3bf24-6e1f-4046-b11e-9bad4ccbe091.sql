CREATE TABLE public.support_bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  product_id text NOT NULL DEFAULT '',
  username text NOT NULL DEFAULT '',
  token text NOT NULL,
  secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.support_bots TO service_role;
ALTER TABLE public.support_bots ENABLE ROW LEVEL SECURITY;
CREATE INDEX support_bots_user ON public.support_bots (user_id);