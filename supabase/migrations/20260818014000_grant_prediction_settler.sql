-- The settlement Edge Function uses the server-only service role to read and
-- update prediction results. These explicit grants are required in addition to
-- BYPASSRLS because the tables were created with restricted table privileges.

grant select, update
on table public.challenge_cards
to service_role;

grant select, insert, update
on table public.challenge_scores
to service_role;
