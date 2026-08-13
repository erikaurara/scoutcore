import type { MlbScheduleGame } from './mlbApi';

export type MlbHighlightVideo = {
  id: string;
  title: string;
  description?: string;
  thumbnail: string;
  playbackUrl: string;
  duration?: string;
  kind: 'recap' | 'condensed' | 'highlight';
  source: 'mlb';
};

const MLB_API = 'https://statsapi.mlb.com/api/v1';

const requestJson = async (url: string, label: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${label} request failed: ${response.status}`);
  return response.json();
};

const text = (value: unknown) => String(value ?? '').trim();

const classify = (title: string): MlbHighlightVideo['kind'] => {
  const value = title.toLowerCase();
  if (value.includes('condensed')) return 'condensed';
  if (value.includes('recap') || value.includes('game highlights') || value.includes('game highlight')) return 'recap';
  return 'highlight';
};

const playbackUrl = (item: any) => {
  const playbacks = Array.isArray(item?.playbacks) ? item.playbacks : [];
  const preferredNames = ['mp4Avc', 'highBit', 'highBitAvc', 'mediumBit', 'lowBit'];
  for (const name of preferredNames) {
    const match = playbacks.find((row: any) => String(row?.name ?? '').toLowerCase() === name.toLowerCase());
    if (match?.url) return String(match.url);
  }
  const mp4 = playbacks.find((row: any) => /\.mp4(?:\?|$)/i.test(String(row?.url ?? '')));
  return mp4?.url ? String(mp4.url) : '';
};

const thumbnailUrl = (item: any) => {
  const cuts = item?.image?.cuts ?? {};
  const preferred = ['1280x720', '1136x640', '960x540', '768x432', '640x360', '480x270'];
  for (const key of preferred) {
    if (cuts?.[key]?.src) return String(cuts[key].src);
  }
  const first = Object.values(cuts).find((cut: any) => cut?.src) as any;
  return first?.src ? String(first.src) : text(item?.image?.templateUrl);
};

const normalizeItem = (item: any): MlbHighlightVideo | null => {
  const url = playbackUrl(item);
  if (!url) return null;
  const title = text(item?.title) || text(item?.headline) || 'MLB Highlight';
  return {
    id: text(item?.guid) || text(item?.id) || text(item?.mediaPlaybackId) || url,
    title,
    description: text(item?.description) || undefined,
    thumbnail: thumbnailUrl(item),
    playbackUrl: url,
    duration: text(item?.duration) || undefined,
    kind: classify(title),
    source: 'mlb',
  };
};

const collectItems = (data: any) => {
  const groups = [
    data?.highlights?.highlights?.items,
    data?.highlights?.live?.items,
    data?.highlights?.scorecard?.items,
  ];

  const items = groups.flatMap((group) => Array.isArray(group) ? group : []);
  const seen = new Set<string>();
  const videos: MlbHighlightVideo[] = [];

  for (const item of items) {
    const video = normalizeItem(item);
    if (!video || seen.has(video.id)) continue;
    seen.add(video.id);
    videos.push(video);
  }

  return videos.sort((a, b) => {
    const weight = (video: MlbHighlightVideo) => video.kind === 'condensed' ? 0 : video.kind === 'recap' ? 1 : 2;
    return weight(a) - weight(b);
  });
};

export async function getOfficialMlbVideosForGame(gamePk: number): Promise<MlbHighlightVideo[]> {
  const data = await requestJson(`${MLB_API}/game/${gamePk}/content`, 'MLB game content');
  return collectItems(data);
}

export async function getOfficialMlbVideosForGames(games: MlbScheduleGame[]) {
  const finished = games.filter((game) => game.status === 'Final' || /final|game over/i.test(game.detailedState));
  const result = new Map<number, MlbHighlightVideo[]>();
  const queue = [...finished];
  const workerCount = Math.min(4, queue.length);

  const worker = async () => {
    while (queue.length) {
      const game = queue.shift();
      if (!game) return;
      try {
        const videos = await getOfficialMlbVideosForGame(game.gamePk);
        if (videos.length) result.set(game.gamePk, videos);
      } catch {
        // A finished game can exist before MLB publishes video content.
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return result;
}
