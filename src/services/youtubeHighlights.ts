import type { MlbScheduleGame } from './mlbApi';

export type OfficialHighlightVideo = {
  videoId: string;
  title: string;
  thumbnail: string;
  publishedAt?: string;
  kind: 'condensed' | 'recap';
};

const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';
const API_KEY = String(import.meta.env.VITE_YOUTUBE_API_KEY ?? '').trim();
const MLB_HANDLE = '@MLB';

const requestJson = async (url: string, label: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${label} request failed: ${response.status}`);
  return response.json();
};

const teamTokens = (game: MlbScheduleGame) => {
  const token = (team: { name: string; abbreviation?: string }) => {
    const parts = String(team.name ?? '').toLowerCase().split(/\s+/).filter(Boolean);
    const nickname = parts.slice(-2).join(' ');
    const last = parts[parts.length - 1] ?? '';
    return [team.name.toLowerCase(), nickname, last, String(team.abbreviation ?? '').toLowerCase()].filter(Boolean);
  };
  return { away: token(game.awayTeam), home: token(game.homeTeam) };
};

const titleMatchesGame = (title: string, game: MlbScheduleGame) => {
  const haystack = title.toLowerCase();
  const { away, home } = teamTokens(game);
  const hasAway = away.some((value) => value.length >= 2 && haystack.includes(value));
  const hasHome = home.some((value) => value.length >= 2 && haystack.includes(value));
  return hasAway && hasHome;
};

const dateWindow = (date: Date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setHours(start.getHours() - 12);
  const end = new Date(start);
  end.setHours(end.getHours() + 60);
  return { publishedAfter: start.toISOString(), publishedBefore: end.toISOString() };
};

let channelIdPromise: Promise<string | null> | null = null;

const resolveOfficialMlbChannelId = async () => {
  if (!API_KEY) return null;
  if (!channelIdPromise) {
    channelIdPromise = (async () => {
      const params = new URLSearchParams({
        part: 'id,snippet',
        forHandle: MLB_HANDLE,
        key: API_KEY,
      });
      const data = await requestJson(`${YOUTUBE_API}/channels?${params.toString()}`, 'YouTube channel');
      const channel = data?.items?.[0];
      return channel?.id ? String(channel.id) : null;
    })().catch(() => null);
  }
  return channelIdPromise;
};

const searchOfficialUploads = async (
  channelId: string,
  query: 'Condensed Game' | 'Game Recap',
  date: Date,
): Promise<OfficialHighlightVideo[]> => {
  const { publishedAfter, publishedBefore } = dateWindow(date);
  const params = new URLSearchParams({
    part: 'snippet',
    channelId,
    q: query,
    type: 'video',
    maxResults: '50',
    order: 'date',
    videoEmbeddable: 'true',
    videoSyndicated: 'true',
    safeSearch: 'strict',
    publishedAfter,
    publishedBefore,
    key: API_KEY,
  });

  const data = await requestJson(`${YOUTUBE_API}/search?${params.toString()}`, 'YouTube highlights');
  return (data?.items ?? [])
    .map((item: any): OfficialHighlightVideo | null => {
      const videoId = item?.id?.videoId;
      if (!videoId) return null;
      return {
        videoId: String(videoId),
        title: String(item?.snippet?.title ?? query),
        thumbnail: String(item?.snippet?.thumbnails?.high?.url ?? item?.snippet?.thumbnails?.medium?.url ?? ''),
        publishedAt: item?.snippet?.publishedAt,
        kind: query === 'Condensed Game' ? 'condensed' : 'recap',
      };
    })
    .filter(Boolean) as OfficialHighlightVideo[];
};

export const officialHighlightLookupConfigured = () => Boolean(API_KEY);

export async function getOfficialHighlightsForGames(games: MlbScheduleGame[], date: Date) {
  const channelId = await resolveOfficialMlbChannelId();
  if (!channelId) return new Map<number, OfficialHighlightVideo>();

  const [condensed, recaps] = await Promise.all([
    searchOfficialUploads(channelId, 'Condensed Game', date),
    searchOfficialUploads(channelId, 'Game Recap', date),
  ]);

  const catalog = [...condensed, ...recaps];
  const result = new Map<number, OfficialHighlightVideo>();

  games.forEach((game) => {
    const match = catalog.find((video) => titleMatchesGame(video.title, game));
    if (match) result.set(game.gamePk, match);
  });

  return result;
}

export const youtubePrivacyEmbedUrl = (videoId: string) =>
  `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0&modestbranding=1`;

export const officialMlbYoutubeSearchUrl = (game: MlbScheduleGame) => {
  const query = `${game.awayTeam.name} ${game.homeTeam.name} Condensed Game`;
  return `https://www.youtube.com/@MLB/search?query=${encodeURIComponent(query)}`;
};
