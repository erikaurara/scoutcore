export type PredictionPlayer = {
  id: number;
  name: string;
  position?: string;
  group: 'hitting' | 'pitching';
  currentTeam?: { id: number; name: string } | null;
};

export type PredictionWindow = 'L5' | 'L10' | 'L20' | 'L30' | 'SEASON' | 'H2H';
export type PredictionSeasonMode = 'CURRENT' | '2025' | 'COMBINED';
export type PredictionTarget = { label: string; value: number; direction: 'gte' | 'lte' };
export type PredictionStat = {
  id: string;
  label: string;
  group: 'hitting' | 'pitching';
  targets: PredictionTarget[];
  value: (stat: any) => number;
  display?: (value: number) => string;
};

export type PredictionLog = {
  date: string;
  season?: number;
  opponent: string;
  opponentId: number | null;
  gamePk: number | null;
  isHome: boolean | null;
  stat: any;
};

export type PredictionRow = PredictionLog & {
  opponentStarterId?: number | null;
  opponentStarterName?: string | null;
  opponentStarterHand?: string | null;
  withPlayerActive?: boolean;
  withoutPlayerActive?: boolean;
  value: number;
  success: boolean;
};

export const num = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
export const rate = (wins: number, total: number) => total ? wins / total : 0;
export const pct = (value: number) => `${Math.round(value * 100)}%`;
export const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
export const inningsToOuts = (value: unknown) => {
  const [whole, frac = '0'] = String(value ?? '0').split('.');
  return (Number(whole) || 0) * 3 + Math.max(0, Math.min(2, Number(frac) || 0));
};
export const outsToInnings = (outs: number) => `${Math.floor(outs / 3)}.${outs % 3}`;
export const succeeds = (value: number, target: PredictionTarget) => target.direction === 'lte' ? value <= target.value : value >= target.value;
export const labelDate = (date: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00Z`));

const reachedBase = (stat: any) => num(stat?.hits) + num(stat?.baseOnBalls) + num(stat?.hitByPitch);

export const HITTER_PREDICTION_STATS: PredictionStat[] = [
  { id: 'hits', label: 'Hits', group: 'hitting', targets: [1,2,3].map(value => ({ label: `${value}+`, value, direction: 'gte' as const })), value: stat => num(stat?.hits) },
  { id: 'totalBases', label: 'Total Bases', group: 'hitting', targets: [1,2,3,4].map(value => ({ label: `${value}+`, value, direction: 'gte' as const })), value: stat => num(stat?.totalBases) },
  { id: 'reachBase', label: 'Reach Base', group: 'hitting', targets: [1,2,3].map(value => ({ label: `${value}+`, value, direction: 'gte' as const })), value: reachedBase },
  { id: 'homeRuns', label: 'Home Runs', group: 'hitting', targets: [1,2].map(value => ({ label: `${value}+`, value, direction: 'gte' as const })), value: stat => num(stat?.homeRuns) },
  { id: 'rbi', label: 'RBI', group: 'hitting', targets: [1,2,3].map(value => ({ label: `${value}+`, value, direction: 'gte' as const })), value: stat => num(stat?.rbi) },
  { id: 'runs', label: 'Runs', group: 'hitting', targets: [1,2,3].map(value => ({ label: `${value}+`, value, direction: 'gte' as const })), value: stat => num(stat?.runs) },
  { id: 'walks', label: 'Walks', group: 'hitting', targets: [1,2].map(value => ({ label: `${value}+`, value, direction: 'gte' as const })), value: stat => num(stat?.baseOnBalls) },
  { id: 'strikeouts', label: 'Batter Strikeouts', group: 'hitting', targets: [1,2,3].map(value => ({ label: `${value}+`, value, direction: 'gte' as const })), value: stat => num(stat?.strikeOuts) },
  { id: 'stolenBases', label: 'Stolen Bases', group: 'hitting', targets: [1,2].map(value => ({ label: `${value}+`, value, direction: 'gte' as const })), value: stat => num(stat?.stolenBases) },
  { id: 'hrr', label: 'Hits + Runs + RBI', group: 'hitting', targets: [2,3,4].map(value => ({ label: `${value}+`, value, direction: 'gte' as const })), value: stat => num(stat?.hits) + num(stat?.runs) + num(stat?.rbi) },
];

export const PITCHER_PREDICTION_STATS: PredictionStat[] = [
  { id: 'pitcherStrikeouts', label: 'Pitcher Strikeouts', group: 'pitching', targets: [4,5,6,7,8].map(value => ({ label: `${value}+`, value, direction: 'gte' as const })), value: stat => num(stat?.strikeOuts) },
  { id: 'innings', label: 'Innings Pitched', group: 'pitching', targets: [{label:'5.0+',value:15,direction:'gte'},{label:'6.0+',value:18,direction:'gte'}], value: stat => inningsToOuts(stat?.inningsPitched), display: outsToInnings },
  { id: 'hitsAllowed', label: 'Hits Allowed', group: 'pitching', targets: [4,5,6].map(value => ({ label: `${value} or fewer`, value, direction: 'lte' as const })), value: stat => num(stat?.hits) },
  { id: 'earnedRuns', label: 'Earned Runs Allowed', group: 'pitching', targets: [1,2,3].map(value => ({ label: `${value} or fewer`, value, direction: 'lte' as const })), value: stat => num(stat?.earnedRuns) },
  { id: 'walksAllowed', label: 'Walks Allowed', group: 'pitching', targets: [1,2,3].map(value => ({ label: `${value} or fewer`, value, direction: 'lte' as const })), value: stat => num(stat?.baseOnBalls) },
];
