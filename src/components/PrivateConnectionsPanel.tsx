import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { SocialAvatar } from './SocialProfileCard';

type Connection = {
  profile_id: string;
  display_name: string;
  avatar_url?: string | null;
  scout_level?: string | null;
  followed_at?: string | null;
};

export const PrivateConnectionsPanel: React.FC = () => {
  const [followers, setFollowers] = useState<Connection[]>([]);
  const [following, setFollowing] = useState<Connection[]>([]);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [tab, setTab] = useState<'following' | 'followers'>('following');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [available, setAvailable] = useState(true);

  const load = async () => {
    if (!supabase) { setAvailable(false); setLoading(false); return; }
    setLoading(true);
    await supabase.rpc('sync_my_social_profile').catch(() => null);
    const [countResult, followerResult, followingResult] = await Promise.all([
      supabase.rpc('get_my_follow_counts'),
      supabase.rpc('get_my_followers'),
      supabase.rpc('get_my_following'),
    ]);
    if (countResult.error || followerResult.error || followingResult.error) {
      setAvailable(false);
      setLoading(false);
      return;
    }
    const countRow = Array.isArray(countResult.data) ? countResult.data[0] : countResult.data;
    setCounts({ followers: Number(countRow?.followers || 0), following: Number(countRow?.following || 0) });
    setFollowers((followerResult.data ?? []) as Connection[]);
    setFollowing((followingResult.data ?? []) as Connection[]);
    setAvailable(true);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const unfollow = async (profileId: string) => {
    if (!supabase || busyId) return;
    setBusyId(profileId);
    const { error } = await supabase.rpc('toggle_social_follow', { p_profile_id: profileId });
    if (!error) await load();
    setBusyId(null);
  };

  if (!available) return null;
  const rows = tab === 'following' ? following : followers;

  return <section className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#65f2b5]"><span className="material-symbols-outlined text-[15px]">lock</span>Private connections</div><h2 className="mt-1 text-xl font-extrabold text-white">Following & Followers</h2><p className="mt-1 text-xs text-[#849495]">Only you can see these counts and lists.</p></div>
      <div className="flex overflow-hidden rounded-xl border border-[#30415c] bg-[#0b1425]">
        <button type="button" onClick={() => setTab('following')} className={`px-4 py-2.5 text-left ${tab === 'following' ? 'bg-[#00e6f4]/12 text-white' : 'text-[#9aa8bc]'}`}><span className="block text-[9px] font-bold uppercase tracking-wider">Following</span><span className="block text-lg font-extrabold">{counts.following}</span></button>
        <button type="button" onClick={() => setTab('followers')} className={`border-l border-[#30415c] px-4 py-2.5 text-left ${tab === 'followers' ? 'bg-[#00e6f4]/12 text-white' : 'text-[#9aa8bc]'}`}><span className="block text-[9px] font-bold uppercase tracking-wider">Followers</span><span className="block text-lg font-extrabold">{counts.followers}</span></button>
      </div>
    </div>

    <div className="mt-4 overflow-hidden rounded-xl border border-[#263951] bg-[#0c1627]">
      {loading ? <div className="p-5 text-center text-xs text-[#849495]">Loading private connections…</div> : rows.length ? rows.map((row) => <div key={`${tab}-${row.profile_id}`} className="flex items-center gap-3 border-t border-[#263951] px-4 py-3 first:border-t-0">
        <SocialAvatar displayName={row.display_name} avatarUrl={row.avatar_url} />
        <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold text-white">{row.display_name}</div><div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[#65f2b5]">{row.scout_level || 'Rookie Scout'}</div></div>
        {tab === 'following' && <button type="button" onClick={() => void unfollow(row.profile_id)} disabled={busyId === row.profile_id} className="rounded-lg border border-[#40516b] px-3 py-2 text-[10px] font-bold text-[#c8d2df] hover:border-[#ff8d94]/45 hover:text-[#ffb0b5] disabled:opacity-45">{busyId === row.profile_id ? 'UPDATING…' : 'FOLLOWING'}</button>}
      </div>) : <div className="p-5 text-center"><span className="material-symbols-outlined text-2xl text-[#526275]">group</span><p className="mt-2 text-sm font-semibold text-white">{tab === 'following' ? 'Not following anyone yet' : 'No followers yet'}</p><p className="mt-1 text-xs text-[#849495]">{tab === 'following' ? 'Follow people from Community posts or live game chat.' : 'People who follow you will appear here privately.'}</p></div>}
    </div>
  </section>;
};
