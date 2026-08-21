import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { currentIndexFor, LEVELS, ShieldBadge } from './ScoutLevelView';
import { ScoutQrCode } from './ScoutQrCode';

type SocialKind = 'followers' | 'following' | 'friends';
export type ProfileSocialView = SocialKind | 'discover' | 'requests';
type FriendStatus = 'none' | 'incoming' | 'outgoing' | 'friends' | 'self';

interface ProfileHubViewProps {
  userEmail: string;
  onOpenWeekly: () => void;
  onOpenPredictions: () => void;
  onOpenLeaderboard: () => void;
  onOpenFriendsChallenge: () => void;
  onOpenScoutLevel: () => void;
  onOpenSettings: () => void;
  onOpenAdminReport?: (report: AdminReport) => void;
  initialProfileId?: string | null;
  initialSocialView?: ProfileSocialView | null;
  onInitialSocialConsumed?: () => void;
}

type SocialPerson = {
  profile_id: string;
  username?: string | null;
  display_name: string;
  avatar_url?: string | null;
  scout_level?: string | null;
  is_online?: boolean;
  is_following?: boolean;
  friend_status?: FriendStatus;
  friend_request_id?: string | null;
};

type PublicProfile = SocialPerson & { is_self?: boolean };
type FriendRequest = SocialPerson & { request_id: string; requested_at?: string | null };

export type AdminReport = {
  id: string;
  targetType: 'post' | 'comment';
  targetId: string;
  postId?: string | null;
  reason: string;
  details?: string | null;
  createdAt: string;
  target?: {
    author?: string | null;
    title?: string | null;
    body?: string | null;
    mediaType?: 'image' | 'video' | null;
    mediaUrl?: string | null;
    moderationStatus?: string | null;
  } | null;
};

const SITE_URL = 'https://scoutcoremlb.com';
const levelForName = (name?: string | null) => LEVELS.find((level) => level.name === name) ?? LEVELS[0];
const normalizeUsername = (value: string) => value.toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9_]/g, '').slice(0, 24);
const reportReasonLabel = (value: string) => ({
  explicit: 'Explicit / sexual content',
  harassment: 'Harassment / bullying',
  violence: 'Violent content',
  hate: 'Hateful content',
  spam: 'Spam',
  other: 'Other',
}[value] || value);

const Avatar: React.FC<{ name: string; url?: string | null; large?: boolean }> = ({ name, url, large }) => (
  <div data-i18n-user-content className={`${large ? 'h-28 w-28 text-4xl' : 'h-12 w-12 text-base'} flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#2a5268] bg-[#00f0ff] font-black text-[#00363a]`}>
    {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : (name.trim()[0] || 'U').toUpperCase()}
  </div>
);

