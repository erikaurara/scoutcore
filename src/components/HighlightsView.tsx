import React, { useEffect, useMemo, useState } from 'react';
import { getSchedule, type MlbScheduleGame } from '../services/mlbApi';
import { mlbTeamLogoUrl } from '../services/mlbMedia';
import { getOfficialMlbVideosForGames, type MlbHighlightVideo } from '../services/mlbHighlights';
import { officialMlbYoutubeSearchUrl } from '../services/youtubeHighlights';

const DAY_MS = 24 * 60 * 60 * 1000;

const formatDate = (date: Date) => new Intl.DateTimeFormat('en-US', {
  weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
}).format(date);

const score = (game: MlbScheduleGame, side: 'away' | 'home') => {
  const value = side === 'away' ? game.awayScore : game.homeScore;
  return value === 0 || value ? value : '—';
};

const isFinished = (game: MlbScheduleGame) =>
  game.status === 'Final' || /final|game over/i.test(game.detailedState);

const videoLabel = (video: MlbHighlightVideo) => {
  if (video.kind === 'condensed') return 'CONDENSED';
  if (video.kind === 'recap') return 'RECAP';
  return 'HIGHLIGHT';
};

const featuredVideos = (videos: MlbHighlightVideo[]) => {
  const result: MlbHighlightVideo[] = [];
  const condensed = videos.find((video) => video.kind === 'condensed');
  const recap = videos.find((video) => video.kind === 'recap');
  const highlight = videos.find((video) => video.kind === 'highlight');
  [condensed, recap, highlight].forEach((video) => {
    if (video && !result.some((item) => item.id === video.id)) result.push(video);
  });
  return result.length ? result : videos.slice(0, 3);
};

