-- Complete Friends Challenge flow. Friends modes are free and separate from ranked/ticket scoring.
alter table public.friend_challenges
  add column if not exists inviter_preference text,
  add column if not exists invitee_preference text,
  add column if not exists inviter_game jsonb,
  add column if not exists invitee_game jsonb,
  add column if not exists game jsonb,
  add column if not exists inviter_picks jsonb,
  add column if not exists invitee_picks jsonb,
  add column if not exists inviter_submitted boolean not null default false,
  add column if not exists invitee_submitted boolean not null default false,
  add column if not exists inviter_score integer,
  add column if not exists invitee_score integer,
  add column if not exists result_json jsonb,
  add column if not exists completed_at timestamptz;

drop function if exists public.get_my_friend_challenges();
create function public.get_my_friend_challenges()
returns table(challenge_id uuid,role text,other_profile_id uuid,other_display_name text,other_avatar_url text,mode text,inviter_preference text,invitee_preference text,status text,created_at timestamptz,updated_at timestamptz,shared_game jsonb,my_game_choice jsonb,other_game_choice jsonb,my_picks jsonb,other_picks jsonb,my_submitted boolean,other_submitted boolean,my_score integer,other_score integer,result_json jsonb,completed_at timestamptz)
language sql stable security definer set search_path=public,auth as $$
 select fc.id,
 case when fc.inviter_id=auth.uid() then 'inviter' else 'invitee' end,
 sp.public_id,sp.display_name,sp.avatar_url,fc.mode,fc.inviter_preference,fc.invitee_preference,fc.status,fc.created_at,fc.updated_at,fc.game,
 case when fc.inviter_id=auth.uid() then fc.inviter_game else fc.invitee_game end,
 case when fc.inviter_game is not null and fc.invitee_game is not null then case when fc.inviter_id=auth.uid() then fc.invitee_game else fc.inviter_game end else null end,
 case when fc.inviter_id=auth.uid() then fc.inviter_picks else fc.invitee_picks end,
 case when fc.inviter_submitted and fc.invitee_submitted then case when fc.inviter_id=auth.uid() then fc.invitee_picks else fc.inviter_picks end else null end,
 case when fc.inviter_id=auth.uid() then fc.inviter_submitted else fc.invitee_submitted end,
 case when fc.inviter_id=auth.uid() then fc.invitee_submitted else fc.inviter_submitted end,
 case when fc.inviter_id=auth.uid() then fc.inviter_score else fc.invitee_score end,
 case when fc.inviter_id=auth.uid() then fc.invitee_score else fc.inviter_score end,
 fc.result_json,fc.completed_at
 from public.friend_challenges fc join public.social_profiles sp on sp.user_id=case when fc.inviter_id=auth.uid() then fc.invitee_id else fc.inviter_id end
 where auth.uid() in (fc.inviter_id,fc.invitee_id) order by fc.updated_at desc;
$$;

create or replace function public.choose_friend_challenge_game(p_challenge_id uuid,p_game jsonb) returns void language plpgsql security definer set search_path=public,auth as $$
declare c public.friend_challenges%rowtype;a text;b text;
begin
 select * into c from public.friend_challenges where id=p_challenge_id and auth.uid() in (inviter_id,invitee_id) for update;
 if c.id is null or c.status<>'accepted' or c.mode='weekly_h2h' then raise exception 'Game selection not available'; end if;
 if p_game is null or coalesce(p_game->>'gamePk','')='' then raise exception 'Invalid game'; end if;
 if auth.uid()=c.inviter_id then update public.friend_challenges set inviter_game=p_game,updated_at=now() where id=c.id; else update public.friend_challenges set invitee_game=p_game,updated_at=now() where id=c.id; end if;
 select inviter_game->>'gamePk',invitee_game->>'gamePk' into a,b from public.friend_challenges where id=c.id;
 if a is not null and b is not null and a=b then update public.friend_challenges set game=coalesce(inviter_game,invitee_game),updated_at=now() where id=c.id; end if;
end;$$;

create or replace function public.randomize_friend_challenge_game(p_challenge_id uuid) returns void language plpgsql security definer set search_path=public,auth as $$
declare c public.friend_challenges%rowtype;
begin
 select * into c from public.friend_challenges where id=p_challenge_id and auth.uid() in (inviter_id,invitee_id) for update;
 if c.id is null or c.status<>'accepted' or c.mode='weekly_h2h' or c.inviter_game is null or c.invitee_game is null then raise exception 'Game choices not ready'; end if;
 update public.friend_challenges set game=case when random()<0.5 then inviter_game else invitee_game end,updated_at=now() where id=c.id;
end;$$;

