-- ScoutCore public UUID privacy hardening.
-- Apply only after the frontend uses the privacy-safe RPC reads.

-- Direct REST reads can still access public content, but never another account's auth UUID.
revoke select on table public.community_posts from anon, authenticated;
grant select (id, author_name, title, body, category, tag, created_at, updated_at, media_path, media_type, moderation_status)
  on table public.community_posts to anon, authenticated;

revoke select on table public.community_comments from anon, authenticated;
grant select (id, post_id, author_name, body, created_at, updated_at, parent_comment_id, moderation_status)
  on table public.community_comments to anon, authenticated;

revoke select on table public.community_likes from anon, authenticated;
grant select (post_id, created_at)
  on table public.community_likes to anon, authenticated;

revoke select on table public.community_reactions from anon, authenticated;
grant select (post_id, emoji, created_at)
  on table public.community_reactions to anon, authenticated;

revoke select on table public.game_chat_messages from anon, authenticated;
grant select (id, game_pk, display_name, body, created_at)
  on table public.game_chat_messages to anon, authenticated;

revoke select on table public.game_event_reactions from anon, authenticated;
grant select (id, game_pk, event_key, emoji, created_at)
  on table public.game_event_reactions to anon, authenticated;

revoke select on table public.challenge_scores from authenticated;
grant select (display_name, points, correct_picks, total_picks, current_streak, best_streak, updated_at)
  on table public.challenge_scores to authenticated;

-- Realtime live-chat payloads also exclude auth UUIDs.
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_chat_messages'
  ) then
    alter publication supabase_realtime drop table public.game_chat_messages;
  end if;
  alter publication supabase_realtime add table public.game_chat_messages (id, game_pk, display_name, body, created_at);

  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_event_reactions'
  ) then
    alter publication supabase_realtime drop table public.game_event_reactions;
  end if;
  alter publication supabase_realtime add table public.game_event_reactions (id, game_pk, event_key, emoji, created_at);
end $$;

-- Profile images use random public paths. Ownership, not a UUID folder name,
-- controls who can change or delete an avatar.
drop policy if exists "users can upload own profile avatar" on storage.objects;
create policy "authenticated users can upload profile avatars"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'profile-avatars');

drop policy if exists "users can update own profile avatar" on storage.objects;
create policy "users can update own profile avatar"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'profile-avatars' and owner_id = (select auth.uid()::text))
  with check (bucket_id = 'profile-avatars' and owner_id = (select auth.uid()::text));

drop policy if exists "users can delete own profile avatar" on storage.objects;
create policy "users can delete own profile avatar"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'profile-avatars' and owner_id = (select auth.uid()::text));
