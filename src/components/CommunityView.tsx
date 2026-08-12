import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabaseClient';

type CommunityPost = {
  id: string;
  userId: string;
  author: string;
  title: string;
  body: string;
  category: 'Game Thread' | 'Analysis' | 'Hot Take';
  tag: string;
  createdAt: string;
  likes: number;
  liked: boolean;
  comments: { id: string; author: string; body: string; createdAt: string }[];
};

interface CommunityViewProps {
  signedIn: boolean;
  userEmail?: string | null;
  onOpenAuth: () => void;
}

const relativeTime = (value: string) => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export const CommunityView: React.FC<CommunityViewProps> = ({ signedIn, userEmail, onOpenAuth }) => {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [filter, setFilter] = useState<'All' | CommunityPost['category']>('All');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<CommunityPost['category']>('Game Thread');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPosts = async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData.user?.id ?? null;

      const [{ data: postRows, error: postError }, { data: commentRows, error: commentError }, { data: likeRows, error: likeError }] = await Promise.all([
        supabase.from('community_posts').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('community_comments').select('*').order('created_at', { ascending: true }).limit(500),
        supabase.from('community_likes').select('*').limit(2000),
      ]);
      if (postError) throw postError;
      if (commentError) throw commentError;
      if (likeError) throw likeError;

      const mapped: CommunityPost[] = (postRows ?? []).map((row: any) => {
        const likes = (likeRows ?? []).filter((like: any) => like.post_id === row.id);
        const comments = (commentRows ?? [])
          .filter((comment: any) => comment.post_id === row.id)
          .map((comment: any) => ({ id: comment.id, author: comment.author_name, body: comment.body, createdAt: comment.created_at }));
        return {
          id: row.id,
          userId: row.user_id,
          author: row.author_name,
          title: row.title,
          body: row.body,
          category: row.category,
          tag: row.tag,
          createdAt: row.created_at,
          likes: likes.length,
          liked: Boolean(currentUserId && likes.some((like: any) => like.user_id === currentUserId)),
          comments,
        };
      });
      setPosts(mapped);
    } catch (err: any) {
      setError(err?.message || 'Unable to load Community right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPosts(); }, [signedIn]);

  const visiblePosts = useMemo(() => filter === 'All' ? posts : posts.filter(post => post.category === filter), [posts, filter]);

  const publish = async () => {
    if (!signedIn) { onOpenAuth(); return; }
    if (!supabase || !title.trim() || !body.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) { onOpenAuth(); return; }
    const author = String(user.user_metadata?.display_name || userEmail?.split('@')[0] || 'ScoutCore fan').slice(0, 28);
    const { error: insertError } = await supabase.from('community_posts').insert({
      user_id: user.id,
      author_name: author,
      title: title.trim().slice(0, 90),
      body: body.trim().slice(0, 700),
      category,
      tag: 'MLB',
    });
    if (insertError) { setError(insertError.message); return; }
    setTitle(''); setBody('');
    await loadPosts();
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
    if (result.error) { setError(result.error.message); return; }
    await loadPosts();
  };

  const addComment = async (postId: string) => {
    if (!signedIn) { onOpenAuth(); return; }
    if (!supabase) return;
    const text = (commentDrafts[postId] || '').trim();
    if (!text) return;
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) { onOpenAuth(); return; }
    const author = String(user.user_metadata?.display_name || userEmail?.split('@')[0] || 'ScoutCore fan').slice(0, 28);
    const { error: insertError } = await supabase.from('community_comments').insert({
      post_id: postId,
      user_id: user.id,
      author_name: author,
      body: text.slice(0, 240),
    });
    if (insertError) { setError(insertError.message); return; }
    setCommentDrafts(current => ({ ...current, [postId]: '' }));
    await loadPosts();
  };

  return <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] px-3 py-5 sm:px-6 lg:px-8">
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-[10px] font-label-caps text-[#65f2b5] mb-2">SCOUTCOREMLB COMMUNITY</div>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#dbfcff]">Community</h1>
          <p className="text-sm text-[#aebbc8] mt-2 max-w-2xl">Talk baseball, react to live games, share matchup reads, and post your own analysis.</p>
        </div>
        <div className="rounded-xl border border-[#65f2b5]/20 bg-[#65f2b5]/5 px-4 py-3 text-xs text-[#b9cacb]"><span className="text-[#65f2b5] font-bold">LIVE COMMUNITY</span> · Posts, comments and likes are shared across ScoutCoreMLB.</div>
      </header>

      {error && <div className="rounded-xl border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 p-3 text-sm text-[#ffb4ab]">{error}</div>}

      <section className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-4"><div><p className="text-[10px] font-label-caps text-[#00f0ff]">CREATE A POST</p><h2 className="font-bold text-lg">Share with the community</h2></div>{!signedIn && <button onClick={onOpenAuth} className="rounded-lg border border-[#00f0ff]/35 px-3 py-2 text-xs text-[#00f0ff] hover:bg-[#00f0ff]/10">SIGN IN TO POST</button>}</div>
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_180px] gap-3"><input value={title} onChange={e => setTitle(e.target.value)} maxLength={90} placeholder="Post title — e.g. Dodgers bullpen matchup tonight" className="h-11 rounded-lg border border-[#30415c] bg-[#0b1425] px-3 text-sm outline-none focus:border-[#00f0ff]"/><select value={category} onChange={e => setCategory(e.target.value as CommunityPost['category'])} className="h-11 rounded-lg border border-[#30415c] bg-[#0b1425] px-3 text-sm outline-none"><option>Game Thread</option><option>Analysis</option><option>Hot Take</option></select></div>
        <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={700} placeholder="What are you seeing? Keep it baseball-focused and respectful." className="mt-3 min-h-28 w-full resize-y rounded-lg border border-[#30415c] bg-[#0b1425] p-3 text-sm outline-none focus:border-[#00f0ff]"/>
        <div className="mt-3 flex items-center justify-between gap-3"><span className="text-[11px] text-[#849495]">{body.length}/700</span><button onClick={publish} disabled={!title.trim() || !body.trim()} className="rounded-lg bg-[#00e6f4] px-5 py-2.5 text-xs font-bold text-[#002c31] disabled:opacity-40">POST TO COMMUNITY</button></div>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1">{(['All','Game Thread','Analysis','Hot Take'] as const).map(item => <button key={item} onClick={() => setFilter(item)} className={`whitespace-nowrap rounded-full px-4 py-2 text-xs border ${filter === item ? 'bg-[#00e6f4] border-[#00e6f4] text-[#002c31] font-bold' : 'border-[#30415c] text-[#b9cacb] bg-[#101a2d]'}`}>{item === 'All' ? 'LATEST' : item.toUpperCase()}</button>)}</div>

      <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-5 items-start">
        <div className="space-y-4">
          {loading && <div className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-8 text-center text-sm text-[#849495]">Loading Community…</div>}
          {!loading && visiblePosts.length === 0 && <div className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-8 text-center"><div className="mx-auto w-12 h-12 rounded-full bg-[#00f0ff]/10 flex items-center justify-center text-[#00f0ff] mb-3"><span className="material-symbols-outlined">forum</span></div><h3 className="font-bold">No posts yet</h3><p className="text-sm text-[#849495] mt-1">Be the first to start a game thread or share an analysis.</p></div>}
          {visiblePosts.map(post => <article key={post.id} className="rounded-2xl border border-[#2a405b] bg-[#101a2d] overflow-hidden"><div className="p-4 sm:p-5"><div className="flex flex-wrap items-center gap-2 text-[11px]"><span className="rounded-full bg-[#00f0ff]/10 px-2.5 py-1 font-bold text-[#00f0ff]">{post.category.toUpperCase()}</span><span className="text-[#849495]">{relativeTime(post.createdAt)}</span></div><h2 className="mt-3 text-xl font-bold text-[#dbfcff]">{post.title}</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#c7d0dd]">{post.body}</p><div className="mt-4 flex items-center justify-between border-t border-[#2a405b]/70 pt-3"><span className="text-xs text-[#849495]">by <span className="text-[#b9cacb]">{post.author}</span></span><div className="flex items-center gap-4"><button onClick={() => toggleLike(post)} className={`flex items-center gap-1.5 text-xs ${post.liked ? 'text-[#00f0ff]' : 'text-[#aebbc8]'}`}><span className="material-symbols-outlined text-[18px]">favorite</span>{post.likes}</button><span className="flex items-center gap-1.5 text-xs text-[#aebbc8]"><span className="material-symbols-outlined text-[18px]">chat_bubble</span>{post.comments.length}</span></div></div></div><div className="border-t border-[#2a405b] bg-[#0c1526] p-4">{post.comments.length > 0 && <div className="mb-3 space-y-2">{post.comments.slice(-4).map(comment => <div key={comment.id} className="rounded-lg bg-[#121e33] px-3 py-2 text-xs text-[#c7d0dd]"><span className="font-bold text-[#00f0ff]">{comment.author}</span> · {comment.body}</div>)}</div>}<div className="flex gap-2"><input value={commentDrafts[post.id] || ''} onChange={e => setCommentDrafts(current => ({ ...current, [post.id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') addComment(post.id); }} maxLength={240} placeholder={signedIn ? 'Add a comment…' : 'Sign in to comment'} className="min-w-0 flex-1 h-9 rounded-lg border border-[#30415c] bg-[#0b1425] px-3 text-xs outline-none focus:border-[#00f0ff]"/><button onClick={() => addComment(post.id)} className="h-9 rounded-lg border border-[#00f0ff]/35 px-3 text-xs text-[#00f0ff]">SEND</button></div></div></article>)}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20"><div className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-4"><p className="text-[10px] font-label-caps text-[#65f2b5]">COMMUNITY IDEAS</p><div className="mt-3 space-y-3 text-sm"><div><b className="text-[#dbfcff]">Game Threads</b><p className="text-xs text-[#849495]">React while a game is happening.</p></div><div><b className="text-[#dbfcff]">Analysis</b><p className="text-xs text-[#849495]">Share a matchup, pitcher, hitter, or bullpen read.</p></div><div><b className="text-[#dbfcff]">Hot Takes</b><p className="text-xs text-[#849495]">Short baseball opinions and predictions.</p></div></div></div><div className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-4"><p className="text-[10px] font-label-caps text-[#00f0ff]">HOUSE RULES</p><p className="mt-2 text-xs leading-5 text-[#aebbc8]">Keep posts baseball-focused. No harassment, spam, private information, or pretending guesses are verified stats.</p></div></aside>
      </section>
    </div>
  </div>;
};
