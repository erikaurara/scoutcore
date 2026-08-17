-- Automatically settle completed ScoutCore prediction cards without relying on
-- a browser visit or a manual function invocation.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
declare
  secret_id uuid;
begin
  select id into secret_id
  from vault.secrets
  where name = 'project_url'
  limit 1;

  if secret_id is null then
    perform vault.create_secret(
      'https://emjluyqkptfvinpdmalu.supabase.co',
      'project_url',
      'ScoutCore Supabase project URL for scheduled Edge Functions'
    );
  else
    perform vault.update_secret(
      secret_id,
      'https://emjluyqkptfvinpdmalu.supabase.co',
      'project_url',
      'ScoutCore Supabase project URL for scheduled Edge Functions'
    );
  end if;

  select id into secret_id
  from vault.secrets
  where name = 'publishable_key'
  limit 1;

  if secret_id is null then
    perform vault.create_secret(
      'sb_publishable_oz4VwsnHHGaGAiKbjAmaEg_TSSShVxU',
      'publishable_key',
      'ScoutCore publishable key for scheduled Edge Functions'
    );
  else
    perform vault.update_secret(
      secret_id,
      'sb_publishable_oz4VwsnHHGaGAiKbjAmaEg_TSSShVxU',
      'publishable_key',
      'ScoutCore publishable key for scheduled Edge Functions'
    );
  end if;
end;
$$;

select cron.schedule(
  'settle-scoutcore-predictions',
  '*/10 * * * *',
  $cron$
    select net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'project_url'
        limit 1
      ) || '/functions/v1/settle-challenge',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'publishable_key'
          limit 1
        ),
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'publishable_key'
          limit 1
        )
      ),
      body := jsonb_build_object('scheduled_at', now()),
      timeout_milliseconds := 10000
    )
    where exists (
      select 1
      from public.challenge_cards
      where status = 'upcoming'
        and game_date <= now()
    );
  $cron$
);

-- Process any cards that were waiting before the scheduler was installed.
select net.http_post(
  url := (
    select decrypted_secret
    from vault.decrypted_secrets
    where name = 'project_url'
    limit 1
  ) || '/functions/v1/settle-challenge',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'apikey', (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'publishable_key'
      limit 1
    ),
    'Authorization', 'Bearer ' || (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'publishable_key'
      limit 1
    )
  ),
  body := jsonb_build_object('reason', 'scheduler-install-backfill'),
  timeout_milliseconds := 10000
);
