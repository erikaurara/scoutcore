import React, { useEffect, useMemo, useState } from 'react';
import { getSchedule, type MlbScheduleGame } from '../services/mlbApi';
import { mlbTeamLogoUrl } from '../services/mlbMedia';
import {
  getOfficialHighlightsForGames,
  officialHighlightLookupConfigured,
  officialMlbYoutubeSearchUrl,
  type OfficialHighlightVideo,
  youtubePrivacyEmbedUrl,
} from '../services/youtubeHighlights';

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

export const HighlightsView: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [games, setGames] = useState<MlbScheduleGame[]>([]);
  const [videos, setVideos] = useState<Map<number, OfficialHighlightVideo>>(new Map());
  const [selectedGamePk, setSelectedGamePk] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [videoLoading, setVideoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setVideoLoading(false);
      setError(null);
      setSelectedGamePk(null);
      try {
        const schedule = await getSchedule(selectedDate);
        if (cancelled) return;
        setGames(schedule);
        setVideos(new Map());

        if (officialHighlightLookupConfigured()) {
          setVideoLoading(true);
          try {
            const found = await getOfficialHighlightsForGames(schedule, selectedDate);
            if (!cancelled) {
              setVideos(found);
              const first = schedule.find((game) => found.has(game.gamePk));
              if (first) setSelectedGamePk(first.gamePk);
            }
          } catch {
            if (!cancelled) setVideos(new Map());
          } finally {
            if (!cancelled) setVideoLoading(false);
          }
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
  const selectedVideo = selectedGamePk ? videos.get(selectedGamePk) ?? null : null;
  const selectedGame = selectedGamePk ? games.find((game) => game.gamePk === selectedGamePk) ?? null : null;

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
              <h1 className="mt-2 text-2xl font-extrabold text-white sm:text-3xl">Official MLB game highlights</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#9aa8bc]">
                Real video only. ScoutCore does not download, copy, edit, or re-host MLB footage. Inline playback is limited to official MLB YouTube uploads that YouTube reports as embeddable and playable outside YouTube.
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

        {selectedVideo && selectedGame && (
          <section className="mt-4 overflow-hidden rounded-2xl border border-[#00e6f4]/30 bg-[#07101f] shadow-[0_0_45px_rgba(0,230,244,.08)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#24354d] px-4 py-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#65f2b5]">Official {selectedVideo.kind === 'condensed' ? 'Condensed Game' : 'Game Recap'}</p>
                <p className="mt-1 text-sm font-bold text-white">{selectedGame.awayTeam.name} @ {selectedGame.homeTeam.name}</p>
              </div>
              <span className="rounded-full border border-[#30415c] bg-[#10192b] px-3 py-1 text-[9px] font-bold text-[#aab7c9]">YOUTUBE PRIVACY-ENHANCED EMBED</span>
            </div>
            <div className="aspect-video w-full bg-black">
              <iframe
                className="h-full w-full"
                src={youtubePrivacyEmbedUrl(selectedVideo.videoId)}
                title={selectedVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
            <div className="border-t border-[#24354d] px-4 py-3">
              <p className="text-sm font-semibold text-[#dbe7f5]">{selectedVideo.title}</p>
              <p className="mt-1 text-[10px] text-[#718096]">Playback stays inside YouTube's player. ScoutCore does not store the video file.</p>
            </div>
          </section>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-white">Games</h2>
            <p className="mt-1 text-xs text-[#8fa0b7]">{finishedGames.length} finished game{finishedGames.length === 1 ? '' : 's'} for this date</p>
          </div>
          {videoLoading && <div className="flex items-center gap-2 text-[10px] font-bold text-[#00e6f4]"><span className="h-2 w-2 animate-pulse rounded-full bg-[#00e6f4]"/>CHECKING OFFICIAL MLB VIDEOS</div>}
        </div>

        {loading ? (
          <div className="mt-4 rounded-2xl border border-[#2b405b] bg-[#0d1727] p-10 text-center text-sm text-[#9aa8bc]">Loading MLB games…</div>
        ) : finishedGames.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-[#40516b] bg-[#0d1727] p-10 text-center">
            <span className="material-symbols-outlined text-4xl text-[#526275]">movie_off</span>
            <p className="mt-3 font-bold text-white">No finished games yet</p>
            <p className="mt-1 text-sm text-[#8fa0b7]">Highlights appear after games finish and an official video is available.</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {finishedGames.map((game) => {
              const video = videos.get(game.gamePk);
              return (
                <article key={game.gamePk} className={`overflow-hidden rounded-2xl border bg-[#0d1727] transition ${selectedGamePk === game.gamePk ? 'border-[#00e6f4]/65 shadow-[0_0_28px_rgba(0,230,244,.08)]' : 'border-[#2b405b] hover:border-[#46607f]'}`}>
                  <div className="relative aspect-video bg-[#07101f]">
                    {video?.thumbnail ? <img src={video.thumbnail} alt="" className="h-full w-full object-cover" /> : <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#0c1a2b] to-[#07101f]"><span className="material-symbols-outlined text-5xl text-[#31445d]">smart_display</span></div>}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#07101f]/90 via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-white/95 p-1"><img src={mlbTeamLogoUrl(game.awayTeam.id)} alt="" className="h-8 w-8 object-contain" /></div>
                        <span className="font-mono text-lg font-extrabold text-white">{score(game, 'away')}</span>
                        <span className="text-[#64748b]">—</span>
                        <span className="font-mono text-lg font-extrabold text-white">{score(game, 'home')}</span>
                        <div className="rounded-lg bg-white/95 p-1"><img src={mlbTeamLogoUrl(game.homeTeam.id)} alt="" className="h-8 w-8 object-contain" /></div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-extrabold text-white">{game.awayTeam.name} @ {game.homeTeam.name}</p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#65f2b5]">FINAL</p>
                      </div>
                      {video && <span className="shrink-0 rounded-full border border-[#00e6f4]/30 bg-[#00e6f4]/10 px-2.5 py-1 text-[9px] font-bold text-[#00e6f4]">{video.kind === 'condensed' ? 'CONDENSED' : 'RECAP'}</span>}
                    </div>

                    {video ? (
                      <button type="button" onClick={() => { setSelectedGamePk(game.gamePk); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#00e6f4] px-4 py-3 text-xs font-extrabold text-[#062029] hover:bg-[#48f3ff]">
                        <span className="material-symbols-outlined text-[18px]">play_circle</span>
                        WATCH OFFICIAL VIDEO
                      </button>
                    ) : (
                      <a href={officialMlbYoutubeSearchUrl(game)} target="_blank" rel="noreferrer" className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#30415c] bg-[#10192b] px-4 py-3 text-xs font-extrabold text-[#b9c6d8] hover:border-[#00e6f4]/45 hover:text-white">
                        <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                        FIND ON OFFICIAL MLB YOUTUBE
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {!officialHighlightLookupConfigured() && (
          <section className="mt-5 rounded-2xl border border-[#ffd166]/25 bg-[#ffd166]/[.06] p-4 sm:p-5">
            <div className="flex gap-3">
              <span className="material-symbols-outlined text-[#ffd166]">verified_user</span>
              <div>
                <p className="text-sm font-extrabold text-white">Safe mode is active</p>
                <p className="mt-1 text-xs leading-5 text-[#b9c5d8]">Automatic inline video lookup stays off until a YouTube Data API key is configured and restricted to the ScoutCore site. Until then, each game only links to the official MLB YouTube channel search instead of embedding unverified uploads.</p>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
