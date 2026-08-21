export const MEMBERSHIP_PRICING = {
  trialDays: 7,
  monthly: {
    introductoryPrice: 7.99,
    introductoryMonths: 1,
    recurringPrice: 9.99,
    currency: 'USD',
  },
  season: {
    price: 54.99,
    currency: 'USD',
    label: 'Full MLB season + postseason',
    autoRenews: false,
  },
} as const;

export type PremiumPlanChoice = 'monthly' | 'season';
