-- EgoRank PostgreSQL / Supabase Unified Schema (001_egorank_schema.sql)
-- Supports Cashfree (INR), PayPal (USD), and modular Stripe (future)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE CHECK (username ~ '^[a-zA-Z0-9_]{3,32}$'),
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 80),
  avatar_url TEXT,
  bio TEXT CHECK (char_length(bio) <= 400),
  website_url TEXT CHECK (char_length(website_url) <= 300),
  social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
  achievement TEXT CHECK (char_length(achievement) <= 160),
  badges TEXT[] NOT NULL DEFAULT ARRAY['First Member']::TEXT[],
  featured_tier TEXT NOT NULL DEFAULT 'none' CHECK (featured_tier IN ('none', 'featured_7d', 'premium_30d', 'sponsored')),
  featured_expires_at TIMESTAMPTZ,
  referral_code TEXT NOT NULL UNIQUE,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  is_suspended BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles (lower(username));
CREATE INDEX IF NOT EXISTS idx_profiles_featured ON public.profiles (featured_tier, featured_expires_at);

-- 2. LEADERBOARD
CREATE TABLE IF NOT EXISTS public.leaderboard (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  current_champion_id UUID REFERENCES public.profiles(id),
  current_price_cents INTEGER NOT NULL DEFAULT 100 CHECK (current_price_cents >= 100),
  next_price_cents INTEGER NOT NULL DEFAULT 200 CHECK (next_price_cents = current_price_cents + 100),
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. CHALLENGES (Modular Engine - Sandbox / Approved Live)
CREATE TABLE IF NOT EXISTS public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  previous_champion_id UUID REFERENCES public.profiles(id),
  offered_price_cents INTEGER NOT NULL CHECK (offered_price_cents > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reserved', 'paid', 'failed', 'expired', 'sandbox_completed')),
  reservation_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_challenges_challenger ON public.challenges (challenger_id, created_at DESC);

-- 4. UNIFIED MULTI-PROVIDER PAYMENTS
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('cashfree', 'paypal', 'stripe')),
  provider_order_id TEXT NOT NULL,
  provider_transaction_id TEXT,
  package_type TEXT NOT NULL CHECK (package_type IN ('featured_7d', 'premium_30d', 'sponsored', 'challenge')),
  country_code TEXT NOT NULL CHECK (char_length(country_code) = 2),
  amount INTEGER NOT NULL CHECK (amount > 0), -- minor units (paise for INR, cents for USD)
  currency TEXT NOT NULL CHECK (currency IN ('INR', 'USD')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'cancelled', 'disputed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE (provider, provider_order_id)
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments (provider, payment_status);

-- 5. UNIFIED WEBHOOK EVENTS (Idempotency)
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('cashfree', 'paypal', 'stripe')),
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_event_id)
);

-- 6. CHAMPION HISTORY (Immutable Archive)
CREATE TABLE IF NOT EXISTS public.champion_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  challenge_id UUID REFERENCES public.challenges(id),
  winning_price_cents INTEGER NOT NULL CHECK (winning_price_cents >= 0),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_champion_history_started ON public.champion_history (started_at DESC);

-- 7. REFERRALS
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. FEATURED PROFILES
CREATE TABLE IF NOT EXISTS public.featured_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  package_type TEXT NOT NULL CHECK (package_type IN ('featured_7d', 'premium_30d', 'sponsored')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked'))
);

-- 9. ROW LEVEL SECURITY
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.champion_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.featured_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable" ON public.profiles
  FOR SELECT USING (is_suspended = false);

CREATE POLICY "Users can update own safe profile fields" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND is_admin = (SELECT is_admin FROM public.profiles WHERE id = auth.uid())
    AND featured_tier = (SELECT featured_tier FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Public leaderboard is readable" ON public.leaderboard
  FOR SELECT USING (true);

CREATE POLICY "Public champion history is readable" ON public.champion_history
  FOR SELECT USING (true);

CREATE POLICY "Users can read own payments" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Public active featured profiles are readable" ON public.featured_profiles
  FOR SELECT USING (status = 'active');
