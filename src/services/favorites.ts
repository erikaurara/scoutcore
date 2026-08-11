export type FavoriteKind = 'team' | 'player';

export type FavoriteItem = {
  id: number;
  kind: FavoriteKind;
  name: string;
  subtitle?: string;
  imageUrl?: string;
};

const STORAGE_KEY = 'scoutcore-favorites-v1';

export function getFavorites(): FavoriteItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveFavorites(items: FavoriteItem[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('scoutcore:favorites-changed'));
}

export function isFavorite(kind: FavoriteKind, id: number) {
  return getFavorites().some((item) => item.kind === kind && item.id === id);
}

export function toggleFavorite(item: FavoriteItem) {
  const current = getFavorites();
  const exists = current.some((entry) => entry.kind === item.kind && entry.id === item.id);
  const next = exists
    ? current.filter((entry) => !(entry.kind === item.kind && entry.id === item.id))
    : [...current, item];
  saveFavorites(next);
  return !exists;
}

export const isFavoriteTeam = (id: number) => isFavorite('team', id);
export const isFavoritePlayer = (id: number) => isFavorite('player', id);

export function toggleFavoriteTeam(team: { id: number; name: string; abbreviation?: string }) {
  return toggleFavorite({ id: team.id, kind: 'team', name: team.name, subtitle: team.abbreviation });
}

export function toggleFavoritePlayer(player: { id: number; name: string; team?: string }) {
  return toggleFavorite({ id: player.id, kind: 'player', name: player.name, subtitle: player.team });
}
