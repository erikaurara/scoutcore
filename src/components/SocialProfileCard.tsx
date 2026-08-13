import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';

export type SocialProfileTarget = {
  profileId?: string | null;
  displayName: string;
  avatarUrl?: string | null;
};

type SocialProfileRow = {
  profile_id?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  scout_level?: string | null;
  is_self?: boolean | null;
  is_following?: boolean | null;
};

interface SocialProfileCardProps {
  target: SocialProfileTarget | null;
  signedIn: boolean;
  onOpenAuth: () => void;
  onClose: () => void;
  onFollowChanged?: () => void;
}

const initials = (name: string) => (name || 'ScoutCore User')
  .trim()
  .split(/\s+/)
  .slice(0, 2)
  .map((part) => part[0]?.toUpperCase())
  .join('') || 'S';

export const SocialAvatar: React.FC<{
  displayName: string;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md';
}> = ({ displayName, avatarUrl, size = 'sm' }) => {
  const sizeClass = size === 'xs' ? 'h-7 w-7 text-[9px]' : size === 'md' ? 'h-12 w-12 text-sm' : 'h-9 w-9 text-[11px]';
  return <span className={`${sizeClass} inline-flex shrink-0 overflow-hidden rounded-full border border-[#38506e] bg-[#0b1425] align-middle font-extrabold text-[#00e6f4]`}>
    {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center bg-[#00e6f4]/10">{initials(displayName)}</span>}
  </span>;
};

export const SocialProfileCard: React.FC<SocialProfileCardProps> = ({ target, signedIn, onOpenAuth, onClose, onFollowChanged }) => {
  const [profile, setProfile] = useState<SocialProfileRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) {
      setProfile(null);
      setError(null);
      return;
    }
    setProfile({
      profile_id: target.profileId ?? null,
      display_name: target.displayName,
      avatar_url: target.avatarUrl ?? null,
      scout_level: null,
      is_self: false,
      is_following: false,
    });
    if (!target.profileId || !supabase) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    supabase.rpc('get_social_profile', { p_profile_id: target.profileId }).then(({ data, error: rpcError }) => {
      if (cancelled) return;
      if (rpcError) {
        setError('Profile details are not available yet.');
      } else {
        const row = Array.isArray(data) ? data[0] : data;
        if (row) setProfile(row as SocialProfileRow);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [target?.profileId, target?.displayName, target?.avatarUrl]);

  if (!target) return null;

  const shownName = profile?.display_name || target.displayName || 'ScoutCore User';
  const shownAvatar = profile?.avatar_url ?? target.avatarUrl ?? null;
  const isSelf = Boolean(profile?.is_self);
  const isFollowing = Boolean(profile?.is_following);

  const toggleFollow = async () => {
    if (!signedIn) {
      onClose();
      onOpenAuth();
      return;
    }
    if (!supabase || !target.profileId || isSelf || followBusy) return;
    setFollowBusy(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('toggle_social_follow', { p_profile_id: target.profileId });
    if (rpcError) {
      setError('Could not update follow status right now.');
    } else {
      const next = Boolean(data);
      setProfile((current) => ({ ...(current ?? {}), is_following: next }));
      onFollowChanged?.();
    }
    setFollowBusy(false);
  };

  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
    <section className="w-full max-w-sm overflow-hidden rounded-2xl border border-[#344761] bg-[#0d1727] shadow-[0_28px_90px_rgba(0,0,0,.55)]" onClick={(event) => event.stopPropagation()}>
      <div className="h-20 bg-[radial-gradient(circle_at_20%_0%,rgba(0,230,244,.28),transparent_48%),linear-gradient(120deg,#17254a,#0d1426_65%)]" />
      <div className="relative px-5 pb-5">
        <button type="button" onClick={onClose} aria-label="Close profile" className="absolute right-4 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[#07101f]/80 text-[#aab7c9] hover:text-white"><span className="material-symbols-outlined text-[18px]">close</span></button>
        <div className="-mt-9 flex items-end gap-3">
          <div className="rounded-full border-4 border-[#0d1727]"><SocialAvatar displayName={shownName} avatarUrl={shownAvatar} size="md" /></div>
          <div className="min-w-0 pb-1"><h3 className="truncate text-xl font-extrabold text-white">{shownName}</h3><p className="mt-0.5 text-[10px] font-bold uppercase tracking-[.12em] text-[#65f2b5]">{profile?.scout_level || 'ScoutCore User'}</p></div>
        </div>

        <div className="mt-5 rounded-xl border border-[#2b405b] bg-[#10192b] px-4 py-3 text-xs leading-5 text-[#aebbd0]">
          Follow users you meet in Community and live game chats. Follower and following totals are private and are only shown to the account owner.
        </div>

        {error && <div className="mt-3 rounded-lg border border-[#ffd166]/25 bg-[#ffd166]/7 px-3 py-2 text-[10px] text-[#e7d9aa]">{error}</div>}

        <div className="mt-4">
          {isSelf ? <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#65f2b5]/25 bg-[#65f2b5]/8 px-4 py-3 text-xs font-bold text-[#9fe8c9]"><span className="material-symbols-outlined text-[18px]">person</span>THIS IS YOU</div>
            : <button type="button" onClick={() => void toggleFollow()} disabled={followBusy || loading || !target.profileId} className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-extrabold transition disabled:opacity-45 ${isFollowing ? 'border border-[#40516b] bg-[#10192b] text-[#d5ddea] hover:border-[#ff8d94]/50' : 'bg-[#00e6f4] text-[#062029]'}`}><span className="material-symbols-outlined text-[18px]">{isFollowing ? 'person_check' : 'person_add'}</span>{followBusy ? 'UPDATING…' : isFollowing ? 'FOLLOWING' : signedIn ? 'FOLLOW' : 'LOG IN TO FOLLOW'}</button>}
        </div>
      </div>
    </section>
  </div>;
};
