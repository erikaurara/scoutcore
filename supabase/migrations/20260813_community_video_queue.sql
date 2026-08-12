-- Video uploads stay private until a dedicated video safety scanner approves them.
create table if not exists public.community_media_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  title text not null,
  body text not null default '',
  category text not null,
  quarantine_path text not null unique,
  media_type text not null default 'video' check (media_type = 'video'),
  status text not null default 'pending_review' check (status in ('pending_review','approved','rejected')),
  reason text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.community_media_queue enable row level security;

create policy "users can read own pending media"
  on public.community_media_queue for select to authenticated
  using (auth.uid() = user_id);

create index if not exists community_media_queue_status_idx
  on public.community_media_queue(status, created_at);
