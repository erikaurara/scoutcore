import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { SocialAvatar, SocialProfileCard, type SocialProfileTarget } from './SocialProfileCard';

type CommunityComment = {
  id: string;
  userId: string;
  author: string;
  body: string;
  createdAt: string;
  parentId?: string | null;
};

type CommunityPost = {
  id: string;
  userId: string;
  author: string;
  title: string;
  body: string;
  category: 'Game Thread' | 'Analysis' | 'Hot Take';
  createdAt: string;
  likes: number;
  liked: boolean;
  mediaType?: 'image' | 'video' | null;
  mediaPath?: string | null;
  mediaUrl?: string | null;
  moderationStatus?: string | null;
  reactions: Record<string, number>;
  myReactions: string[];
  comments: CommunityComment[];
};

type ActivitySocial = {
  activity_type: 'post' | 'comment';
  activity_id: string;
  profile_id?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
};

interface CommunityViewProps {
  signedIn: boolean;
  userEmail?: string | null;
  onOpenAuth: () => void;
}

const REACTIONS = ['🔥', '👏', '⚾', '😂', '💙', '😮'] as const;
const REPORT_REASONS = [
  { value: 'explicit', label: 'Explicit / sexual content' },
  { value: 'harassment', label: 'Harassment / bullying' },
  { value: 'violence', label: 'Violent content' },
  { value: 'hate', label: 'Hateful content' },
  { value: 'spam', label: 'Spam' },
  { value: 'other', label: 'Other' },
] as const;

const relativeTime = (value: string) => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const fileKind = (file: File | null): 'image' | 'video' | null => {
  if (!file) return null;
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return null;
};

const isJwtClockError = (error: unknown) =>
  /jwt issued at future/i.test(String((error as any)?.message ?? error ?? ''));

const communityErrorMessage = (error: any, fallback: string) =>
  isJwtClockError(error)
    ? 'Your session is syncing. Please try again in a moment.'
    : error?.message || fallback;

const socialKey = (type: 'post' | 'comment', id: string) => `${type}:${id}`;

