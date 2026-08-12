-- ScoutCore Community: media, reactions, reports, replies, and moderation state.
-- Staged for the final release. Existing posts/comments remain approved.

alter table public.community_posts
  add column if not exists media_path text,
  add column if not exists media_type text,
  add column if not exists moderation_status text not null default 'approved',
  add column if not exists moderation_reason text,
  add column if not exists moderation_checked_at timestamptz;

alter table public.community_comments
  add column if not exists parent_comment_id uuid references public.community_comments(id) on delete cascade,
  add column if not exists moderation_status text not null default 'approved',
  add column if not exists moderation_reason text,
  add column if not exists moderation_checked_at timestamptz;

update public.community_posts set moderation_status = 'approved' where moderation_status is null;
update public.community_comments set moderation_status = 'approved' where moderation_status is null;

alter table public.community_posts alter column moderation_status set default 'pending';
alter table public.community_comments alter column moderation_status set default 'pending';

alter table public.community_posts drop constraint if exists community_posts_media_type_check;
alter table public.community_posts add constraint community_posts_media_type_check
  check (media_type is null or media_type in ('image', 'video'));

alter table public.community_posts drop constraint if exists community_posts_moderation_status_check;
alter table public.community_posts add constraint community_posts_moderation_status_check
  check (moderation_status in ('pending', 'pending_review', 'approved', 'removed', 'rejected'));

alter table public.community_comments drop constraint if exists community_comments_moderation_status_check;
alter table public.community_comments add constraint community_comments_moderation_status_check
  check (moderation_status in ('pending', 'approved', 'removed', 'rejected'));

create table if not exists public.community_reactions (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('🔥','👏','⚾','😂','💙','😮')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, emoji)
);

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid references public.community_posts(id) on delete cascade,
  comment_id uuid references public.community_comments(id) on delete cascade,
  reason text not null check (reason in ('explicit', 'harassment', 'violence', 'hate', 'spam', 'other')),
  details text,
  status text not null default 'open' check (status in ('open', 'auto_removed', 'reviewed_safe', 'closed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint community_reports_one_target check (
    (post_id is not null and comment_id is null) or
    (post_id is null and comment_id is not null)
  )
);

create table if not exists public.community_warnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  content_type text not null check (content_type in ('post','reply','media')),
  content_id uuid,
  created_at timestamptz not null default now()
);

alter table public.community_reactions enable row level security;
alter table public.community_reports enable row level security;
alter table public.community_warnings enable row level security;

-- Replace permissive community read/write policies so unapproved content is not public
-- and users cannot self-approve content after moderation.
drop policy if exists "community posts readable by everyone" on public.community_posts;
drop policy if exists "signed in users can create posts" on public.community_posts;
drop policy if exists "users can update own posts" on public.community_posts;

create policy "approved community posts readable"
  on public.community_posts for select to anon, authenticated
  using (moderation_status = 'approved' or auth.uid() = user_id);

create policy "signed in users can stage posts"
  on public.community_posts for insert to authenticated
  with check (auth.uid() = user_id and moderation_status in ('pending','pending_review'));

drop policy if exists "community comments readable by everyone" on public.community_comments;
drop policy if exists "signed in users can create comments" on public.community_comments;
drop policy if exists "users can update own comments" on public.community_comments;

create policy "approved community replies readable"
  on public.community_comments for select to anon, authenticated
  using (moderation_status = 'approved' or auth.uid() = user_id);

create policy "signed in users can stage replies"
  on public.community_comments for insert to authenticated
  with check (auth.uid() = user_id and moderation_status = 'pending');

create policy "community reactions readable"
  on public.community_reactions for select to anon, authenticated using (true);
create policy "signed in users can react"
  on public.community_reactions for insert to authenticated with check (auth.uid() = user_id);
create policy "users can remove own reactions"
  on public.community_reactions for delete to authenticated using (auth.uid() = user_id);

create policy "signed in users can report"
  on public.community_reports for insert to authenticated with check (auth.uid() = reporter_id);
create policy "users can read own reports"
  on public.community_reports for select to authenticated using (auth.uid() = reporter_id);

create policy "users can read own warnings"
  on public.community_warnings for select to authenticated using (auth.uid() = user_id);

-- Private quarantine + approved media buckets. Media is never public while pending.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-quarantine', 'community-quarantine', false, 52428800,
  array['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime']
)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-media', 'community-media', false, 52428800,
  array['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime']
)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "community quarantine upload own" on storage.objects;
drop policy if exists "community quarantine read own" on storage.objects;
drop policy if exists "community quarantine delete own" on storage.objects;
drop policy if exists "approved community media readable" on storage.objects;

create policy "community quarantine upload own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'community-quarantine' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "community quarantine read own"
  on storage.objects for select to authenticated
  using (bucket_id = 'community-quarantine' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "community quarantine delete own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'community-quarantine' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "approved community media readable"
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'community-media'
    and exists (
      select 1 from public.community_posts p
      where p.media_path = storage.objects.name
        and p.moderation_status = 'approved'
    )
  );

create index if not exists community_posts_moderation_idx on public.community_posts(moderation_status, created_at desc);
create index if not exists community_comments_moderation_idx on public.community_comments(moderation_status, post_id, created_at);
create index if not exists community_reports_status_idx on public.community_reports(status, created_at desc);