create or replace function public.reset_friend_challenge_game_choices(p_challenge_id uuid) returns void language plpgsql security definer set search_path=public,auth as $$
begin
 update public.friend_challenges set inviter_game=null,invitee_game=null,game=null,inviter_picks=null,invitee_picks=null,inviter_submitted=false,invitee_submitted=false,inviter_score=null,invitee_score=null,result_json=null,completed_at=null,updated_at=now()
 where id=p_challenge_id and auth.uid() in (inviter_id,invitee_id) and status='accepted' and mode<>'weekly_h2h';
 if not found then raise exception 'Challenge not available'; end if;
end;$$;

create or replace function public.submit_friend_challenge_picks(p_challenge_id uuid,p_picks jsonb) returns void language plpgsql security definer set search_path=public,auth as $$
declare c public.friend_challenges%rowtype;game_start timestamptz;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into c from public.friend_challenges where id=p_challenge_id and auth.uid() in (inviter_id,invitee_id) for update;
 if c.id is null or c.status<>'accepted' or c.mode='weekly_h2h' or c.game is null then raise exception 'Picks not available'; end if;
 if jsonb_typeof(p_picks)<>'array' or jsonb_array_length(p_picks)<>4 then raise exception 'Four picks are required'; end if;
 begin
   game_start := (c.game->>'gameDate')::timestamptz;
 exception when others then
   raise exception 'Invalid game start time';
 end;
 if game_start <= now() then raise exception 'Picks are locked because the game has started'; end if;
 if auth.uid()=c.inviter_id then update public.friend_challenges set inviter_picks=p_picks,inviter_submitted=true,updated_at=now() where id=c.id; else update public.friend_challenges set invitee_picks=p_picks,invitee_submitted=true,updated_at=now() where id=c.id; end if;
end;$$;

create or replace function public.complete_friend_challenge(p_challenge_id uuid,p_my_score integer,p_other_score integer,p_result jsonb) returns void language plpgsql security definer set search_path=public,auth as $$
declare c public.friend_challenges%rowtype;inv_score integer;in_score integer;
begin
 select * into c from public.friend_challenges where id=p_challenge_id and auth.uid() in (inviter_id,invitee_id) for update;
 if c.id is null or c.status<>'accepted' or c.mode='weekly_h2h' or not(c.inviter_submitted and c.invitee_submitted) then raise exception 'Challenge not ready to complete'; end if;
 if auth.uid()=c.inviter_id then inv_score=p_my_score;in_score=p_other_score; else inv_score=p_other_score;in_score=p_my_score; end if;
 update public.friend_challenges set inviter_score=inv_score,invitee_score=in_score,result_json=p_result,status='completed',completed_at=now(),updated_at=now() where id=c.id;
end;$$;

create or replace function public.get_friend_weekly_matchup(p_challenge_id uuid)
returns table(my_correct integer,my_total integer,my_points integer,other_correct integer,other_total integer,other_points integer)
language plpgsql stable security definer set search_path=public,auth as $$
declare c public.friend_challenges%rowtype;me uuid;them uuid;wk text;
begin
 select * into c from public.friend_challenges where id=p_challenge_id and auth.uid() in (inviter_id,invitee_id);
 if c.id is null or c.mode<>'weekly_h2h' or c.status not in ('accepted','completed') then return; end if;
 me=auth.uid();them=case when me=c.inviter_id then c.invitee_id else c.inviter_id end;wk=to_char((date_trunc('week',now() at time zone 'UTC'))::date,'YYYY-MM-DD');
 return query with mine as(select coalesce(sum(correct_count),0)::int c,coalesce(sum(settled_count),0)::int t,coalesce(sum(points),0)::int p from public.challenge_cards where user_id=me and week_key=wk),theirs as(select coalesce(sum(correct_count),0)::int c,coalesce(sum(settled_count),0)::int t,coalesce(sum(points),0)::int p from public.challenge_cards where user_id=them and week_key=wk) select mine.c,mine.t,mine.p,theirs.c,theirs.t,theirs.p from mine,theirs;
end;$$;

revoke all on function public.get_my_friend_challenges() from public;
revoke all on function public.choose_friend_challenge_game(uuid,jsonb) from public;
revoke all on function public.randomize_friend_challenge_game(uuid) from public;
revoke all on function public.reset_friend_challenge_game_choices(uuid) from public;
revoke all on function public.submit_friend_challenge_picks(uuid,jsonb) from public;
revoke all on function public.complete_friend_challenge(uuid,integer,integer,jsonb) from public;
revoke all on function public.get_friend_weekly_matchup(uuid) from public;
grant execute on function public.get_my_friend_challenges() to authenticated;
grant execute on function public.choose_friend_challenge_game(uuid,jsonb) to authenticated;
grant execute on function public.randomize_friend_challenge_game(uuid) to authenticated;
grant execute on function public.reset_friend_challenge_game_choices(uuid) to authenticated;
grant execute on function public.submit_friend_challenge_picks(uuid,jsonb) to authenticated;
grant execute on function public.complete_friend_challenge(uuid,integer,integer,jsonb) to authenticated;
grant execute on function public.get_friend_weekly_matchup(uuid) to authenticated;