export const CommunityView: React.FC<CommunityViewProps> = ({ signedIn, userEmail, onOpenAuth }) => {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [filter, setFilter] = useState<'All' | CommunityPost['category']>('All');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<CommunityPost['category']>('Game Thread');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<Record<string, { commentId: string; author: string } | null>>({});
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<{ type: 'post' | 'comment'; id: string; label: string } | null>(null);
  const [reportReason, setReportReason] = useState<(typeof REPORT_REASONS)[number]['value']>('other');
  const [reportDetails, setReportDetails] = useState('');
  const [reporting, setReporting] = useState(false);
  const [socialProfiles, setSocialProfiles] = useState<Record<string, ActivitySocial>>({});
  const [selectedSocial, setSelectedSocial] = useState<SocialProfileTarget | null>(null);

  useEffect(() => {
    if (!mediaFile) { setMediaPreview(null); return; }
    const url = URL.createObjectURL(mediaFile);
    setMediaPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [mediaFile]);

  const loadPosts = async (allowAuthRetry = true) => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError && isJwtClockError(userError) && allowAuthRetry) {
        const refreshed = await supabase.auth.refreshSession();
        if (!refreshed.error) {
          await loadPosts(false);
          return;
        }
      }
      const currentUserId = userError ? null : (userData.user?.id ?? null);
      if (currentUserId) await supabase.rpc('sync_my_social_profile').catch(() => null);

      const [postResult, commentResult, likeResult, reactionResult, socialResult] = await Promise.all([
        supabase.from('community_posts').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('community_comments').select('*').order('created_at', { ascending: true }).limit(700),
        supabase.from('community_likes').select('*').limit(3000),
        supabase.from('community_reactions').select('*').limit(5000),
        supabase.rpc('get_community_social_profiles', { p_post_limit: 100, p_comment_limit: 700 }),
      ]);

      const authClockError = [postResult.error, commentResult.error, likeResult.error, reactionResult.error].find(isJwtClockError);
      if (authClockError && allowAuthRetry) {
        const refreshed = await supabase.auth.refreshSession();
        if (!refreshed.error) {
          await loadPosts(false);
          return;
        }
      }

      if (postResult.error) throw postResult.error;
      if (commentResult.error) throw commentResult.error;
      if (likeResult.error) throw likeResult.error;

      if (!socialResult.error) {
        const nextSocial: Record<string, ActivitySocial> = {};
        for (const row of (socialResult.data ?? []) as ActivitySocial[]) nextSocial[socialKey(row.activity_type, row.activity_id)] = row;
        setSocialProfiles(nextSocial);
      } else {
        setSocialProfiles({});
      }

      const reactionRows = reactionResult.error ? [] : (reactionResult.data ?? []);
      const postRows = (postResult.data ?? []).filter((row: any) => !row.moderation_status || row.moderation_status === 'approved');
      const commentRows = (commentResult.data ?? []).filter((row: any) => !row.moderation_status || row.moderation_status === 'approved');
      const likeRows = likeResult.data ?? [];

      const mapped = await Promise.all(postRows.map(async (row: any): Promise<CommunityPost> => {
        const likes = likeRows.filter((like: any) => like.post_id === row.id);
        const reactions = reactionRows.filter((reaction: any) => reaction.post_id === row.id);
        const reactionCounts = Object.fromEntries(REACTIONS.map(emoji => [emoji, reactions.filter((reaction: any) => reaction.emoji === emoji).length]));
        const comments = commentRows
          .filter((comment: any) => comment.post_id === row.id)
          .map((comment: any) => ({
            id: comment.id,
            userId: comment.user_id,
            author: comment.author_name,
            body: comment.body,
            createdAt: comment.created_at,
            parentId: comment.parent_comment_id ?? null,
          }));

        let mediaUrl: string | null = null;
        if (row.media_path) {
          const signed = await supabase.storage.from('community-media').createSignedUrl(row.media_path, 60 * 60);
          mediaUrl = signed.data?.signedUrl ?? null;
        }

        return {
          id: row.id,
          userId: row.user_id,
          author: row.author_name,
          title: row.title,
          body: row.body,
          category: row.category,
          createdAt: row.created_at,
          likes: likes.length,
          liked: Boolean(currentUserId && likes.some((like: any) => like.user_id === currentUserId)),
          mediaType: row.media_type ?? null,
          mediaPath: row.media_path ?? null,
          mediaUrl,
          moderationStatus: row.moderation_status ?? 'approved',
          reactions: reactionCounts,
          myReactions: currentUserId ? reactions.filter((reaction: any) => reaction.user_id === currentUserId).map((reaction: any) => reaction.emoji) : [],
          comments,
        };
      }));
      setPosts(mapped);
    } catch (err: any) {
      setError(communityErrorMessage(err, 'Unable to load Community right now.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadPosts(); }, [signedIn]);

  const visiblePosts = useMemo(() => filter === 'All' ? posts : posts.filter(post => post.category === filter), [posts, filter]);

  const chooseMedia = (file: File | null) => {
    setError(null);
    if (!file) { setMediaFile(null); return; }
    const kind = fileKind(file);
    if (!kind) { setError('Please choose a JPG, PNG, WebP, MP4, WebM, or MOV file.'); return; }
    const limit = kind === 'image' ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
    if (file.size > limit) { setError(kind === 'image' ? 'Photos must be 10 MB or smaller.' : 'Videos must be 50 MB or smaller.'); return; }
    setMediaFile(file);
  };

  const publish = async () => {
    if (!signedIn) { onOpenAuth(); return; }
    if (!supabase || !title.trim() || (!body.trim() && !mediaFile)) return;
    setPublishing(true);
    setError(null);
    setNotice(null);
    let quarantinePath: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) { onOpenAuth(); return; }

      const kind = fileKind(mediaFile);
      if (mediaFile && kind) {
        const cleanName = mediaFile.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80) || 'upload';
        quarantinePath = `${user.id}/${crypto.randomUUID()}-${cleanName}`;
        const uploaded = await supabase.storage.from('community-quarantine').upload(quarantinePath, mediaFile, {
          upsert: false,
          contentType: mediaFile.type,
        });
        if (uploaded.error) throw uploaded.error;
      }

      const invoked = await supabase.functions.invoke('community-moderate', {
        body: {
          action: 'publish_post',
          title: title.trim(),
          body: body.trim(),
          category,
          mediaPath: quarantinePath,
          mediaType: kind,
        },
      });
      if (invoked.error) throw invoked.error;
      const result = invoked.data ?? {};
      if (!result.ok) {
        setError(result.warning || result.error || 'This post could not be published.');
        return;
      }

      setTitle(''); setBody(''); setMediaFile(null);
      if (result.pending) {
        setNotice(result.message || 'Your video is private while it waits for safety review.');
      } else {
        setNotice('Posted. The safety check passed.');
        await loadPosts();
      }
    } catch (err: any) {
      if (quarantinePath) await supabase.storage.from('community-quarantine').remove([quarantinePath]).catch(() => {});
      setError(communityErrorMessage(err, 'Unable to publish this post.'));
    } finally {
      setPublishing(false);
    }
  };

  const toggleLike = async (post: CommunityPost) => {
    if (!signedIn) { onOpenAuth(); return; }
    if (!supabase) return;
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) { onOpenAuth(); return; }
    const result = post.liked
      ? await supabase.from('community_likes').delete().eq('post_id', post.id).eq('user_id', user.id)
      : await supabase.from('community_likes').insert({ post_id: post.id, user_id: user.id });
    if (result.error) { setError(communityErrorMessage(result.error, 'Unable to update this like.')); return; }
    await loadPosts();
  };

  const toggleReaction = async (post: CommunityPost, emoji: string) => {
    if (!signedIn) { onOpenAuth(); return; }
    if (!supabase) return;
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) { onOpenAuth(); return; }
    const active = post.myReactions.includes(emoji);
    const result = active
      ? await supabase.from('community_reactions').delete().eq('post_id', post.id).eq('user_id', user.id).eq('emoji', emoji)
      : await supabase.from('community_reactions').insert({ post_id: post.id, user_id: user.id, emoji });
    if (result.error) { setError(communityErrorMessage(result.error, 'Unable to update this reaction.')); return; }
    await loadPosts();
  };

  const addReply = async (postId: string) => {
    if (!signedIn) { onOpenAuth(); return; }
    if (!supabase) return;
    const text = (commentDrafts[postId] || '').trim();
    if (!text) return;
    setError(null);
    const target = replyingTo[postId];
    const invoked = await supabase.functions.invoke('community-moderate', {
      body: { action: 'reply', postId, parentCommentId: target?.commentId ?? null, body: text },
    });
    if (invoked.error) { setError(communityErrorMessage(invoked.error, 'Unable to post this reply.')); return; }
    const result = invoked.data ?? {};
    if (!result.ok) { setError(result.warning || result.error || 'This reply could not be posted.'); return; }
    setCommentDrafts(current => ({ ...current, [postId]: '' }));
    setReplyingTo(current => ({ ...current, [postId]: null }));
    await loadPosts();
  };

  const insertReplyEmoji = (postId: string, emoji: string) => {
    setCommentDrafts(current => ({ ...current, [postId]: `${current[postId] || ''}${emoji}` }));
  };

  const submitReport = async () => {
    if (!reportTarget) return;
    if (!signedIn) { onOpenAuth(); return; }
    if (!supabase) return;
    setReporting(true);
    setError(null);
    try {
      const invoked = await supabase.functions.invoke('community-moderate', {
        body: {
          action: 'report',
          targetType: reportTarget.type,
          targetId: reportTarget.id,
          reason: reportReason,
          details: reportDetails.trim(),
        },
      });
      if (invoked.error) throw invoked.error;
      const result = invoked.data ?? {};
      if (!result.ok) throw new Error(result.error || 'Unable to submit this report.');
      setNotice(result.message || 'Report received.');
      setReportTarget(null); setReportReason('other'); setReportDetails('');
      if (result.removed) await loadPosts();
    } catch (err: any) {
      setError(communityErrorMessage(err, 'Unable to submit this report.'));
    } finally {
      setReporting(false);
    }
  };

  const openSocialProfile = (type: 'post' | 'comment', id: string, fallbackName: string) => {
    const social = socialProfiles[socialKey(type, id)];
    setSelectedSocial({ profileId: social?.profile_id ?? null, displayName: social?.display_name || fallbackName, avatarUrl: social?.avatar_url ?? null });
  };

  const canPublish = Boolean(title.trim() && (body.trim() || mediaFile));

  return <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] px-3 py-5 sm:px-6 lg:px-8">
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-[10px] font-label-caps text-[#65f2b5] mb-2">SCOUTCOREMLB COMMUNITY</div>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#dbfcff]">Community</h1>
          <p className="text-sm text-[#aebbc8] mt-2 max-w-2xl">Talk baseball, share photos or clips, follow other ScoutCore users, reply to fans, and react to game discussions.</p>
        </div>
        <div className="rounded-xl border border-[#65f2b5]/20 bg-[#65f2b5]/5 px-4 py-3 text-xs text-[#b9cacb]"><span className="text-[#65f2b5] font-bold">SAFETY CHECK</span> · New text and photos are reviewed before they can appear publicly.</div>
      </header>

      {error && <div className="rounded-xl border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 p-3 text-sm text-[#ffb4ab]">{error}</div>}
      {notice && <div className="rounded-xl border border-[#65f2b5]/25 bg-[#65f2b5]/10 p-3 text-sm text-[#9ef5cf]">{notice}</div>}

      <section className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-4"><div><p className="text-[10px] font-label-caps text-[#00f0ff]">CREATE A POST</p><h2 className="font-bold text-lg">Share with the community</h2></div>{!signedIn && <button onClick={onOpenAuth} className="rounded-lg border border-[#00f0ff]/35 px-3 py-2 text-xs text-[#00f0ff] hover:bg-[#00f0ff]/10">SIGN IN TO POST</button>}</div>
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_180px] gap-3"><input value={title} onChange={e => setTitle(e.target.value)} maxLength={90} placeholder="Post title — e.g. Dodgers bullpen matchup tonight" className="h-11 rounded-lg border border-[#30415c] bg-[#0b1425] px-3 text-sm outline-none focus:border-[#00f0ff]"/><select value={category} onChange={e => setCategory(e.target.value as CommunityPost['category'])} className="h-11 rounded-lg border border-[#30415c] bg-[#0b1425] px-3 text-sm outline-none"><option>Game Thread</option><option>Analysis</option><option>Hot Take</option></select></div>
        <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={700} placeholder="What are you seeing? Keep it baseball-focused and respectful." className="mt-3 min-h-28 w-full resize-y rounded-lg border border-[#30415c] bg-[#0b1425] p-3 text-sm outline-none focus:border-[#00f0ff]"/>

        {mediaPreview && <div className="mt-3 overflow-hidden rounded-xl border border-[#30415c] bg-[#08111f] relative">{fileKind(mediaFile) === 'image' ? <img src={mediaPreview} alt="Selected upload preview" className="max-h-[420px] w-full object-contain"/> : <video src={mediaPreview} controls className="max-h-[420px] w-full bg-black"/>}<button type="button" onClick={() => setMediaFile(null)} className="absolute top-3 right-3 rounded-full bg-black/70 w-8 h-8 text-white">×</button></div>}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#30415c] bg-[#0b1425] px-3 py-2 text-xs text-[#b9cacb] hover:border-[#00f0ff]/60"><span className="material-symbols-outlined text-[18px] text-[#00f0ff]">add_photo_alternate</span>PHOTO / VIDEO<input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" className="hidden" onChange={e => chooseMedia(e.target.files?.[0] ?? null)}/></label>
            <span className="text-[11px] text-[#849495]">Photos ≤10 MB · videos ≤50 MB</span>
          </div>
          <div className="flex items-center gap-3"><span className="text-[11px] text-[#849495]">{body.length}/700</span><button onClick={publish} disabled={!canPublish || publishing} className="rounded-lg bg-[#00e6f4] px-5 py-2.5 text-xs font-bold text-[#002c31] disabled:opacity-40">{publishing ? 'SAFETY CHECK…' : 'POST TO COMMUNITY'}</button></div>
        </div>
        <p className="mt-3 text-[11px] leading-5 text-[#849495]">Photos and text must pass automated safety review before publishing. Videos stay private until a dedicated video safety scanner approves them. Reported content is re-checked.</p>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1">{(['All','Game Thread','Analysis','Hot Take'] as const).map(item => <button key={item} onClick={() => setFilter(item)} className={`whitespace-nowrap rounded-full px-4 py-2 text-xs border ${filter === item ? 'bg-[#00e6f4] border-[#00e6f4] text-[#002c31] font-bold' : 'border-[#30415c] text-[#b9cacb] bg-[#101a2d]'}`}>{item === 'All' ? 'LATEST' : item.toUpperCase()}</button>)}</div>

      <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-5 items-start">
        <div className="space-y-4">
          {loading && <div className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-8 text-center text-sm text-[#849495]">Loading Community…</div>}
          {!loading && visiblePosts.length === 0 && <div className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-8 text-center"><div className="mx-auto w-12 h-12 rounded-full bg-[#00f0ff]/10 flex items-center justify-center text-[#00f0ff] mb-3"><span className="material-symbols-outlined">forum</span></div><h3 className="font-bold">No posts yet</h3><p className="text-sm text-[#849495] mt-1">Be the first to start a game thread or share an analysis.</p></div>}

          {visiblePosts.map(post => {
            const topLevel = post.comments.filter(comment => !comment.parentId);
            const postSocial = socialProfiles[socialKey('post', post.id)];
            return <article key={post.id} className="rounded-2xl border border-[#2a405b] bg-[#101a2d] overflow-hidden">
              <div className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]"><div className="flex items-center gap-2"><span className="rounded-full bg-[#00f0ff]/10 px-2.5 py-1 font-bold text-[#00f0ff]">{post.category.toUpperCase()}</span><span className="text-[#849495]">{relativeTime(post.createdAt)}</span></div><button onClick={() => setReportTarget({ type: 'post', id: post.id, label: post.title })} className="inline-flex items-center gap-1 text-[#849495] hover:text-[#ffb4ab]"><span className="material-symbols-outlined text-[16px]">flag</span>REPORT</button></div>
                <h2 className="mt-3 text-xl font-bold text-[#dbfcff]">{post.title}</h2>
                {post.body && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#c7d0dd]">{post.body}</p>}
                {post.mediaUrl && post.mediaType === 'image' && <img src={post.mediaUrl} alt="Community post upload" className="mt-4 max-h-[560px] w-full rounded-xl border border-[#2a405b] bg-black object-contain"/>}
                {post.mediaUrl && post.mediaType === 'video' && <video src={post.mediaUrl} controls playsInline preload="metadata" className="mt-4 max-h-[560px] w-full rounded-xl border border-[#2a405b] bg-black"/>}

                <div className="mt-4 flex flex-wrap items-center gap-2">{REACTIONS.map(emoji => <button key={emoji} onClick={() => toggleReaction(post, emoji)} className={`rounded-full border px-2.5 py-1 text-xs ${post.myReactions.includes(emoji) ? 'border-[#00f0ff] bg-[#00f0ff]/10 text-white' : 'border-[#30415c] bg-[#0b1425] text-[#b9cacb]'}`}><span className="mr-1">{emoji}</span>{post.reactions[emoji] || 0}</button>)}</div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#2a405b]/70 pt-3"><button type="button" onClick={() => openSocialProfile('post', post.id, post.author)} className="flex items-center gap-2 rounded-lg text-left text-xs text-[#849495] hover:text-white"><SocialAvatar displayName={postSocial?.display_name || post.author} avatarUrl={postSocial?.avatar_url} size="xs"/><span>by <span className="font-bold text-[#b9cacb]">{postSocial?.display_name || post.author}</span></span></button><div className="flex items-center gap-4"><button onClick={() => toggleLike(post)} className={`flex items-center gap-1.5 text-xs ${post.liked ? 'text-[#00f0ff]' : 'text-[#aebbc8]'}`}><span className="material-symbols-outlined text-[18px]">favorite</span>LIKE · {post.likes}</button><button onClick={() => setReplyingTo(current => ({ ...current, [post.id]: null }))} className="flex items-center gap-1.5 text-xs text-[#aebbc8]"><span className="material-symbols-outlined text-[18px]">reply</span>REPLY · {post.comments.length}</button></div></div>
              </div>

              <div className="border-t border-[#2a405b] bg-[#0c1526] p-4">
                {topLevel.length > 0 && <div className="mb-4 space-y-3">{topLevel.slice(-6).map(comment => {
                  const children = post.comments.filter(child => child.parentId === comment.id);
                  const commentSocial = socialProfiles[socialKey('comment', comment.id)];
                  return <div key={comment.id}>
                    <div className="rounded-lg bg-[#121e33] px-3 py-2 text-xs text-[#c7d0dd]"><div className="flex items-center justify-between gap-2"><button type="button" onClick={() => openSocialProfile('comment', comment.id, comment.author)} className="flex min-w-0 items-center gap-2 text-left"><SocialAvatar displayName={commentSocial?.display_name || comment.author} avatarUrl={commentSocial?.avatar_url} size="xs"/><span className="truncate"><span className="font-bold text-[#00f0ff]">{commentSocial?.display_name || comment.author}</span> <span className="text-[#6f8095]">· {relativeTime(comment.createdAt)}</span></span></button><div className="flex gap-3"><button onClick={() => setReplyingTo(current => ({ ...current, [post.id]: { commentId: comment.id, author: comment.author } }))} className="text-[#9fb0c4] hover:text-[#00f0ff]">REPLY</button><button onClick={() => setReportTarget({ type: 'comment', id: comment.id, label: `Reply by ${comment.author}` })} className="text-[#9fb0c4] hover:text-[#ffb4ab]">REPORT</button></div></div><p className="mt-1 leading-5">{comment.body}</p></div>
                    {children.map(child => { const childSocial = socialProfiles[socialKey('comment', child.id)]; return <div key={child.id} className="ml-5 mt-2 rounded-lg border-l-2 border-[#00f0ff]/25 bg-[#0f1a2d] px-3 py-2 text-xs text-[#c7d0dd]"><div className="flex items-center justify-between gap-2"><button type="button" onClick={() => openSocialProfile('comment', child.id, child.author)} className="flex min-w-0 items-center gap-2 text-left"><SocialAvatar displayName={childSocial?.display_name || child.author} avatarUrl={childSocial?.avatar_url} size="xs"/><span className="truncate"><span className="font-bold text-[#65f2b5]">{childSocial?.display_name || child.author}</span> <span className="text-[#6f8095]">· {relativeTime(child.createdAt)}</span></span></button><button onClick={() => setReportTarget({ type: 'comment', id: child.id, label: `Reply by ${child.author}` })} className="text-[#9fb0c4] hover:text-[#ffb4ab]">REPORT</button></div><p className="mt-1 leading-5">{child.body}</p></div>; })}
                  </div>;
                })}</div>}

                {replyingTo[post.id] && <div className="mb-2 flex items-center justify-between rounded-lg bg-[#00f0ff]/5 px-3 py-2 text-[11px] text-[#9fdbe1]"><span>Replying to @{replyingTo[post.id]?.author}</span><button onClick={() => setReplyingTo(current => ({ ...current, [post.id]: null }))}>×</button></div>}
                <div className="mb-2 flex gap-1">{['🔥','👏','⚾','😂','💙'].map(emoji => <button key={emoji} onClick={() => insertReplyEmoji(post.id, emoji)} className="rounded-md border border-[#253955] bg-[#101a2d] px-2 py-1 text-sm">{emoji}</button>)}</div>
                <div className="flex gap-2"><input value={commentDrafts[post.id] || ''} onChange={e => setCommentDrafts(current => ({ ...current, [post.id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') void addReply(post.id); }} maxLength={240} placeholder={signedIn ? (replyingTo[post.id] ? `Reply to ${replyingTo[post.id]?.author}…` : `Reply to ${post.author}…`) : 'Sign in to reply'} className="min-w-0 flex-1 h-9 rounded-lg border border-[#30415c] bg-[#0b1425] px-3 text-xs outline-none focus:border-[#00f0ff]"/><button onClick={() => void addReply(post.id)} className="h-9 rounded-lg border border-[#00f0ff]/35 px-3 text-xs text-[#00f0ff]">REPLY</button></div>
              </div>
            </article>;
          })}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20">
          <div className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-4"><p className="text-[10px] font-label-caps text-[#65f2b5]">COMMUNITY FEATURES</p><div className="mt-3 space-y-3 text-sm"><div><b className="text-[#dbfcff]">Follow Fans</b><p className="text-xs text-[#849495]">Tap a profile photo or name to follow people you meet here.</p></div><div><b className="text-[#dbfcff]">Photos + Videos</b><p className="text-xs text-[#849495]">Share game moments and baseball media.</p></div><div><b className="text-[#dbfcff]">Replies + Likes</b><p className="text-xs text-[#849495]">Reply to posts or comments and like useful takes.</p></div><div><b className="text-[#dbfcff]">Emoji Reactions</b><p className="text-xs text-[#849495]">React quickly with baseball-friendly emojis.</p></div></div></div>
          <div className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-4"><p className="text-[10px] font-label-caps text-[#00f0ff]">HOUSE RULES + SAFETY</p><p className="mt-2 text-xs leading-5 text-[#aebbc8]">Keep it baseball-focused. Harassment, hateful abuse, explicit material, violent content, spam, and private information are not allowed. Use REPORT when something slips through.</p></div>
        </aside>
      </section>
    </div>

    <SocialProfileCard target={selectedSocial} signedIn={signedIn} onOpenAuth={onOpenAuth} onClose={() => setSelectedSocial(null)} />

    {reportTarget && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={() => setReportTarget(null)}><div className="w-full max-w-md rounded-2xl border border-[#344761] bg-[#101a2d] p-5 shadow-2xl" onClick={e => e.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-label-caps text-[#ffb4ab]">REPORT CONTENT</p><h3 className="mt-1 text-lg font-bold">Help keep ScoutCore safe</h3><p className="mt-1 text-xs text-[#849495] line-clamp-2">{reportTarget.label}</p></div><button onClick={() => setReportTarget(null)} className="text-xl text-[#849495]">×</button></div><label className="mt-4 block text-xs text-[#aebbc8]">Reason<select value={reportReason} onChange={e => setReportReason(e.target.value as any)} className="mt-2 h-10 w-full rounded-lg border border-[#30415c] bg-[#0b1425] px-3 text-sm text-white">{REPORT_REASONS.map(reason => <option key={reason.value} value={reason.value}>{reason.label}</option>)}</select></label><label className="mt-3 block text-xs text-[#aebbc8]">Extra details (optional)<textarea value={reportDetails} onChange={e => setReportDetails(e.target.value)} maxLength={300} className="mt-2 min-h-20 w-full rounded-lg border border-[#30415c] bg-[#0b1425] p-3 text-sm text-white"/></label><div className="mt-4 flex justify-end gap-2"><button onClick={() => setReportTarget(null)} className="rounded-lg border border-[#30415c] px-4 py-2 text-xs text-[#b9cacb]">CANCEL</button><button onClick={() => void submitReport()} disabled={reporting} className="rounded-lg bg-[#ffb4ab] px-4 py-2 text-xs font-bold text-[#3a0710] disabled:opacity-50">{reporting ? 'CHECKING…' : 'SUBMIT REPORT'}</button></div></div></div>}
  </div>;
};
