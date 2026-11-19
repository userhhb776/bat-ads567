DROP POLICY IF EXISTS "public store catalog read" ON public.site_stores;
REVOKE SELECT ON public.site_stores FROM anon;
CREATE POLICY "owner store read" ON public.site_stores FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Published store sites fetch only their own catalog by key (never the owner or other stores).
CREATE OR REPLACE FUNCTION public.get_store_catalog(p_site_key text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.data FROM public.site_stores s
  WHERE p_site_key ~ '^[a-z0-9-]{3,60}$' AND s.site_key = p_site_key
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_store_catalog(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_catalog(text) TO anon, authenticated;