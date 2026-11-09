CREATE TABLE IF NOT EXISTS public.crm_tasks (
  id text NOT NULL, user_id uuid NOT NULL, data jsonb NOT NULL DEFAULT '{}'::jsonb,
  name text GENERATED ALWAYS AS (coalesce(data->>'name', data->>'title')) STORED,
  status text GENERATED ALWAYS AS (data->>'status') STORED,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_tasks TO authenticated;
GRANT ALL ON public.crm_tasks TO service_role;
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rows" ON public.crm_tasks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER crm_tasks_updated BEFORE UPDATE ON public.crm_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();