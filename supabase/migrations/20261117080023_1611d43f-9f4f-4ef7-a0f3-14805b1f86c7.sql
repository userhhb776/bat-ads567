CREATE TABLE IF NOT EXISTS public.site_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_key text NOT NULL UNIQUE CHECK (site_key ~ '^[a-z0-9-]{3,60}$'),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_stores TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_stores TO authenticated;
GRANT ALL ON public.site_stores TO service_role;
ALTER TABLE public.site_stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public store catalog read" ON public.site_stores FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "owner store insert" ON public.site_stores FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner store update" ON public.site_stores FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner store delete" ON public.site_stores FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER site_stores_updated_at BEFORE UPDATE ON public.site_stores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.site_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_key text NOT NULL REFERENCES public.site_stores(site_key) ON DELETE CASCADE,
  customer jsonb NOT NULL DEFAULT '{}'::jsonb,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'novo' CHECK (status IN ('novo','pago','enviado','entregue','cancelado')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS site_orders_site_key_idx ON public.site_orders(site_key, created_at DESC);
GRANT INSERT ON public.site_orders TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_orders TO authenticated;
GRANT ALL ON public.site_orders TO service_role;
ALTER TABLE public.site_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers place orders" ON public.site_orders FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'novo' AND jsonb_typeof(items) = 'array' AND jsonb_array_length(items) BETWEEN 1 AND 50 AND total >= 0 AND length(customer::text) < 2000 AND length(items::text) < 20000);
CREATE POLICY "store owner reads orders" ON public.site_orders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.site_stores s WHERE s.site_key = site_orders.site_key AND s.user_id = auth.uid()));
CREATE POLICY "store owner updates orders" ON public.site_orders FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.site_stores s WHERE s.site_key = site_orders.site_key AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.site_stores s WHERE s.site_key = site_orders.site_key AND s.user_id = auth.uid()));
CREATE POLICY "store owner deletes orders" ON public.site_orders FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.site_stores s WHERE s.site_key = site_orders.site_key AND s.user_id = auth.uid()));