export const HighlightsView: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [games, setGames] = useState<MlbScheduleGame[]>([]);
  const [videos, setVideos] = useState<Map<number, MlbHighlightVideo[]>>(new Map());
  const [selectedVideos, setSelectedVideos] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [videoLoading, setVideoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setVideoLoading(false);
      setError(null);
      setSelectedVideos({});
      try {
        const schedule = await getSchedule(selectedDate);
        if (cancelled) return;
        setGames(schedule);
        setVideos(new Map());
        setVideoLoading(true);
        try {
          const found = await getOfficialMlbVideosForGames(schedule);
          if (!cancelled) {
            setVideos(found);
            const defaults: Record<number, string> = {};
            found.forEach((gameVideos, gamePk) => {
              const first = featuredVideos(gameVideos)[0];
              if (first) defaults[gamePk] = first.id;
            });
            setSelectedVideos(defaults);
          }
        } finally {
          if (!cancelled) setVideoLoading(false);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load MLB games.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()]);

  const finishedGames = useMemo(() => games.filter(isFinished), [games]);
  const moveDate = (days: number) => setSelectedDate((current) => new Date(current.getTime() + days * DAY_MS));
  const goToday = () => setSelectedDate(new Date());

  return (
    <div className="min-h-screen bg-[#08111f] px-3 py-5 text-[#dae2fd] sm:px-5 lg:px-7">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-2xl border border-[#2b405b] bg-[#0d1727] p-4 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[24px] text-[#00e6f4]">movie</span>
                <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#00e6f4]">ScoutCore Highlights</p>
              </div>
              <h1 className="mt-2 text-2xl font-extrabold text-white sm:text-3xl">Official MLB game videos</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#9aa8bc]">
                Watch MLB-hosted recaps, condensed games, and highlights directly inside ScoutCore. Video files stay on MLB's servers and are never copied or re-hosted by ScoutCore.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-[#2b405b] bg-[#08111f] p-2">
              <button type="button" onClick={() => moveDate(-1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#30415c] text-[#aab7c9] hover:border-[#00e6f4]/50 hover:text-white" aria-label="Previous day"><span className="material-symbols-outlined text-[19px]">chevron_left</span></button>
              <button type="button" onClick={goToday} className="min-w-[150px] rounded-lg px-3 py-2 text-center text-xs font-bold text-[#dbe7f5] hover:bg-[#132039]">{formatDate(selectedDate)}</button>
              <button type="button" onClick={() => moveDate(1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#30415c] text-[#aab7c9] hover:border-[#00e6f4]/50 hover:text-white" aria-label="Next day"><span className="material-symbols-outlined text-[19px]">chevron_right</span></button>
            </div>
          </div>
        </section>

        {error && <div className="mt-4 rounded-xl border border-[#ff8d8d]/30 bg-[#ff8d8d]/10 p-4 text-sm text-[#ffb4ab]">{error}</div>}

        <div className="mt-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-white">Games</h2>
            <p className="mt-1 text-xs text-[#8fa0b7]">{finishedGames.length} finished game{finishedGames.length === 1 ? '' : 's'} for this date</p>
          </div>
          {videoLoading && <div className="flex items-center gap-2 text-[10px] font-bold text-[#00e6f4]"><span className="h-2 w-2 animate-pulse rounded-full bg-[#00e6f4]"/>LOADING OFFICIAL MLB VIDEO</div>}
        </div>

        {loading ? (
          <div className="mt-4 rounded-2xl border border-[#2b405b] bg-[#0d1727] p-10 text-center text-sm text-[#9aa8bc]">Loading MLB games…</div>
        ) : finishedGames.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-[#40516b] bg-[#0d1727] p-10 text-center">
            <span className="material-symbols-outlined text-4xl text-[#526275]">movie_off</span>
            <p className="mt-3 font-bold text-white">No finished games yet</p>
            <p className="mt-1 text-sm text-[#8fa0b7]">Videos appear after games finish and MLB publishes them.</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {finishedGames.map((game) => {
              const available = featuredVideos(videos.get(game.gamePk) ?? []);
              const selectedId = selectedVideos[game.gamePk];
              const activeVideo = available.find((video) => video.id === selectedId) ?? available[0] ?? null;

              return (
                <article key={game.gamePk} className="overflow-hidden rounded-2xl border border-[#2b405b] bg-[#0d1727] transition hover:border-[#46607f]">
                  <div className="relative aspect-video bg-[#050a12]">
                    {activeVideo ? (
                      <video
                        key={activeVideo.id}
                        className="h-full w-full bg-black object-contain"
                        controls
                        playsInline
                        preload="none"
                        poster={activeVideo.thumbnail || undefined}
                        src={activeVideo.playbackUrl}
                      >
                        Your browser does not support embedded MLB video playback.
                      </video>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#0c1a2b] to-[#07101f] px-6 text-center">
                        <span className="material-symbols-outlined text-5xl text-[#31445d]">smart_display</span>
                        <p className="mt-2 text-xs font-bold text-[#a8b5c7]">MLB video has not been published yet</p>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-[#1f3046] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="rounded-lg bg-white/95 p-1"><img src={mlbTeamLogoUrl(game.awayTeam.id)} alt="" className="h-7 w-7 object-contain" /></div>
                        <span className="font-mono text-lg font-extrabold text-white">{score(game, 'away')}</span>
                        <span className="text-[#64748b]">—</span>
                        <span className="font-mono text-lg font-extrabold text-white">{score(game, 'home')}</span>
                        <div className="rounded-lg bg-white/95 p-1"><img src={mlbTeamLogoUrl(game.homeTeam.id)} alt="" className="h-7 w-7 object-contain" /></div>
                      </div>
                      <span className="shrink-0 rounded-full border border-[#65f2b5]/30 bg-[#65f2b5]/10 px-2.5 py-1 text-[9px] font-bold text-[#65f2b5]">FINAL</span>
                    </div>

                    <p className="mt-3 truncate text-sm font-extrabold text-white">{game.awayTeam.name} @ {game.homeTeam.name}</p>
                    {activeVideo && <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-[#8fa0b7]">{activeVideo.title}</p>}

                    {available.length > 1 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {available.map((video) => {
                          const active = activeVideo?.id === video.id;
                          return (
                            <button
                              key={video.id}
                              type="button"
                              onClick={() => setSelectedVideos((current) => ({ ...current, [game.gamePk]: video.id }))}
                              className={`rounded-lg border px-2.5 py-1.5 text-[9px] font-extrabold tracking-wide transition ${active ? 'border-[#00e6f4] bg-[#00e6f4]/12 text-[#66f3ff]' : 'border-[#30415c] bg-[#10192b] text-[#9eacbf] hover:border-[#00e6f4]/45 hover:text-white'}`}
                            >
                              {videoLabel(video)}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {!activeVideo && (
                      <a href={officialMlbYoutubeSearchUrl(game)} target="_blank" rel="noreferrer" className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#30415c] bg-[#10192b] px-4 py-3 text-xs font-extrabold text-[#b9c6d8] hover:border-[#00e6f4]/45 hover:text-white">
                        <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                        CHECK OFFICIAL MLB YOUTUBE
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <section className="mt-5 rounded-2xl border border-[#65f2b5]/20 bg-[#65f2b5]/[.05] p-4 sm:p-5">
          <div className="flex gap-3">
            <span className="material-symbols-outlined text-[#65f2b5]">verified_user</span>
            <div>
              <p className="text-sm font-extrabold text-white">Official MLB video source</p>
              <p className="mt-1 text-xs leading-5 text-[#b9c5d8]">ScoutCore requests the completed game's official MLB content feed and plays the MLB-hosted video URL in your browser. If MLB has not published a playable video for a game yet, ScoutCore shows the official MLB YouTube fallback instead.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
