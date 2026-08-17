-- Cover the actor profile foreign key used when social profiles are removed.
create index if not exists scoutcore_notifications_actor_idx
  on public.scoutcore_notifications(actor_profile_id);