const HubRow: React.FC<{ icon: string; title: string; detail: string; onClick: () => void }> = ({ icon, title, detail, onClick }) => (
  <button type="button" onClick={onClick} className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-[#142238] active:bg-[#18283f]">
    <span className="material-symbols-outlined text-[25px] text-[#7df4ff]">{icon}</span>
    <span className="min-w-0 flex-1"><span className="block text-base font-bold text-white">{title}</span><span className="mt-0.5 block text-sm text-[#93a1b5]">{detail}</span></span>
    <span className="material-symbols-outlined text-[#778aa4]">chevron_right</span>
  </button>
);

const requestButtonLabel = (status?: FriendStatus) => {
  if (status === 'friends') return 'FRIENDS';
  if (status === 'outgoing') return 'REQUEST SENT';
  if (status === 'incoming') return 'ACCEPT REQUEST';
  return 'ADD FRIEND';
};

export const ProfileHubView: React.FC<ProfileHubViewProps> = ({
  userEmail,
  onOpenWeekly,
  onOpenPredictions,
  onOpenLeaderboard,
  onOpenFriendsChallenge,
  onOpenScoutLevel,
  onOpenAdminReport,
  initialProfileId,
  initialSocialView,
  onInitialSocialConsumed,
}) => {
  const fallbackName = userEmail.split('@')[0] || 'ScoutCore User';
  const [displayName, setDisplayName] = useState(fallbackName);
  const [editName, setEditName] = useState(fallbackName);
  const [username, setUsername] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [points, setPoints] = useState(0);
  const [memberSince, setMemberSince] = useState('—');
  const [profileReady, setProfileReady] = useState(!supabase);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [qrOpen, setQrOpen] = useState(false);
  const [shareFeedback, setShareFeedback] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [counts, setCounts] = useState({ followers: 0, following: 0, friends: 0 });
  const [incomingCount, setIncomingCount] = useState(0);
  const [socialView, setSocialView] = useState<ProfileSocialView | null>(null);
  const [people, setPeople] = useState<SocialPerson[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<PublicProfile | null>(null);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [socialBusy, setSocialBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SocialPerson[]>([]);
  const [searched, setSearched] = useState(false);
  const [requestKind, setRequestKind] = useState<'incoming' | 'outgoing'>('incoming');
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminReports, setAdminReports] = useState<AdminReport[]>([]);
  const [adminReportsOpen, setAdminReportsOpen] = useState(false);
  const [adminQueueLoading, setAdminQueueLoading] = useState(false);

  const refreshAdminQueue = async () => {
    if (!supabase) return;
    setAdminQueueLoading(true);
    try {
      const status = await supabase.functions.invoke('community-moderate', { body: { action: 'admin_status' } });
      const allowed = status.data?.ok === true && status.data?.isAdmin === true;
      setIsAdmin(allowed);
      if (!allowed) { setAdminReports([]); return; }
      const queue = await supabase.functions.invoke('community-moderate', { body: { action: 'get_review_queue' } });
      if (!queue.error && queue.data?.ok) setAdminReports((queue.data.reports || []) as AdminReport[]);
    } finally {
      setAdminQueueLoading(false);
    }
  };

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
      const { data } = await supabase.from('challenge_scores').select('user_id,points').eq('user_id', user.id).maybeSingle();
      setPoints(Number(data?.points || 0));
    }
    await supabase.rpc('sync_my_social_profile');
    const { data: identityData } = await supabase.rpc('get_my_social_identity');
    const identity = Array.isArray(identityData) ? identityData[0] : identityData;
    if (identity?.profile_id) setProfileId(String(identity.profile_id));
    if (identity?.username) {
      setUsername(String(identity.username));
      setEditUsername(String(identity.username));
    }
  };

  const refreshCounts = async () => {
    if (!supabase) return;
    const [countRes, friendsRes, requestRes] = await Promise.all([
      supabase.rpc('get_my_follow_counts'),
      supabase.rpc('get_my_social_people', { p_kind: 'friends' }),
      supabase.rpc('get_my_friend_requests', { p_kind: 'incoming' }),
    ]);
    const row = Array.isArray(countRes.data) ? countRes.data[0] : countRes.data;
    setCounts({ followers: Number(row?.followers || 0), following: Number(row?.following || 0), friends: Array.isArray(friendsRes.data) ? friendsRes.data.length : 0 });
    setIncomingCount(Array.isArray(requestRes.data) ? requestRes.data.length : 0);
  };

  useEffect(() => {
    let active = true;
    setProfileReady(!supabase);
    if (!supabase) return () => { active = false; };
    void Promise.allSettled([refreshProfile(), refreshCounts(), refreshAdminQueue()]).then(() => { if (active) setProfileReady(true); });
    void supabase.rpc('touch_my_presence');
    const timer = window.setInterval(() => { void supabase.rpc('touch_my_presence'); }, 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [userEmail]);

  const openPublicProfile = async (targetId: string, from: ProfileSocialView = 'discover') => {
    if (!supabase) return;
    setSocialBusy(targetId);
    const { data, error } = await supabase.rpc('get_social_profile', { p_profile_id: targetId });
    const row = Array.isArray(data) ? data[0] : data;
    if (row) { setSocialView(from); setSelectedProfile(row as PublicProfile); setNotice(''); }
    else if (error) setNotice('This ScoutCore profile is not available.');
    setSocialBusy(null);
  };

  const loadRequests = async (kind: 'incoming' | 'outgoing') => {
    if (!supabase) return [] as FriendRequest[];
    const { data } = await supabase.rpc('get_my_friend_requests', { p_kind: kind });
    return (data ?? []) as FriendRequest[];
  };

  const openRequests = async (kind: 'incoming' | 'outgoing' = 'incoming') => {
    setSocialView('requests'); setSelectedProfile(null); setRequestKind(kind); setLoadingPeople(true);
    setRequests(await loadRequests(kind));
    setLoadingPeople(false);
  };

  useEffect(() => {
    if (initialProfileId) {
      void openPublicProfile(initialProfileId, 'discover');
      onInitialSocialConsumed?.();
    } else if (initialSocialView === 'requests') {
      void openRequests();
      onInitialSocialConsumed?.();
    } else if (initialSocialView === 'discover') {
      setSocialView('discover');
      onInitialSocialConsumed?.();
    } else if (initialSocialView === 'followers' || initialSocialView === 'following' || initialSocialView === 'friends') {
      void openSocial(initialSocialView);
      onInitialSocialConsumed?.();
    }
  }, [initialProfileId, initialSocialView]);

  const openSocial = async (kind: SocialKind) => {
    if (!supabase) return;
    setSocialView(kind); setSelectedProfile(null); setLoadingPeople(true);
    const { data } = await supabase.rpc('get_my_social_people', { p_kind: kind });
    setPeople((data ?? []) as SocialPerson[]); setLoadingPeople(false);
  };

  const refreshSelected = async (targetId: string) => {
    if (!supabase) return;
    const { data } = await supabase.rpc('get_social_profile', { p_profile_id: targetId });
    const row = Array.isArray(data) ? data[0] : data;
    if (row) setSelectedProfile(row as PublicProfile);
  };

  const toggleFollow = async (targetId: string) => {
    if (!supabase) return;
    setSocialBusy(targetId);
    const { error } = await supabase.rpc('toggle_social_follow', { p_profile_id: targetId });
    if (error) setNotice(error.message || 'Follow could not be updated.');
    if (selectedProfile?.profile_id === targetId) await refreshSelected(targetId);
    await refreshCounts(); setSocialBusy(null);
  };

  const sendRequest = async (targetId: string) => {
    if (!supabase) return;
    setSocialBusy(targetId); setNotice('');
    const { data, error } = await supabase.rpc('send_friend_request', { p_profile_id: targetId });
    if (error) setNotice(error.message || 'Friend request could not be sent.');
    else {
      const row = Array.isArray(data) ? data[0] : data;
      setNotice('Friend request sent.');
      setSearchResults((current) => current.map((person) => person.profile_id === targetId ? { ...person, friend_status: row?.friend_status || 'outgoing', friend_request_id: row?.request_id || null } : person));
      if (selectedProfile?.profile_id === targetId) await refreshSelected(targetId);
    }
    setSocialBusy(null);
  };

  const respondRequest = async (requestId: string, action: 'accept' | 'decline', targetId?: string) => {
    if (!supabase) return;
    setSocialBusy(requestId); setNotice('');
    const { error } = await supabase.rpc('respond_friend_request', { p_request_id: requestId, p_action: action });
    if (error) setNotice(error.message || 'Friend request could not be updated.');
    else {
      setNotice(action === 'accept' ? 'You are now friends.' : 'Friend request declined.');
      setRequests((current) => current.filter((request) => request.request_id !== requestId));
      if (targetId && selectedProfile?.profile_id === targetId) await refreshSelected(targetId);
      await refreshCounts();
    }
    setSocialBusy(null);
  };

  const cancelRequest = async (requestId: string, targetId?: string) => {
    if (!supabase) return;
    setSocialBusy(requestId);
    const { error } = await supabase.rpc('cancel_friend_request', { p_request_id: requestId });
    if (error) setNotice(error.message || 'Friend request could not be cancelled.');
    else {
      setNotice('Friend request cancelled.');
      setRequests((current) => current.filter((request) => request.request_id !== requestId));
      setSearchResults((current) => current.map((person) => person.friend_request_id === requestId ? { ...person, friend_status: 'none', friend_request_id: null } : person));
      if (targetId && selectedProfile?.profile_id === targetId) await refreshSelected(targetId);
    }
    setSocialBusy(null);
  };

  const searchProfiles = async () => {
    if (!supabase) return;
    setSearched(true); setNotice('');
    if (searchQuery.trim().replace(/^@/, '').length < 2) { setSearchResults([]); setNotice('Type at least 2 characters.'); return; }
    setLoadingPeople(true);
    const { data, error } = await supabase.rpc('search_social_profiles', { p_query: searchQuery.trim(), p_limit: 20 });
    setSearchResults((data ?? []) as SocialPerson[]);
    if (error) setNotice(error.message || 'Search is not available right now.');
    setLoadingPeople(false);
  };

  const saveProfile = async () => {
    if (!supabase) return;
    const nextUsername = normalizeUsername(editUsername);
    if (nextUsername.length < 3) { setFormError('Username must be at least 3 characters.'); return; }
    setSaving(true); setFormError('');
    const { error: nameError } = await supabase.auth.updateUser({ data: { display_name: editName.trim() || fallbackName } });
    if (nameError) { setFormError(nameError.message || 'Profile could not be saved.'); setSaving(false); return; }
    await supabase.rpc('sync_my_social_profile');
    const { error: usernameError } = await supabase.rpc('set_my_social_username', { p_username: nextUsername });
    if (usernameError) { setFormError(usernameError.message || 'Username could not be saved.'); setSaving(false); return; }
    await refreshProfile(); setEditing(false); setSaving(false);
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
      await supabase.rpc('sync_my_social_profile'); setAvatarUrl(data.publicUrl);
    }
    setSaving(false);
  };

  const profileLink = profileId ? `${SITE_URL}/?profile=${encodeURIComponent(profileId)}` : '';
  const copyLink = async () => {
    if (!profileLink) return;
    try { await navigator.clipboard.writeText(profileLink); setShareFeedback('Profile link copied.'); }
    catch { setShareFeedback('Press and hold the link to copy it.'); }
  };
  const shareLink = async () => {
    if (!profileLink) return;
    if (navigator.share) {
      try { await navigator.share({ title: `${displayName} on ScoutCoreMLB`, text: `Add @${username} on ScoutCoreMLB`, url: profileLink }); setShareFeedback('Profile shared.'); return; }
      catch { return; }
    }
    await copyLink();
  };

  const title = useMemo(() => socialView === 'discover' ? 'FIND FRIENDS' : socialView === 'requests' ? 'FRIEND REQUESTS' : (socialView || '').toUpperCase(), [socialView]);
  const currentLevel = LEVELS[currentIndexFor(points)];

  const renderQrModal = () => (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/75 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="scout-qr-title" className="w-full max-w-sm rounded-3xl border border-[#2a5268] bg-[#0d192c] p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div><div className="text-[10px] font-black uppercase tracking-[.16em] text-[#65f2b5]">Share profile</div><h2 id="scout-qr-title" className="mt-1 text-xl font-black text-white">My ScoutCore QR</h2></div>
          <button type="button" onClick={() => { setQrOpen(false); setShareFeedback(''); }} aria-label="Close QR code" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#324862] text-[#aab6c7]"><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="mt-5 flex justify-center">{profileLink ? <ScoutQrCode value={profileLink} size={232} /> : <div className="flex h-[232px] w-[232px] items-center justify-center rounded-2xl bg-white text-sm text-[#536176]">Preparing QR…</div>}</div>
        <div className="mt-4 text-center"><div data-i18n-user-content className="text-base font-black text-white">{displayName}</div><div data-i18n-user-content className="mt-1 text-sm font-bold text-[#50eaf4]">@{username || 'scout'}</div><p className="mt-3 text-xs leading-5 text-[#93a1b5]">Scan with the iPhone Camera to open this public profile. The QR contains only a safe profile link.</p></div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => void copyLink()} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#00e6f4] text-[11px] font-black text-[#50eaf4]"><span className="material-symbols-outlined text-[18px]">link</span>COPY LINK</button>
          <button type="button" onClick={() => void shareLink()} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#00e6f4] text-[11px] font-black text-[#06111f]"><span className="material-symbols-outlined text-[18px]">ios_share</span>SHARE</button>
        </div>
        {shareFeedback && <div role="status" className="mt-3 text-center text-[11px] text-[#65f2b5]">{shareFeedback}</div>}
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#283d55] bg-[#081225] px-3 py-3 text-[10px] leading-4 text-[#8797ab]"><span className="material-symbols-outlined text-[16px] text-[#65f2b5]">shield_lock</span><span>Your email, password, and private account ID are never stored in this QR.</span></div>
      </section>
    </div>
  );

  const renderPublicProfile = (profile: PublicProfile) => {
    const selectedLevel = levelForName(profile.scout_level);
    const friendStatus = profile.friend_status || 'none';
    const requestId = profile.friend_request_id || '';
    return <div className="min-h-screen bg-[#0b1326] px-4 py-6 text-[#dae2fd] sm:px-6 sm:py-8">
      <div className="mx-auto max-w-2xl">
        <button type="button" onClick={() => { setSelectedProfile(null); setNotice(''); }} className="mb-5 flex items-center gap-2 text-sm font-bold text-[#9aabc0]"><span className="material-symbols-outlined">arrow_back</span>Back to {title.toLowerCase()}</button>
        <section className="overflow-hidden rounded-2xl border border-[#2a405b] bg-[#101a2d] shadow-[0_18px_55px_rgba(0,0,0,.22)]">
          <div className="h-24 bg-[radial-gradient(circle_at_20%_0%,rgba(0,230,244,.30),transparent_45%),linear-gradient(120deg,#102d42,#11182d_72%)]" />
          <div className="px-5 pb-6 sm:px-8">
            <div className="-mt-14 flex items-end gap-4">
              <div className="rounded-full border-4 border-[#101a2d]"><Avatar name={profile.display_name} url={profile.avatar_url} large /></div>
              <div className="min-w-0 pb-2"><div className="text-[10px] font-black uppercase tracking-[.17em] text-[#65f2b5]">ScoutCore profile</div><h1 data-i18n-user-content className="mt-1 truncate text-2xl font-black text-white sm:text-3xl">{profile.display_name}</h1>{profile.username && <div data-i18n-user-content className="mt-0.5 truncate text-sm font-bold text-[#50eaf4]">@{profile.username}</div>}</div>
            </div>
            <div className="mt-5 flex items-center gap-4 rounded-2xl border border-[#2a405b] bg-[#0b1728] px-4 py-3"><ShieldBadge level={selectedLevel} active compact /><div className="min-w-0"><div className="text-[10px] font-bold uppercase tracking-[.14em] text-[#8fa0b5]">Scout Level</div><div className="mt-1 whitespace-nowrap text-base font-black text-white">{selectedLevel.name}</div><div className="mt-1 text-xs text-[#8392a6]">Public ScoutCore member profile</div></div></div>

            {!profile.is_self ? <>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={socialBusy === profile.profile_id || friendStatus === 'friends' || friendStatus === 'outgoing'}
                  onClick={() => friendStatus === 'incoming' && requestId ? void respondRequest(requestId, 'accept', profile.profile_id) : void sendRequest(profile.profile_id)}
                  className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-2 text-[10px] font-black ${friendStatus === 'none' || friendStatus === 'incoming' ? 'bg-[#00e6f4] text-[#06111f]' : friendStatus === 'friends' ? 'border border-[#65f2b5]/35 text-[#65f2b5]' : 'border border-[#3a4b63] text-[#aab6c7]'}`}
                ><span className="material-symbols-outlined text-[18px]">{friendStatus === 'friends' ? 'group' : friendStatus === 'incoming' ? 'person_check' : 'person_add'}</span>{requestButtonLabel(friendStatus)}</button>
                <button type="button" disabled={socialBusy === profile.profile_id} onClick={() => void toggleFollow(profile.profile_id)} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-2 text-[10px] font-black ${profile.is_following ? 'border border-[#3a4b63] text-[#d2dbea]' : 'border border-[#00e6f4] text-[#55edf5]'}`}><span className="material-symbols-outlined text-[18px]">{profile.is_following ? 'person_check' : 'person_add'}</span>{profile.is_following ? 'FOLLOWING' : 'FOLLOW'}</button>
              </div>
              {friendStatus === 'outgoing' && requestId && <button type="button" onClick={() => void cancelRequest(requestId, profile.profile_id)} className="mt-3 w-full text-[11px] font-bold text-[#91a0b4]">CANCEL FRIEND REQUEST</button>}
              {friendStatus === 'incoming' && requestId && <button type="button" onClick={() => void respondRequest(requestId, 'decline', profile.profile_id)} className="mt-3 w-full text-[11px] font-bold text-[#91a0b4]">DECLINE REQUEST</button>}
              {friendStatus === 'friends' && <button type="button" onClick={onOpenFriendsChallenge} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#00e6f4] px-3 text-xs font-black text-[#55edf5]"><span className="material-symbols-outlined text-[18px]">sports_baseball</span>START FRIENDS CHALLENGE</button>}
            </> : <div className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#65f2b5]/25 bg-[#65f2b5]/8 text-xs font-bold text-[#9fe8c9]"><span className="material-symbols-outlined text-[18px]">person</span>THIS IS YOU</div>}
            {notice && <div role="status" className="mt-4 rounded-xl border border-[#50eaf4]/25 bg-[#50eaf4]/5 px-4 py-3 text-xs text-[#bdeef1]">{notice}</div>}
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#283d55] bg-[#0a1424] px-4 py-3 text-xs leading-5 text-[#8fa0b5]"><span className="material-symbols-outlined mt-0.5 text-[17px] text-[#65f2b5]">shield_lock</span><span>Email and private account details stay hidden.</span></div>
          </div>
        </section>
      </div>
    </div>;
  };

  const smallAction = (person: SocialPerson) => {
    if (person.friend_status === 'friends') return <span className="shrink-0 rounded-lg border border-[#65f2b5]/30 px-2.5 py-2 text-[10px] font-black text-[#65f2b5]">FRIENDS</span>;
    if (person.friend_status === 'outgoing') return <button type="button" disabled={socialBusy === person.friend_request_id} onClick={() => person.friend_request_id && void cancelRequest(person.friend_request_id, person.profile_id)} className="shrink-0 rounded-lg border border-[#40516a] px-2.5 py-2 text-[10px] font-black text-[#aab6c7]">CANCEL</button>;
    if (person.friend_status === 'incoming') return <button type="button" disabled={socialBusy === person.friend_request_id} onClick={() => person.friend_request_id && void respondRequest(person.friend_request_id, 'accept', person.profile_id)} className="shrink-0 rounded-lg bg-[#00e6f4] px-2.5 py-2 text-[10px] font-black text-[#06111f]">ACCEPT</button>;
    return <button type="button" disabled={socialBusy === person.profile_id} onClick={() => void sendRequest(person.profile_id)} className="shrink-0 rounded-lg border border-[#00e6f4] px-2.5 py-2 text-[10px] font-black text-[#31e5ee]">ADD</button>;
  };

  if (socialView) {
    if (selectedProfile) return renderPublicProfile(selectedProfile);
    const isSocialList = socialView === 'followers' || socialView === 'following' || socialView === 'friends';

    return <div className="min-h-screen bg-[#0b1326] px-4 py-6 text-[#dae2fd] sm:px-6 sm:py-8">
      <div className="mx-auto max-w-2xl">
        <header className="flex items-center gap-3 border-b border-[#263951] pb-4">
          <button type="button" onClick={() => { setSocialView(null); setNotice(''); }} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#2d4059]"><span className="material-symbols-outlined">arrow_back</span></button>
          <h1 className="min-w-0 flex-1 text-xl font-black text-white">{title}</h1>
          {socialView !== 'discover' && <button type="button" onClick={() => { setSocialView('discover'); setNotice(''); }} className="flex h-10 items-center gap-1 rounded-xl border border-[#00e6f4]/50 px-3 text-[10px] font-black text-[#50eaf4]"><span className="material-symbols-outlined text-[18px]">person_search</span>FIND</button>}
        </header>

        {socialView === 'discover' && <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setQrOpen(true)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#00e6f4] text-xs font-black text-[#50eaf4]"><span className="material-symbols-outlined text-[19px]">qr_code_2</span>MY QR</button>
            <button type="button" onClick={() => void openRequests()} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#344a64] text-xs font-black text-white"><span className="material-symbols-outlined text-[19px] text-[#65f2b5]">person_add</span>REQUESTS{incomingCount > 0 && <span className="rounded-full bg-[#00e6f4] px-2 py-0.5 text-[9px] text-[#06111f]">{incomingCount}</span>}</button>
          </div>
          <form onSubmit={(event) => { event.preventDefault(); void searchProfiles(); }} className="mt-4 flex gap-2">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#324862] bg-[#081225] px-3 focus-within:border-[#00e6f4]"><span className="material-symbols-outlined text-[20px] text-[#50eaf4]">search</span><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search @username or name" autoCapitalize="none" autoCorrect="off" className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white outline-none placeholder:text-[#687990]" /></label>
            <button type="submit" className="rounded-xl bg-[#00e6f4] px-4 text-xs font-black text-[#06111f]">SEARCH</button>
          </form>
          {notice && <div role="status" className="mt-3 text-xs text-[#aeb9ca]">{notice}</div>}
          <div className="mt-4 overflow-hidden rounded-2xl border border-[#2a405b] bg-[#0c1627]">
            {loadingPeople ? <div className="py-16 text-center text-sm text-[#8fa0b5]">Searching…</div> : searchResults.length ? searchResults.map((person) => (
              <div key={person.profile_id} className="flex items-center gap-3 border-b border-[#263951] px-4 py-3 last:border-b-0">
                <button type="button" onClick={() => void openPublicProfile(person.profile_id)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><div className="relative"><Avatar name={person.display_name} url={person.avatar_url} /><span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#0c1627] ${person.is_online ? 'bg-[#36e276]' : 'bg-[#718090]'}`} /></div><span className="min-w-0 flex-1"><span data-i18n-user-content className="block truncate text-sm font-bold text-white">{person.display_name}</span><span data-i18n-user-content className="mt-0.5 block truncate text-xs text-[#50eaf4]">@{person.username || 'scout'}</span></span></button>
                {smallAction(person)}
              </div>
            )) : <div className="px-6 py-16 text-center text-sm text-[#8fa0b5]">{searched ? 'No matching ScoutCore profiles.' : 'Search by username to add a friend.'}</div>}
          </div>
        </>}

        {socialView === 'requests' && <>
          <div className="mt-4 grid grid-cols-2 rounded-xl border border-[#2a405b] bg-[#0c1627] p-1">
            {(['incoming', 'outgoing'] as const).map((kind) => <button type="button" key={kind} onClick={() => void openRequests(kind)} className={`rounded-lg py-2.5 text-[11px] font-black ${requestKind === kind ? 'bg-[#00e6f4] text-[#06111f]' : 'text-[#95a5b9]'}`}>{kind.toUpperCase()}</button>)}
          </div>
          {notice && <div role="status" className="mt-3 text-xs text-[#aeb9ca]">{notice}</div>}
          <div className="mt-4 overflow-hidden rounded-2xl border border-[#2a405b] bg-[#0c1627]">
            {loadingPeople ? <div className="py-16 text-center text-sm text-[#8fa0b5]">Loading…</div> : requests.length ? requests.map((request) => (
              <div key={request.request_id} className="border-b border-[#263951] px-4 py-3 last:border-b-0">
                <button type="button" onClick={() => void openPublicProfile(request.profile_id, 'requests')} className="flex w-full items-center gap-3 text-left"><Avatar name={request.display_name} url={request.avatar_url} /><span className="min-w-0 flex-1"><span data-i18n-user-content className="block truncate text-sm font-bold text-white">{request.display_name}</span><span data-i18n-user-content className="mt-0.5 block truncate text-xs text-[#50eaf4]">@{request.username || 'scout'}</span></span><span className="material-symbols-outlined text-[#71839b]">chevron_right</span></button>
                <div className="mt-3 grid grid-cols-2 gap-2">{requestKind === 'incoming' ? <><button type="button" onClick={() => void respondRequest(request.request_id, 'accept', request.profile_id)} className="rounded-lg bg-[#00e6f4] py-2.5 text-[10px] font-black text-[#06111f]">ACCEPT</button><button type="button" onClick={() => void respondRequest(request.request_id, 'decline', request.profile_id)} className="rounded-lg border border-[#40516a] py-2.5 text-[10px] font-black text-[#aab6c7]">DECLINE</button></> : <button type="button" onClick={() => void cancelRequest(request.request_id, request.profile_id)} className="col-span-2 rounded-lg border border-[#40516a] py-2.5 text-[10px] font-black text-[#aab6c7]">CANCEL REQUEST</button>}</div>
              </div>
            )) : <div className="px-6 py-16 text-center text-sm text-[#8fa0b5]">No {requestKind} friend requests.</div>}
          </div>
        </>}

        {isSocialList && <div className="mt-4 overflow-hidden rounded-2xl border border-[#2a405b] bg-[#0c1627]">
          {loadingPeople ? <div className="py-16 text-center text-sm text-[#8fa0b5]">Loading…</div> : people.length ? people.map((person) => (
            <div key={person.profile_id} className="flex items-center gap-3 border-b border-[#263951] px-4 py-3 last:border-b-0">
              <button type="button" onClick={() => void openPublicProfile(person.profile_id, socialView)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><div className="relative"><Avatar name={person.display_name} url={person.avatar_url} />{socialView === 'friends' && <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#0c1627] ${person.is_online ? 'bg-[#36e276]' : 'bg-[#718090]'}`} />}</div><span className="min-w-0 flex-1"><span data-i18n-user-content className="block truncate text-sm font-bold text-white">{person.display_name}</span><span className="mt-0.5 block truncate text-xs text-[#50eaf4]"><span data-i18n-user-content>@{person.username || 'scout'}</span> <span className="text-[#8392a6]">· {person.scout_level || 'Rookie Scout'}</span></span></span><span className="material-symbols-outlined text-[#71839b]">chevron_right</span></button>
              {socialView === 'followers' && <button type="button" disabled={socialBusy === person.profile_id} onClick={() => void toggleFollow(person.profile_id)} className={`shrink-0 rounded-lg px-3 py-2 text-[10px] font-black ${person.is_following ? 'border border-[#40516a] text-[#9aa8bb]' : 'border border-[#00e6f4] text-[#31e5ee]'}`}>{person.is_following ? 'FOLLOWING' : 'FOLLOW BACK'}</button>}
            </div>
          )) : <div className="py-16 text-center text-sm text-[#8fa0b5]">No {socialView} yet.</div>}
        </div>}
      </div>
      {qrOpen && renderQrModal()}
    </div>;
  }

  return <div className="sc-profile-hub min-h-screen bg-[#0b1326] px-6 py-8 text-[#dae2fd] lg:px-8">
    <div className="mx-auto max-w-5xl space-y-5">
      <section aria-busy={!profileReady} className="sc-profile-card relative overflow-hidden rounded-2xl border border-[#2a405b] bg-[radial-gradient(circle_at_10%_5%,rgba(0,240,255,.17),transparent_30%),linear-gradient(120deg,#0a1d31,#0b1728_58%,#101a2d)] shadow-[0_12px_36px_rgba(0,0,0,.18)]">
        {!profileReady && <div role="status" aria-live="polite" className="absolute inset-0 z-10 flex items-center justify-center"><div className="flex flex-col items-center gap-3 text-xs font-bold uppercase tracking-[.14em] text-[#8ea2b8]"><span className="h-8 w-8 animate-spin rounded-full border-2 border-[#2a5268] border-t-[#31e5ee]" /><span>Loading profile</span></div></div>}
        <div aria-hidden={!profileReady} className={`sc-profile-card-body relative px-8 py-8 transition-opacity duration-150 ${profileReady ? 'opacity-100' : 'pointer-events-none select-none opacity-0'}`}>
          <button type="button" onClick={() => { setFormError(''); setEditing(true); }} aria-label="Edit profile" title="Edit profile" className="sc-profile-edit absolute right-6 top-6 flex h-11 w-11 items-center justify-center rounded-xl border border-[#00e6f4] bg-[#07101f]/75 text-[#31e5ee] backdrop-blur hover:bg-[#102038]"><span className="material-symbols-outlined text-[22px]">edit</span></button>
          <div className="sc-profile-identity flex items-center gap-6 pr-20">
            <div className="sc-profile-avatar-wrap relative shrink-0"><Avatar name={displayName} url={avatarUrl} large /><input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAvatar(file); event.currentTarget.value = ''; }} /></div>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><div className="text-xs font-black uppercase tracking-[.18em] text-[#65f2b5]">{isAdmin ? 'ScoutCore Admin Account' : 'ScoutCore Profile'}</div>{isAdmin && <span className="rounded-full border border-[#ffd166]/45 bg-[#ffd166]/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] text-[#ffd166]">ADMIN · UNLIMITED</span>}</div><h1 data-i18n-user-content className="mt-1 truncate text-4xl font-black leading-tight text-white">{displayName}</h1>{username && <div data-i18n-user-content className="mt-0.5 truncate text-sm font-bold text-[#50eaf4]">@{username}</div>}<div data-i18n-user-content className="sc-profile-email mt-1 truncate text-xs text-[#8c9aae]">{userEmail}</div></div>
          </div>

          <div className="sc-profile-summary mt-8 grid grid-cols-3 divide-x divide-[#274058] border-t border-[#263d55] pt-6 text-center">
            <div className="sc-profile-summary-item px-4"><div className="text-xs text-[#a7b3c3]">Member Since</div><div className="mt-2 flex items-center justify-center gap-2"><span className="material-symbols-outlined text-[21px] text-[#d9e4f5]">calendar_month</span><span className="text-base font-bold text-white">{memberSince}</span></div></div>
            <div className="sc-profile-summary-item px-4"><div className="text-xs text-[#a7b3c3]">Total Points</div><div className="mt-2 flex items-center justify-center gap-2"><span className="material-symbols-outlined text-[22px] text-[#ffd21f]">star</span><span className="text-2xl font-black text-white">{points.toLocaleString()}</span></div></div>
            <button type="button" onClick={onOpenScoutLevel} aria-label={`Scout Level: ${currentLevel.name}`} title={currentLevel.name} className="sc-profile-summary-item sc-profile-level px-4"><div className="text-xs text-[#a7b3c3]">Scout Level</div><div className="sc-profile-level-value mt-1 flex flex-col items-center justify-center gap-0"><ShieldBadge level={currentLevel} active compact /><span className="sc-profile-level-name -mt-1 block whitespace-nowrap text-[10px] font-black text-white">{currentLevel.name}</span></div></button>
          </div>

          <div className="sc-profile-social-grid mt-6 grid grid-cols-3 overflow-hidden rounded-xl border border-[#2a405b] bg-[#0b1728]/78">
            <button type="button" onClick={() => void openSocial('followers')} className="sc-profile-social-cell flex items-center justify-center gap-3 border-r border-[#2a405b] px-4 py-4"><span className="material-symbols-outlined text-[27px] text-[#31e5ee]">group</span><span><span className="block text-xs text-[#a5b1c1]">Followers</span><span className="block text-2xl font-black leading-none text-white">{counts.followers}</span></span></button>
            <button type="button" onClick={() => void openSocial('following')} className="sc-profile-social-cell flex items-center justify-center gap-3 border-r border-[#2a405b] px-4 py-4"><span className="material-symbols-outlined text-[27px] text-[#31e5ee]">person</span><span><span className="block text-xs text-[#a5b1c1]">Following</span><span className="block text-2xl font-black leading-none text-white">{counts.following}</span></span></button>
            <button type="button" onClick={() => void openSocial('friends')} className="sc-profile-social-cell flex items-center justify-center gap-3 px-4 py-4"><span className="material-symbols-outlined text-[27px] text-[#31e5ee]">groups</span><span><span className="block text-xs text-[#a5b1c1]">Friends</span><span className="block text-2xl font-black leading-none text-white">{counts.friends}</span></span></button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => { setSocialView('discover'); setSelectedProfile(null); }} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#00e6f4] text-[11px] font-black text-[#50eaf4]"><span className="material-symbols-outlined text-[18px]">person_search</span>FIND FRIENDS{incomingCount > 0 && <span className="rounded-full bg-[#00e6f4] px-1.5 py-0.5 text-[9px] text-[#06111f]">{incomingCount}</span>}</button>
            <button type="button" onClick={() => setQrOpen(true)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#344a64] text-[11px] font-black text-white"><span className="material-symbols-outlined text-[18px] text-[#50eaf4]">qr_code_2</span>MY QR</button>
          </div>
        </div>
      </section>

      {isAdmin && <section className="overflow-hidden rounded-2xl border border-[#ffd166]/35 bg-[radial-gradient(circle_at_95%_0%,rgba(255,209,102,.12),transparent_38%),#101a2d]">
        <button type="button" onClick={() => setAdminReportsOpen((value) => !value)} className="flex w-full items-center gap-4 px-5 py-4 text-left">
          <span className="material-symbols-outlined flex h-11 w-11 items-center justify-center rounded-xl bg-[#ffd166]/10 text-[#ffd166]">admin_panel_settings</span>
          <span className="min-w-0 flex-1"><span className="block text-[10px] font-black uppercase tracking-[.16em] text-[#ffd166]">ADMIN CONSOLE</span><span className="mt-1 block text-lg font-black text-white">Community Reports</span><span className="mt-1 block text-xs text-[#9cacc0]">Review reported posts and replies, then dismiss, warn, or delete.</span></span>
          <span className="flex min-w-8 items-center justify-center rounded-full bg-[#ffb4ab] px-2 py-1 text-[11px] font-black text-[#3a0710]">{adminReports.length}</span>
          <span className="material-symbols-outlined text-[#8798ad]">{adminReportsOpen ? 'expand_less' : 'expand_more'}</span>
        </button>
        {adminReportsOpen && <div className="border-t border-[#344259] p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-3"><p className="text-xs font-bold text-[#aebbd0]">{adminReports.length} open reports</p><button type="button" onClick={() => void refreshAdminQueue()} disabled={adminQueueLoading} className="rounded-lg border border-[#40516a] px-3 py-2 text-[10px] font-black text-[#50eaf4] disabled:opacity-50">{adminQueueLoading ? 'REFRESHING…' : 'REFRESH REPORTS'}</button></div>
          {adminQueueLoading && !adminReports.length ? <div className="rounded-xl border border-dashed border-[#40516a] px-4 py-8 text-center text-sm text-[#8fa0b5]">Loading reports…</div> : adminReports.length ? <div className="space-y-3">{adminReports.map((report) => <article key={report.id} className="rounded-xl border border-[#344761] bg-[#0b1425] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="rounded-full bg-[#ffb4ab]/10 px-2.5 py-1 text-[9px] font-black uppercase text-[#ffb4ab]">{report.targetType === 'comment' ? 'REPORTED REPLY' : 'REPORTED POST'}</span><span className="text-[10px] text-[#7f90a5]">{new Date(report.createdAt).toLocaleString()}</span></div><span className="text-[10px] font-bold uppercase text-[#ffd166]">{reportReasonLabel(report.reason)}</span></div>
            <div className="mt-3 rounded-lg border-l-2 border-[#00e6f4]/45 bg-[#111d31] px-3 py-3"><div data-i18n-user-content className="text-xs font-bold text-[#65f2b5]">{report.target?.author || 'ScoutCore user'}</div>{report.target?.title && <div data-i18n-user-content className="mt-1 font-bold text-white">{report.target.title}</div>}<p data-i18n-user-content className="mt-1 line-clamp-3 text-xs leading-5 text-[#bdc8d7]">{report.target?.body || 'This content is no longer available.'}</p></div>
            {report.target?.mediaUrl && report.target.mediaType === 'image' && <img src={report.target.mediaUrl} alt="Reported Community upload" className="mt-3 max-h-64 w-full rounded-xl border border-[#344761] bg-black object-contain" />}
            {report.target?.mediaUrl && report.target.mediaType === 'video' && <video src={report.target.mediaUrl} controls playsInline preload="metadata" className="mt-3 max-h-64 w-full rounded-xl border border-[#344761] bg-black" />}
            {report.details && <p className="mt-2 text-[11px] leading-5 text-[#95a5b8]"><span className="font-bold text-[#c7d0dd]">Reporter note:</span> <span data-i18n-user-content>{report.details}</span></p>}
            <button type="button" onClick={() => onOpenAdminReport?.(report)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#00e6f4] px-4 py-3 text-xs font-black text-[#00363a]"><span className="material-symbols-outlined text-[18px]">visibility</span>OPEN REPORTED CONTENT</button>
          </article>)}</div> : <div className="rounded-xl border border-[#65f2b5]/25 bg-[#65f2b5]/5 px-4 py-8 text-center"><span className="material-symbols-outlined text-3xl text-[#65f2b5]">verified_user</span><p className="mt-2 text-sm font-bold text-white">No open reports</p><p className="mt-1 text-xs text-[#8fa0b5]">The Community report queue is clear.</p></div>}
        </div>}
      </section>}

      <section className="sc-profile-activity rounded-2xl border border-[#2a405b] bg-[#101a2d] p-4">
        <div className="sc-profile-activity-title px-2 pb-2 text-xs font-bold uppercase tracking-[.16em] text-[#65f2b5]">ScoutCore Activity</div>
        <div className="sc-profile-activity-list divide-y divide-[#2a405b] overflow-hidden rounded-xl border border-[#263951] bg-[#0c1627]"><HubRow icon="emoji_events" title="Weekly Challenge" detail="Your ScoutCore-wide weekly competition" onClick={onOpenWeekly} /><HubRow icon="sports_baseball" title="Friends Challenge" detail="Head-to-head, same-game and Team Up challenges" onClick={onOpenFriendsChallenge} /><HubRow icon="track_changes" title="My Predictions" detail="Upcoming, finished and statistics" onClick={onOpenPredictions} /><HubRow icon="leaderboard" title="Leaderboard" detail="See ScoutCore rankings" onClick={onOpenLeaderboard} /><HubRow icon="explore" title="Your Scout Level" detail="Points, badges and progress" onClick={onOpenScoutLevel} /></div>
      </section>
      <section className="sc-profile-footer flex items-center justify-center gap-2 rounded-2xl border border-[#2a405b] bg-[#0c1627] p-4 text-center text-sm text-[#9aa8bb]"><span className="material-symbols-outlined text-[18px] text-[#d9e4f5]">shield</span><span>Friends Challenge is free to play.</span></section>
    </div>

    {editing && <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 p-4"><div className="w-full max-w-md rounded-2xl border border-[#2a405b] bg-[#101a2d] p-5"><div className="flex items-center justify-between"><h2 className="text-xl font-black text-white">Edit Profile</h2><button type="button" onClick={() => setEditing(false)}><span className="material-symbols-outlined text-[#9aa8bb]">close</span></button></div><label className="mt-5 block text-xs font-bold text-[#9aa8bb]">Display name</label><input value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={40} className="mt-2 w-full rounded-xl border border-[#324862] bg-[#081225] px-4 py-3 text-white outline-none focus:border-[#00e6f4]" /><label className="mt-4 block text-xs font-bold text-[#9aa8bb]">Unique username</label><div className="mt-2 flex items-center rounded-xl border border-[#324862] bg-[#081225] px-4 focus-within:border-[#00e6f4]"><span className="font-bold text-[#50eaf4]">@</span><input value={editUsername} onChange={(event) => setEditUsername(normalizeUsername(event.target.value))} minLength={3} maxLength={24} autoCapitalize="none" autoCorrect="off" className="min-w-0 flex-1 bg-transparent py-3 text-white outline-none" /></div><p className="mt-2 text-[10px] text-[#778aa0]">3–24 letters, numbers, or underscores. People can search this name.</p><button type="button" onClick={() => fileRef.current?.click()} className="mt-3 w-full rounded-xl border border-[#324862] px-4 py-3 text-sm font-bold text-[#b9c5d6]">CHANGE PROFILE PICTURE</button>{formError && <div role="alert" className="mt-3 rounded-xl border border-[#ff6577]/30 bg-[#ff6577]/5 px-3 py-2 text-xs text-[#ff9cab]">{formError}</div>}<button type="button" disabled={saving} onClick={() => void saveProfile()} className="mt-3 w-full rounded-xl bg-[#00e6f4] px-4 py-3 text-sm font-black text-[#06111f] disabled:opacity-50">{saving ? 'SAVING…' : 'SAVE PROFILE'}</button></div></div>}
    {qrOpen && renderQrModal()}
  </div>;
};
