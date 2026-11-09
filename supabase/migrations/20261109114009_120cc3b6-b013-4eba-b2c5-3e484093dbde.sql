DELETE FROM public.conversations c USING public.conversations d
  WHERE c.user_id = d.user_id AND c.data->>'contactId' = d.data->>'contactId' AND c.id > d.id;
UPDATE public.conversations SET id = data->>'contactId' WHERE data ? 'contactId' AND data->>'id' IS NULL AND id <> data->>'contactId';
UPDATE public.crowley_messages SET id = 'i' || position WHERE data->>'id' IS NULL AND id <> 'i' || position;