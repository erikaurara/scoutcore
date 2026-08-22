import { supabase } from './supabaseClient';

export type AnalysisFeature = 'matchup_lab' | 'team_analysis';
export type AccessTier = 'guest' | 'free' | 'premium' | 'admin';

export type AnalysisAccess = {
  tier: AccessTier;
  unlimited: boolean;
  resetAt: string | null;
  limits: {
    matchup_lab: number;
    team_analysis: number;
    player_prediction_cards: number;
  };
  usage: Record<AnalysisFeature, number>;
  remaining: Record<AnalysisFeature, number | null>;
  capabilities: {
    advanced_analytics: boolean;
    advanced_prediction_filters: boolean;
  };
};

export type CreditResult = {
  allowed: boolean;
  tier: Exclude<AccessTier, 'guest'>;
  unlimited: boolean;
  feature: AnalysisFeature;
  limit: number | null;
  used: number | null;
  remaining: number | null;
  resetAt: string | null;
  error?: string;
};

const baseLimits = {
  matchup_lab: 3,
  team_analysis: 1,
  player_prediction_cards: 3,
};

export const guestAnalysisAccess: AnalysisAccess = {
  tier: 'guest',
  unlimited: false,
  resetAt: null,
  limits: baseLimits,
  usage: { matchup_lab: 0, team_analysis: 0 },
  remaining: { matchup_lab: 0, team_analysis: 0 },
  capabilities: { advanced_analytics: false, advanced_prediction_filters: false },
};

export const freeAnalysisAccess: AnalysisAccess = {
  ...guestAnalysisAccess,
  tier: 'free',
  remaining: { matchup_lab: baseLimits.matchup_lab, team_analysis: baseLimits.team_analysis },
};

const numberOr = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const nullableNumber = (value: unknown, fallback: number | null) => value === null
  ? null
  : value === undefined
    ? fallback
    : numberOr(value, fallback ?? 0);

const normalizeAccess = (value: any): AnalysisAccess => {
  const tier: AnalysisAccess['tier'] = value?.tier === 'admin' || value?.tier === 'premium' ? value.tier : 'free';
  const unlimited = Boolean(value?.unlimited || tier === 'admin' || tier === 'premium');
  const limits = {
    matchup_lab: numberOr(value?.limits?.matchup_lab, baseLimits.matchup_lab),
    team_analysis: numberOr(value?.limits?.team_analysis, baseLimits.team_analysis),
    player_prediction_cards: numberOr(value?.limits?.player_prediction_cards, baseLimits.player_prediction_cards),
  };

  return {
    tier,
    unlimited,
    resetAt: typeof value?.reset_at === 'string' ? value.reset_at : null,
    limits,
    usage: {
      matchup_lab: numberOr(value?.usage?.matchup_lab, 0),
      team_analysis: numberOr(value?.usage?.team_analysis, 0),
    },
    remaining: {
      matchup_lab: unlimited ? null : nullableNumber(value?.remaining?.matchup_lab, limits.matchup_lab),
      team_analysis: unlimited ? null : nullableNumber(value?.remaining?.team_analysis, limits.team_analysis),
    },
    capabilities: {
      advanced_analytics: Boolean(value?.capabilities?.advanced_analytics || unlimited),
      advanced_prediction_filters: Boolean(value?.capabilities?.advanced_prediction_filters || unlimited),
    },
  };
};

export const getAnalysisAccess = async (signedIn: boolean): Promise<AnalysisAccess> => {
  if (!signedIn) return guestAnalysisAccess;
  if (!supabase) return freeAnalysisAccess;

  const { data, error } = await supabase.rpc('get_analysis_access');
  if (error) throw error;
  return normalizeAccess(data);
};

export const consumeAnalysisCredit = async (feature: AnalysisFeature): Promise<CreditResult> => {
  if (!supabase) {
    return {
      allowed: false,
      tier: 'free',
      unlimited: false,
      feature,
      limit: baseLimits[feature],
      used: null,
      remaining: 0,
      resetAt: null,
      error: 'Analysis access is temporarily unavailable.',
    };
  }

  const { data, error } = await supabase.rpc('consume_analysis_credit', { p_feature: feature });
  if (error) {
    return {
      allowed: false,
      tier: 'free',
      unlimited: false,
      feature,
      limit: baseLimits[feature],
      used: null,
      remaining: 0,
      resetAt: null,
      error: error.message || 'Unable to verify analysis access.',
    };
  }

  return {
    allowed: Boolean(data?.allowed),
    tier: data?.tier === 'admin' || data?.tier === 'premium' ? data.tier : 'free',
    unlimited: Boolean(data?.unlimited),
    feature,
    limit: nullableNumber(data?.limit, baseLimits[feature]),
    used: nullableNumber(data?.used, null),
    remaining: nullableNumber(data?.remaining, 0),
    resetAt: typeof data?.reset_at === 'string' ? data.reset_at : null,
  };
};

export const applyCreditResult = (access: AnalysisAccess, result: CreditResult): AnalysisAccess => ({
  ...access,
  tier: result.tier,
  unlimited: result.unlimited,
  resetAt: result.resetAt ?? access.resetAt,
  usage: {
    ...access.usage,
    [result.feature]: result.used ?? access.usage[result.feature],
  },
  remaining: {
    ...access.remaining,
    [result.feature]: result.remaining,
  },
  capabilities: result.unlimited
    ? { advanced_analytics: true, advanced_prediction_filters: true }
    : access.capabilities,
});
