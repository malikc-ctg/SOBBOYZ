-- Allow events without an assigned rep (e.g., automated inbound VoIP / Quo webhooks)
ALTER TABLE public.events ALTER COLUMN rep_id DROP NOT NULL;
