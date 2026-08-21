export const mlbTeamLogoUrl = (teamId?: number | null) =>
  teamId ? `https://www.mlbstatic.com/team-logos/${teamId}.svg` : '';

export const mlbPlayerHeadshotUrl = (playerId?: number | null, width = 180) =>
  playerId
    ? `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:silo:current.png/w_${width},q_auto:best/v1/people/${playerId}/headshot/67/current`
    : '';

export const playerInitials = (name?: string) =>
  (name ?? 'MLB')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
