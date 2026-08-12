-- ScoutCore Live Game Experience backend.
-- Staged on development only. Apply when the live simulator/chat feature is ready to publish.

create table if not exists public.game_chat_messages (
  id uuid primary key default gen_random_uuid(),
  game_pk bigint not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 48),
  body text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now()
);

create index if not exists game_chat_messages_game_created_idx
  on public.game_chat_messages(game_pk, created_at desc);
create index if not exists game_chat_messages_user_created_idx
  on public.game_chat_messages(user_id, created_at desc);

alter table public.game_chat_messages enable row level security;

grant select on table public.game_chat_messages to anon, authenticated;
grant insert, delete on table public.game_chat_messages to authenticated;

drop policy if exists "game chat is publicly readable" on public.game_chat_messages;
create policy "game chat is publicly readable"
  on public.game_chat_messages
  for select
  to anon, authenticated
  using (true);

drop policy if exists "signed in users can send game chat" on public.game_chat_messages;
create policy "signed in users can send game chat"
  on public.game_chat_messages
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users can delete own game chat" on public.game_chat_messages;
create policy "users can delete own game chat"
  on public.game_chat_messages
  for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.guard_game_chat_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.game_chat_messages
    where user_id = new.user_id
      and created_at > now() - interval '2 seconds'
  ) then
    raise exception 'Please wait before sending another live chat message.';
  end if;
  return new;
end;
$$;

drop trigger if exists game_chat_rate_limit on public.game_chat_messages;
create trigger game_chat_rate_limit
before insert on public.game_chat_messages
for each row execute function public.guard_game_chat_rate_limit();

create table if not exists public.game_event_reactions (
  id uuid primary key default gen_random_uuid(),
  game_pk bigint not null,
  event_key text not null,
  emoji text not null check (emoji in ('🔥','👏','😱','⚾','😂','💙')),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (game_pk, event_key, emoji, user_id)
);

create index if not exists game_event_reactions_event_idx
  on public.game_event_reactions(game_pk, event_key, created_at desc);

alter table public.game_event_reactions enable row level security;

grant select on table public.game_event_reactions to anon, authenticated;
grant insert, delete on table public.game_event_reactions to authenticated;

drop policy if exists "live reactions are publicly readable" on public.game_event_reactions;
create policy "live reactions are publicly readable"
  on public.game_event_reactions
  for select
  to anon, authenticated
  using (true);

drop policy if exists "signed in users can react to live events" on public.game_event_reactions;
create policy "signed in users can react to live events"
  on public.game_event_reactions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users can remove own live reactions" on public.game_event_reactions;
create policy "users can remove own live reactions"
  on public.game_event_reactions
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Realtime lets live-chat messages and emoji reactions appear without page refreshes.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'game_chat_messages'
  ) then
    alter publication supabase_realtime add table public.game_chat_messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'game_event_reactions'
  ) then
    alter publication supabase_realtime add table public.game_event_reactions;
  end if;
end $$;

comment on table public.game_chat_messages is 'Per-game ScoutCore live chat. Guests may read; authenticated users may post.';
comment on table public.game_event_reactions is 'Emoji reactions tied to a verified live MLB event key.';
