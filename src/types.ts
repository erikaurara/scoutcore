export type NavigationTab = 
  | 'dashboard' 
  | 'schedule'
  | 'matchups' 
  | 'team-comparison' 
  | 'game-logs' 
  | 'scouting-feed' 
  | 'analytics' 
  | 'player-profile'
  | 'team-profile'
  | 'membership'
  | 'settings';

export interface Player {
  id: string;
  name: string;
  team: string;
  number: string;
  position: 'SP' | 'RP' | 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF' | 'DH';
  batsHand: 'R' | 'L' | 'S';
  throwsHand: 'R' | 'L';
  avatarUrl: string;
  stats: {
    avgVelo?: number;
    whiffPct?: number;
    kPerNine?: number;
    exitVelo?: number;
    chasePct?: number;
    barrelPct?: number;
    era?: number;
    whip?: number;
    ops?: number;
    avg?: number;
  };
  arsenalOrPitchPerf?: {
    label: string;
    value: number;
    colorClass: string;
  }[];
}

export interface MatchupCardData {
  id: string;
  gameStatus: string;
  leverage: string;
  leverageLevel: 'HIGH' | 'MED' | 'LOW';
  confidencePct?: number;
  pitcher: Player;
  batter: Player;
  pitcherVelo: string;
  pitcherStatLabel: string;
  pitcherStatVal: string;
  batterStatVal1: string;
  batterStatLabel: string;
  batterStatVal2: string;
  advantagePct: number;
  advantageHolder: 'PITCHER' | 'BATTER';
  keyFactor: string;
  venue: string;
  conditions: string;
}

export interface ScoutingSignal {
  id: string;
  type: 'PERFORMANCE SPIKE' | 'PROSPECT ALERT' | 'INJURY WATCH' | 'VELOCITY DEVIATION';
  title: string;
  player: string;
  team: string;
  timeAgo: string;
  description: string;
  severity: 'high' | 'med' | 'info';
  icon: string;
  accentColor: string;
}

export interface TeamPowerIndexItem {
  rank: string;
  code: string;
  name: string;
  score: number;
  pctWidth: string;
  record: string;
  division: string;
}

export interface HistoricalGameLog {
  id: string;
  date: string;
  opponent: string;
  result: 'W' | 'L';
  score: string;
  type: 'Pitcher' | 'Batter';
  ipOrAb: string;
  hits: number;
  runs: number;
  bb: number;
  so: number;
  eraOrAvg: string;
  playerName: string;
  playerTeam: string;
}

export interface TeamComparisonData {
  teamA: {
    city: string;
    name: string;
    code: string;
    record: string;
    standing: string;
    logoUrl: string;
    ops: number;
    defEfficiency: number;
    bullpenXFip: number;
    era: number;
  };
  teamB: {
    city: string;
    name: string;
    code: string;
    record: string;
    standing: string;
    logoUrl: string;
    ops: number;
    defEfficiency: number;
    bullpenXFip: number;
    era: number;
  };
  winProbA: number;
  winProbB: number;
  keyMatchupNotes: string[];
}
