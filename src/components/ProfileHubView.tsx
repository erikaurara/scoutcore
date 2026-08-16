import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../services/supabaseClient';

interface ProfileHubViewProps {
  userEmail: string;
  onOpenWeekly: () => void;
  onOpenPredictions: () => void;
  onOpenLeaderboard: () => void;
  onOpenFriendsChallenge: () => void;
  onOpenScoutLevel: () => void;
  onOpenSettings: () => void;
}

type SocialKind = 'followers' | 'friends' | 'following';
type SocialPerson = {
  profile_id: string;
  display_name: string;
  avatar_url?: string | null;
  scout_level?: string | null;
  is_online?: boolean;
  is_following?: boolean;
};
type PublicProfile = SocialPerson & { is_self?: boolean };

const HubRow: React.FC<{ icon: string; title: string; detail: string; onClick: () => void }> = ({ icon, title, detail, onClick }) => (
  <button type="button" onClick={onClick} className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-[#142238] active:bg-[#18283f]">
    <span className="material-symbols-outlined text-[25px] text-[#7df4ff]">{icon}</span>
    <span className="min-w-0 flex-1">
      <span className="block text-base font-bold text-white">{title}</span>
      <span className="mt-0.5 block text-sm text-[#93a1b5]">{detail}</span>
    </span>
    <span className="material-symbols-outlined text-[#778aa4]">chevron_right</span>
  </button>
);

const Avatar: React.FC<{ name: string; url?: string | null; large?: boolean }> = ({ name, url, large }) => (
  <div className={`${large ? 'h-28 w-28 text-4xl' : 'h-12 w-12 text-base'} flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#2a5268] bg-[#00f0ff] font-black text-[#00363a]`}>
    {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : (name.trim()[0] || 'U').toUpperCase()}
  </div>
);

const scoutLevelForPoints = (points: number) => {
  if (points >= 5000) return 'ScoutCore All-Star';
  if (points >= 2000) return 'Elite Scout';
  if (points >= 750) return 'Pro Scout';
  if (points >= 250) return 'Advanced Scout';
  return 'Rookie Scout';
};

export const ProfileHubView: React.FC<ProfileHubViewProps> = ({
  userEmail,
  onOpenWeekly,
  onOpenPredictions,
  onOpenLeaderboard,
  onOpenFriendsChallenge,
  onOpenScoutLevel,
}) => {
  const fallbackName = userEmail.split('@')[0] || 'ScoutCore User';
  const [displayName, setDisplayName] = useState(fallbackName);
  const [editName, setEditName] = useState(fallbackName);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [points, setPoints] = useState(0);
  const [memberSince, setMemberSince] = useState('—');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [counts, setCounts] = useState({ followers: 0, friends: 0, following: 0 });
  const [socialKind, setSocialKind] = useState<SocialKind | null>(null);
  const [people, setPeople] = useState<SocialPerson[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<PublicProfile | null>(null);
  const [socialBusy, setSocialBusy] = useState<string | null>(null);

  const refreshProfile = async () => {
    if (!supabase) return;
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    const meta = user?.user_metadata || {};
    const nextName = String(meta.display_name || meta.full_name || meta.name || fallbackName);
    setDisplayName(nextName);
    setEditName(nextName);
    setAvatarUrl(meta.avatar_url ? String(meta.avatar_url) : null);
    if (user?.created_at) setMemberSince(new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(new Date(user.created_at)));
    if (user?.id) {
      const { data: scoreData } = await supabase.from('challenge_scores').select('user_id,points').eq('user_id', user.id).maybeSingle();
      setPoints(Number(scoreData?.points || 0));
    }
    await supabase.rpc('sync_my_social_profile');
  };

  const refreshCounts = async () => {
    if (!supabase) return;
    const [countRes, friendsRes] = await Promise.all([
      supabase.rpc('get_my_follow_counts'),
      supabase.rpc('get_my_social_people', { p_kind: 'friends' }),
    ]);
    const row = Array.isArray(countRes.data) ? countRes.data[0] : countRes.data;
    setCounts({
      followers: Number(row?.followers || 0),
      friends: Array.isArray(friendsRes.data) ? friendsRes.data.length : 0,
      following: Number(row?.following || 0),
    });
  };

  useEffect(() => {
    void refreshProfile();
    void refreshCounts();
    if (!supabase) return;
    void supabase.rpc('touch_my_presence');
    const timer = window.setInterval(() => { void supabase.rpc('touch_my_presence'); }, 60_000);
    return () => window.clearInterval(timer);
  }, [userEmail]);

  const openSocial = async (kind: SocialKind) => {
    if (!supabase) return;
    setSocialKind(kind);
    setSelectedProfile(null);
    setLoadingPeople(true);
    const { data } = await supabase.rpc('get_my_social_people', { p_kind: kind });
    setPeople((data ?? []) as SocialPerson[]);
    setLoadingPeople(false);
  };

  const reloadOpenSocial = async () => {
    if (!supabase || !socialKind) return;
    const { data } = await supabase.rpc('get_my_social_people', { p_kind: socialKind });
    setPeople((data ?? []) as SocialPerson[]);
    await refreshCounts();
  };

  const openPerson = async (person: SocialPerson) => {
    if (!supabase) return;
    const { data } = await supabase.rpc('get_social_profile', { p_profile_id: person.profile_id });
    const row = Array.isArray(data) ? data[0] : data;
    if (row) setSelectedProfile(row as PublicProfile);
  };

  const toggleFollow = async (profileId: string) => {
    if (!supabase) return;
    setSocialBusy(profileId);
    await supabase.rpc('toggle_social_follow', { p_profile_id: profileId });
    await reloadOpenSocial();
    if (selectedProfile?.profile_id === profileId) {
      const { data } = await supabase.rpc('get_social_profile', { p_profile_id: profileId });
      const row = Array.isArray(data) ? data[0] : data;
      if (row) setSelectedProfile(row as PublicProfile);
    }
    setSocialBusy(null);
  };

  const saveProfile = async () => {
    if (!supabase) return;
    setSaving(true);
    await supabase.auth.updateUser({ data: { display_name: editName.trim() || fallbackName } });
    await supabase.rpc('sync_my_social_profile');
    await refreshProfile();
    setEditing(false);
    setSaving(false);
  };

  const uploadAvatar = async (file: File) => {
    if (!supabase) return;
    setSaving(true);
    const extension = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `public/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    const { error } = await supabase.storage.from('profile-avatars').upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (!error) {
      const { data } = supabase.storage.from('profile-avatars').getPublicUrl(path);
      await supabase.auth.updateUser({ data: { avatar_url: data.publicUrl, display_name: editName.trim() || displayName } });
      await supabase.rpc('sync_my_social_profile');
      setAvatarUrl(data.publicUrl);
    }
    setSaving(false);
  };

  const title = useMemo(() => socialKind ? socialKind.toUpperCase() : '', [socialKind]);
  const levelName = scoutLevelForPoints(points);

  if (socialKind) {
    if (selectedProfile) {
      return <div className="min-h-screen bg-[#0b1326] px-6 py-8 text-[#dae2fd]">
        <div className="mx-auto max-w-2xl">
          <button onClick={() => setSelectedProfile(null)} className="mb-5 flex items-center gap-2 text-sm font-bold text-[#9aabc0]"><span className="material-symbols-outlined">arrow_back</span>{title}</button>
          <section className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-8 text-center">
            <div className="flex justify-center"><Avatar name={selectedProfile.display_name} url={selectedProfile.avatar_url} large /></div>
            <h1 className="mt-4 text-3xl font-black text-white">{selectedProfile.display_name}</h1>
            <div className="mt-1 text-xs font-bold uppercase tracking-[.12em] text-[#65f2b5]">{selectedProfile.scout_level || 'Rookie Scout'}</div>
            {!selectedProfile.is_self && <button disabled={socialBusy === selectedProfile.profile_id} onClick={() => void toggleFollow(selectedProfile.profile_id)} className={`mt-6 rounded-xl px-7 py-3 text-sm font-black ${selectedProfile.is_following ? 'border border-[#3a4b63] text-[#b8c4d4]' : 'bg-[#00e6f4] text-[#06111f]'}`}>{selectedProfile.is_following ? 'FOLLOWING' : 'FOLLOW'}</button>}
          </section>
        </div>
      </div>;
    }

    return <div className="min-h-screen bg-[#0b1326] px-6 py-8 text-[#dae2fd]">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-3 border-b border-[#263951] pb-4">
          <button onClick={() => setSocialKind(null)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#2d4059]"><span className="material-symbols-outlined">arrow_back</span></button>
          <h1 className="text-xl font-black text-white">{title}</h1>
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-[#2a405b] bg-[#0c1627]">
          {loadingPeople ? <div className="py-16 text-center text-sm text-[#8fa0b5]">Loading…</div> : people.length ? people.map(person => (
            <div key={person.profile_id} className="flex items-center gap-3 border-b border-[#263951] px-4 py-3 last:border-b-0">
              <button onClick={() => void openPerson(person)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <div className="relative"><Avatar name={person.display_name} url={person.avatar_url} />{socialKind === 'friends' && <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#0c1627] ${person.is_online ? 'bg-[#36e276]' : 'bg-[#718090]'}`} />}</div>
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold text-white">{person.display_name}</div><div className={`mt-0.5 text-xs ${socialKind === 'friends' ? (person.is_online ? 'text-[#36e276]' : 'text-[#8392a6]') : 'text-[#8392a6]'}`}>{socialKind === 'friends' ? (person.is_online ? 'Online' : 'Offline') : (person.scout_level || 'ScoutCore user')}</div></div>
                <span className="material-symbols-outlined text-[#71839b]">chevron_right</span>
              </button>
              {socialKind === 'followers' && <button disabled={socialBusy === person.profile_id} onClick={() => void toggleFollow(person.profile_id)} className={`shrink-0 rounded-lg px-3 py-2 text-[11px] font-black ${person.is_following ? 'border border-[#40516a] text-[#9aa8bb]' : 'border border-[#00e6f4] text-[#31e5ee]'}`}>{person.is_following ? 'FOLLOWING' : 'FOLLOW BACK'}</button>}
            </div>
          )) : <div className="py-16 text-center text-sm text-[#8fa0b5]">No {socialKind} yet.</div>}
        </div>
      </div>
    </div>;
  }

  return (
    <div className="sc-profile-hub min-h-screen bg-[#0b1326] px-6 py-8 text-[#dae2fd] lg:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <section className="overflow-hidden rounded-2xl border border-[#2a405b] bg-[radial-gradient(circle_at_10%_5%,rgba(0,240,255,.17),transparent_30%),linear-gradient(120deg,#0a1d31,#0b1728_58%,#101a2d)] shadow-[0_12px_36px_rgba(0,0,0,.18)]">
          <div className="relative px-8 py-8">
            <button type="button" onClick={() => setEditing(true)} aria-label="Edit profile" title="Edit profile" className="absolute right-6 top-6 flex h-11 w-11 items-center justify-center rounded-xl border border-[#00e6f4] bg-[#07101f]/75 text-[#31e5ee] backdrop-blur hover:bg-[#102038]">
              <span className="material-symbols-outlined text-[22px]">edit</span>
            </button>

            <div className="flex items-center gap-6 pr-20">
              <div className="relative shrink-0">
                <Avatar name={displayName} url={avatarUrl} large />
                <button onClick={() => fileRef.current?.click()} aria-label="Change profile picture" className="absolute -bottom-1 right-0 flex h-9 w-9 items-center justify-center rounded-full border border-[#2a405b] bg-[#0b1326] text-white shadow-lg"><span className="material-symbols-outlined text-[18px]">photo_camera</span></button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f=e.target.files?.[0]; if (f) void uploadAvatar(f); e.currentTarget.value=''; }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-black uppercase tracking-[.18em] text-[#65f2b5]">ScoutCore Profile</div>
                <h1 className="mt-1 truncate text-4xl font-black leading-tight text-white">{displayName}</h1>
                <div className="mt-1 truncate text-base text-[#a1adbe]">{userEmail}</div>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-3 divide-x divide-[#274058] border-t border-[#263d55] pt-6 text-center">
              <button type="button" onClick={onOpenScoutLevel} className="sc-profile-level px-4">
                <div className="text-xs text-[#a7b3c3]">Scout Level</div>
                <div className="sc-profile-level-value mt-2 flex items-center justify-center gap-2"><span className="sc-profile-level-icon material-symbols-outlined text-[22px] text-[#25e7ef]">hexagon</span><span className="sc-profile-level-name text-lg font-black text-[#32e8f0]">{levelName}</span></div>
              </button>
              <div className="px-4"><div className="text-xs text-[#a7b3c3]">Total Points</div><div className="mt-2 flex items-center justify-center gap-2"><span className="material-symbols-outlined text-[22px] text-[#ffd21f]">star</span><span className="text-2xl font-black text-white">{points.toLocaleString()}</span></div></div>
              <div className="px-4"><div className="text-xs text-[#a7b3c3]">Member Since</div><div className="mt-2 flex items-center justify-center gap-2"><span className="material-symbols-outlined text-[21px] text-[#d9e4f5]">calendar_month</span><span className="text-base font-bold text-white">{memberSince}</span></div></div>
            </div>

            <div className="mt-6 grid grid-cols-3 overflow-hidden rounded-xl border border-[#2a405b] bg-[#0b1728]/78">
              <button onClick={() => void openSocial('followers')} className="flex items-center justify-center gap-3 border-r border-[#2a405b] px-4 py-4"><span className="material-symbols-outlined text-[27px] text-[#31e5ee]">group</span><span><span className="block text-xs text-[#a5b1c1]">Followers</span><span className="block text-2xl font-black leading-none text-white">{counts.followers}</span></span></button>
              <button onClick={() => void openSocial('following')} className="flex items-center justify-center gap-3 border-r border-[#2a405b] px-4 py-4"><span className="material-symbols-outlined text-[27px] text-[#31e5ee]">person</span><span><span className="block text-xs text-[#a5b1c1]">Following</span><span className="block text-2xl font-black leading-none text-white">{counts.following}</span></span></button>
              <button onClick={() => void openSocial('friends')} className="flex items-center justify-center gap-3 px-4 py-4"><span className="material-symbols-outlined text-[27px] text-[#31e5ee]">groups</span><span><span className="block text-xs text-[#a5b1c1]">Friends</span><span className="block text-2xl font-black leading-none text-white">{counts.friends}</span></span></button>
            </div>
          </div>
        </section>

        <section className="sc-profile-activity rounded-2xl border border-[#2a405b] bg-[#101a2d] p-4">
          <div className="px-2 pb-2 text-xs font-bold uppercase tracking-[.16em] text-[#65f2b5]">ScoutCore Activity</div>
          <div className="divide-y divide-[#2a405b] overflow-hidden rounded-xl border border-[#263951] bg-[#0c1627]">
            <HubRow icon="emoji_events" title="Weekly Challenge" detail="Your ScoutCore-wide weekly competition" onClick={onOpenWeekly} />
            <HubRow icon="sports_baseball" title="Friends Challenge" detail="Head-to-head, same-game and Team Up challenges · 0 tickets" onClick={onOpenFriendsChallenge} />
            <HubRow icon="track_changes" title="My Predictions" detail="Upcoming, finished and statistics" onClick={onOpenPredictions} />
            <HubRow icon="explore" title="Your Scout Level" detail="Points, badges and progress" onClick={onOpenScoutLevel} />
          </div>
        </section>

        <section className="sc-profile-footer rounded-2xl border border-[#2a405b] bg-[#0c1627] p-4 text-center text-sm text-[#9aa8bb]">🛡 Predictions are free. No tickets required.</section>
      </div>

      {editing && <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 p-4"><div className="w-full max-w-md rounded-2xl border border-[#2a405b] bg-[#101a2d] p-5"><div className="flex items-center justify-between"><h2 className="text-xl font-black text-white">Edit Profile</h2><button onClick={() => setEditing(false)}><span className="material-symbols-outlined text-[#9aa8bb]">close</span></button></div><label className="mt-5 block text-xs font-bold text-[#9aa8bb]">Display name</label><input value={editName} onChange={e => setEditName(e.target.value)} maxLength={40} className="mt-2 w-full rounded-xl border border-[#324862] bg-[#081225] px-4 py-3 text-white outline-none focus:border-[#00e6f4]" /><button onClick={() => fileRef.current?.click()} className="mt-3 w-full rounded-xl border border-[#324862] px-4 py-3 text-sm font-bold text-[#b9c5d6]">CHANGE PROFILE PICTURE</button><button disabled={saving} onClick={() => void saveProfile()} className="mt-3 w-full rounded-xl bg-[#00e6f4] px-4 py-3 text-sm font-black text-[#06111f] disabled:opacity-50">{saving ? 'SAVING…' : 'SAVE PROFILE'}</button></div></div>}
    </div>
  );
};
