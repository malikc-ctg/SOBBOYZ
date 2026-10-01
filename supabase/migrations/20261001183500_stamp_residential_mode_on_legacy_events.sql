-- ========================================================
-- Stamp RESIDENTIAL mode on all legacy events and knock_events
-- Ensures complete mode isolation between Residential & Commercial
-- ========================================================

UPDATE public.events
SET payload = jsonb_set(payload, '{mode}', '"RESIDENTIAL"')
WHERE (payload->>'mode') IS NULL;

UPDATE public.knock_events
SET mode = 'residential'
WHERE mode IS NULL OR mode = '' OR lower(mode) = 'residential';
