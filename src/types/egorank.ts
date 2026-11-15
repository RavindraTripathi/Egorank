export type FeaturedTier = 'none' | 'featured_7d' | 'premium_30d' | 'sponsored';
export type PaymentProvider = 'cashfree' | 'paypal' | 'stripe';
export type PaymentCurrency = 'INR' | 'USD';
export type UnifiedPaymentStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'cancelled'
  | 'disputed';

export interface SocialLinks {
  x?: string;
  instagram?: string;
  linkedin?: string;
}

export interface Profile {
  uid: string;
  username: string;
  usernameLower: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  websiteUrl: string;
  socialLinks?: SocialLinks;
  achievement: string;
  badges: string[];
  featuredTier: FeaturedTier;
  featuredExpiresAt?: string | null;
  referralCode: string;
  referredBy?: string;
  isSuspended: boolean;
  isDemo: boolean;
  rankScore: number;
  createdAt: string;
  updatedAt?: string;
}

export interface LeaderboardState {
  currentChampionUid: string;
  currentChampionUsername: string;
  currentChampionDisplayName: string;
  currentChampionAvatar: string;
  currentChampionAchievement: string;
  currentPriceCents: number;
  nextPriceCents: number;
  version: number;
  updatedAt: string;
  isDemo?: boolean;
}

export interface ChampionHistoryRecord {
  id: string;
  uid: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  achievement: string;
  winningPriceCents: number;
  startedAt: string;
  endedAt?: string | null;
  durationLabel?: string;
  isDemo: boolean;
}

export interface ChallengeRecord {
  id: string;
  challengerUid: string;
  challengerUsername: string;
  previousChampionUid: string;
  offeredPriceCents: number;
  status: string;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  user_id: string;
  provider: PaymentProvider;
  provider_order_id: string;
  provider_transaction_id: string;
  package_type: string;
  country_code: string;
  amount: number; // Minor units (paise for INR, cents for USD)
  currency: PaymentCurrency;
  payment_status: UnifiedPaymentStatus;
  created_at: string;
  completed_at?: string | null;
}

export interface NotificationRecord {
  id: string;
  uid: string;
  type: 'package_activated' | 'package_expired' | 'featured' | 'achievement' | 'system';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface ReportRecord {
  id: string;
  reporterUid: string;
  targetUid: string;
  targetUsername: string;
  reason: string;
  status: 'open' | 'reviewed' | 'dismissed';
  createdAt: string;
}

export interface AuditLogRecord {
  id: string;
  actorUid: string;
  action: string;
  target: string;
  details: string;
  createdAt: string;
}

export interface PackageOption {
  id: 'featured_7d' | 'premium_30d' | 'sponsored';
  name: string;
  durationDays: number;
  tier: FeaturedTier;
  description: string;
  amountMinor: number; // paise or cents
  displayPrice: string;
  currency: PaymentCurrency;
}

export interface GatewayHealth {
  cashfreeConfigured: boolean;
  cashfreeEnv: 'sandbox' | 'production';
  paypalConfigured: boolean;
  paypalEnv: 'sandbox' | 'live';
  stripeConfigured: boolean;
  stripeEnv: 'test' | 'live';
  resendConfigured: boolean;
  escalatingLiveEnabled: boolean;
}

export const TIER_PRIORITY: Record<FeaturedTier, number> = {
  sponsored: 4,
  premium_30d: 3,
  featured_7d: 2,
  none: 1,
};

export const TIER_LABELS: Record<FeaturedTier, string> = {
  sponsored: 'Sponsored Crown',
  premium_30d: 'Premium Spotlight',
  featured_7d: 'Featured Profile',
  none: 'Competitor',
};

export function formatMoney(amountMinor: number, currency: PaymentCurrency): string {
  const major = amountMinor / 100;
  if (currency === 'INR') {
    return `₹${major.toLocaleString('en-IN', { minimumFractionDigits: major % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
  }
  return `$${major.toLocaleString('en-US', { minimumFractionDigits: major % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
}
