DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['creatives','copies','utm_links'] LOOP
    EXECUTE format('CREATE TABLE IF NOT EXISTS public.%I (
      id text NOT NULL, user_id uuid NOT NULL, data jsonb NOT NULL DEFAULT ''{}''::jsonb,
      name text GENERATED ALWAYS AS (coalesce(data->>''name'', data->>''title'', data->>''nome'')) STORED,
      status text GENERATED ALWAYS AS (data->>''status'') STORED,
      position integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, id))', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "own rows" ON public.%I FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t || '_updated', t);
  END LOOP;
END $$;

CREATE POLICY "creatives own read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'creatives' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "creatives own upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'creatives' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "creatives own update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'creatives' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "creatives own delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'creatives' AND (storage.foldername(name))[1] = auth.uid()::text);