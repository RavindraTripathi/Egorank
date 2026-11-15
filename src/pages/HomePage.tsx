import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, ChevronDown, Crown, ShieldCheck, Sparkles, Trophy } from 'lucide-react';
import { AvatarWithFallback } from '../components/AvatarWithFallback';
import { usePageMeta } from '../components/Layout';
import { ASSETS } from '../lib/assets';
import {
  fetchChampionHistory,
  fetchLeaderboardState,
  fetchPublicProfiles,
} from '../lib/firestoreService';
import {
  ChampionHistoryRecord,
  LeaderboardState,
  Profile,
  TIER_LABELS,
} from '../types/egorank';

const FAQ_ITEMS = [
  {
    q: 'How does EgoRank ranking work today?',
    a: 'Competitors create a verified public profile for free. Featured placements (7-day Featured, 30-day Premium, and Sponsored placements) elevate visibility across the Global Leaderboard and Homepage.',
  },
  {
    q: 'Why is the $1 escalating throne challenge in Sandbox mode?',
    a: 'To protect users and comply with payment network underwriting, live real-money transactions use fixed-price featured profile placements via Cashfree (India · INR) and PayPal (International · USD). The escalating $1 challenge engine is preserved in our Sandbox Simulator for evaluation.',
  },
  {
    q: 'Which payment methods are supported by region?',
    a: 'Customers in India pay in INR via Cashfree (UPI, domestic cards, netbanking). International customers pay in USD via PayPal Checkout. Country eligibility, currency, and pricing are strictly validated on the backend.',
  },
  {
    q: 'Are Hall of Fame records ever deleted when a champion changes?',
    a: 'Never. Every historical reign is permanently preserved in the Hall of Fame archive with start date, end date, achievement, and duration at the top.',
  },
];

export function HomePage() {
  usePageMeta(
    'EgoRank — The Throne Is Occupied | Global Competitive Leaderboard',
    'Everyone wants to be number one. Only a few earn the spotlight. Create your EgoRank profile, earn featured visibility, and ascend the Hall of Fame.'
  );

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [hasDemoFallback, setHasDemoFallback] = useState(true);
  const [leaderboardState, setLeaderboardState] = useState<LeaderboardState | null>(null);
  const [history, setHistory] = useState<ChampionHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [profRes, stateRes, histRes] = await Promise.all([
          fetchPublicProfiles(),
          fetchLeaderboardState(),
          fetchChampionHistory(),
        ]);
        if (!active) return;
        setProfiles(profRes.profiles);
        setHasDemoFallback(profRes.hasDemoFallback);
        setLeaderboardState(stateRes);
        setHistory(histRes);
      } catch {
        // Fallback handled in service
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const champion = profiles[0] || null;
  const featuredProfiles = profiles.filter((p) => p.featuredTier !== 'none').slice(0, 3);
  const nextPriceDollars = leaderboardState
    ? `$${(leaderboardState.nextPriceCents / 100).toFixed(0)}`
    : '$15';

  return (
    <div className="pb-16">
      {/* HERO SECTION */}
      <section className="relative overflow-hidden border-b border-[#D4AF37]/15">
        <div className="absolute inset-0 pointer-events-none">
          <img
            src={ASSETS.heroCrown}
            alt="Sculpted 24k gold crown on obsidian monolith"
            className="w-full h-full object-cover opacity-35"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#080808] via-[#080808]/88 to-[#080808]/70" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-transparent to-[#080808]/60" />
        </div>

        <div className="relative max-w-[1200px] mx-auto px-6 py-20 lg:py-28 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Headline & CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="lg:col-span-7 space-y-6"
          >
            <div className="flex items-center gap-3 text-xs tracking-[0.22em] text-[#D4AF37] uppercase">
              <motion.span
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="inline-flex"
              >
                <Crown className="w-4 h-4 text-[#F5DE9B]" />
              </motion.span>
              <span>Pay. Challenge. Dominate.</span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.08] text-balance">
              THE THRONE IS OCCUPIED.
            </h1>

            <p className="text-base sm:text-lg text-[#CCCCCC] max-w-xl leading-relaxed">
              Everyone wants to be number one. Only a few earn the spotlight.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                to="/leaderboard"
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-lg gold-gradient-bg text-[#080808] text-xs font-semibold tracking-[0.14em] uppercase hover:brightness-110 transition whitespace-nowrap"
              >
                Explore the Leaderboard
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg border border-[#D4AF37]/40 bg-[#151515]/80 text-[#F5DE9B] text-xs font-semibold tracking-[0.14em] uppercase hover:border-[#F5DE9B] transition whitespace-nowrap"
              >
                Create Your Profile
              </Link>
            </div>

            <div className="pt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#999999]">
              <span>Fixed-Price Featured Placements Active</span>
              <span aria-hidden="true">·</span>
              <span>Cashfree (INR) &amp; PayPal (USD)</span>
              <span aria-hidden="true">·</span>
              <span>Escalating Engine in Sandbox</span>
            </div>
          </motion.div>

          {/* Right Column: Current Reigning Champion Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-5"
          >
            <div className="luxury-card-featured rounded-2xl p-7 space-y-6">
              <div className="flex items-center justify-between text-xs text-[#D4AF37] tracking-[0.18em] uppercase">
                <span className="flex items-center gap-2">
                  <Crown className="w-4 h-4" />
                  Current Position #1
                </span>
                <span className="font-mono text-[#999999]">
                  {leaderboardState?.isDemo || hasDemoFallback ? 'Demo Showcase' : 'Live Throne'}
                </span>
              </div>

              {loading ? (
                <div className="space-y-4 animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-white/10" />
                    <div className="space-y-2 flex-1">
                      <div className="h-5 bg-white/10 rounded w-2/3" />
                      <div className="h-3 bg-white/10 rounded w-1/3" />
                    </div>
                  </div>
                  <div className="h-12 bg-white/5 rounded" />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4">
                    <AvatarWithFallback
                      src={leaderboardState?.currentChampionAvatar || champion?.avatarUrl}
                      name={
                        leaderboardState?.currentChampionDisplayName ||
                        champion?.displayName ||
                        'Reigning Champion'
                      }
                      sizeClass="w-16 h-16"
                      highlightGold
                    />
                    <div className="min-w-0">
                      <h2 className="font-display text-xl font-semibold text-white truncate">
                        {leaderboardState?.currentChampionDisplayName || champion?.displayName}
                      </h2>
                      <Link
                        to={`/u/${leaderboardState?.currentChampionUsername || champion?.username}`}
                        className="font-mono text-xs text-[#D4AF37] hover:text-[#F5DE9B] transition"
                      >
                        @{leaderboardState?.currentChampionUsername || champion?.username}
                      </Link>
                    </div>
                  </div>

                  <p className="text-sm text-[#CCCCCC] leading-relaxed border-t border-white/10 pt-4">
                    {leaderboardState?.currentChampionAchievement ||
                      champion?.achievement ||
                      'Holding the #1 Spotlight on EgoRank'}
                  </p>

                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/10">
                    <div>
                      <p className="text-[11px] text-[#999999] uppercase tracking-wider">
                        Next Sandbox Challenge
                      </p>
                      <p className="font-mono text-lg font-semibold text-[#F5DE9B] tabular-nums mt-0.5">
                        {nextPriceDollars} <span className="text-[11px] font-sans text-[#999999]">(Info Only)</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-[#999999] uppercase tracking-wider">
                        Placement Status
                      </p>
                      <p className="text-sm font-medium text-white mt-1">
                        {champion ? TIER_LABELS[champion.featuredTier] : 'Sponsored Crown'}
                      </p>
                    </div>
                  </div>

                  <Link
                    to={`/u/${leaderboardState?.currentChampionUsername || champion?.username || 'aurelius_v'}`}
                    className="block text-center py-2.5 rounded-lg border border-[#D4AF37]/30 text-xs font-medium text-[#F5DE9B] hover:bg-[#D4AF37]/10 transition"
                  >
                    Inspect Champion Dossier
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* A. LIVE LEADERBOARD PREVIEW */}
      <section className="max-w-[1200px] mx-auto px-6 py-16 space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.2em] text-[#D4AF37] uppercase">
              Global Standings
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-white mt-1">
              Live Leaderboard Preview
            </h2>
          </div>
          <Link
            to="/leaderboard"
            className="text-xs font-medium text-[#F5DE9B] hover:underline inline-flex items-center gap-1.5"
          >
            View Full Leaderboard <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="luxury-card rounded-xl overflow-hidden">
          <div className="divide-y divide-white/8">
            {profiles.slice(0, 5).map((p, idx) => (
              <div
                key={p.uid}
                className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 px-6 py-4 hover:bg-white/[0.02] transition"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span
                    className={`font-mono text-sm w-8 tabular-nums ${
                      idx === 0 ? 'text-[#F5DE9B] font-semibold' : 'text-[#999999]'
                    }`}
                  >
                    #{idx + 1}
                  </span>
                  <AvatarWithFallback
                    src={p.avatarUrl}
                    name={p.displayName}
                    sizeClass="w-11 h-11"
                    highlightGold={idx === 0}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      <span className="truncate">{p.displayName}</span>
                      {p.isDemo && (
                        <span className="text-[11px] text-[#999999]">· Demo</span>
                      )}
                    </div>
                    <p className="text-xs text-[#999999] truncate mt-0.5">
                      @{p.username} · {p.achievement}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 ml-auto">
                  <span className="text-xs text-[#D4AF37]">
                    {TIER_LABELS[p.featuredTier]}
                  </span>
                  <Link
                    to={`/u/${p.username}`}
                    className="px-3.5 py-1.5 rounded-lg border border-white/12 text-xs text-white hover:border-[#D4AF37]/50 hover:text-[#F5DE9B] transition whitespace-nowrap"
                  >
                    Profile
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* B. HOW EGORANK WORKS */}
      <section
        id="how-it-works"
        className="border-y border-white/8 bg-[#0b0b0b] py-16"
      >
        <div className="max-w-[1200px] mx-auto px-6 space-y-10">
          <div className="max-w-2xl">
            <p className="text-xs tracking-[0.2em] text-[#D4AF37] uppercase">
              How EgoRank Works
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-white mt-1">
              Ascend Through Verified Visibility
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="luxury-card rounded-xl p-6 space-y-3">
              <p className="font-mono text-xs text-[#D4AF37]">01</p>
              <h3 className="font-display text-lg text-white">
                Claim Your Competitor Handle
              </h3>
              <p className="text-sm text-[#999999] leading-relaxed">
                Register with Google or Email, lock a unique handle, and publish your bio, achievement, and social links.
              </p>
            </div>

            <div className="luxury-card rounded-xl p-6 space-y-3">
              <p className="font-mono text-xs text-[#D4AF37]">02</p>
              <h3 className="font-display text-lg text-white">
                Activate Featured Spotlight
              </h3>
              <p className="text-sm text-[#999999] leading-relaxed">
                Select a fixed-price 7-day or 30-day featured placement via Cashfree (INR) or PayPal (USD) verified server-side.
              </p>
            </div>

            <div className="luxury-card rounded-xl p-6 space-y-3">
              <p className="font-mono text-xs text-[#D4AF37]">03</p>
              <h3 className="font-display text-lg text-white">
                Share Your Champion Card
              </h3>
              <p className="text-sm text-[#999999] leading-relaxed">
                Download your black-and-gold Champion Card, invite challengers via your referral link, and earn Hall of Fame badges.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* C. HALL OF FAME PREVIEW & D. FEATURED PROFILES */}
      <section className="max-w-[1200px] mx-auto px-6 py-16 grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Hall of Fame Preview */}
        <div className="lg:col-span-6 space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs tracking-[0.2em] text-[#D4AF37] uppercase">
                Immutable Archive
              </p>
              <h2 className="font-display text-2xl font-semibold text-white mt-1">
                Hall of Fame
              </h2>
            </div>
            <Link
              to="/hall-of-fame"
              className="text-xs text-[#F5DE9B] hover:underline inline-flex items-center gap-1"
            >
              Full Archive <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-4">
            {history.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="luxury-card rounded-xl p-5 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <AvatarWithFallback src={item.avatarUrl} name={item.displayName} sizeClass="w-12 h-12" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white truncate">{item.displayName}</span>
                      {item.isDemo && (
                        <span className="text-[11px] text-[#999999]">· Demo</span>
                      )}
                    </div>
                    <p className="text-xs text-[#999999] truncate mt-0.5">
                      {item.durationLabel || 'Verified Reign'} · {item.achievement}
                    </p>
                  </div>
                </div>
                <Link
                  to={`/u/${item.username}`}
                  className="text-xs text-[#D4AF37] hover:text-[#F5DE9B] whitespace-nowrap shrink-0"
                >
                  @{item.username}
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Featured Profiles */}
        <div className="lg:col-span-6 space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs tracking-[0.2em] text-[#D4AF37] uppercase">
                Curated Spotlight
              </p>
              <h2 className="font-display text-2xl font-semibold text-white mt-1">
                Featured Profiles
              </h2>
            </div>
            <Link
              to="/checkout"
              className="text-xs text-[#F5DE9B] hover:underline inline-flex items-center gap-1"
            >
              Get Featured <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-4">
            {featuredProfiles.map((fp) => (
              <div
                key={fp.uid}
                className="luxury-card-featured rounded-xl p-5 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <AvatarWithFallback
                    src={fp.avatarUrl}
                    name={fp.displayName}
                    sizeClass="w-12 h-12"
                    highlightGold
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-[#D4AF37]">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{TIER_LABELS[fp.featuredTier]}</span>
                      {fp.isDemo && <span className="text-[#999999]">· Demo</span>}
                    </div>
                    <p className="font-medium text-white truncate mt-0.5">{fp.displayName}</p>
                    <p className="text-xs text-[#999999] truncate">{fp.bio}</p>
                  </div>
                </div>
                <Link
                  to={`/u/${fp.username}`}
                  className="px-3.5 py-1.5 rounded-lg border border-[#D4AF37]/35 text-xs text-[#F5DE9B] hover:bg-[#D4AF37]/10 transition whitespace-nowrap shrink-0"
                >
                  Inspect
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* E. CLEARLY-LABELED PLATFORM STATISTICS */}
      <section className="max-w-[1200px] mx-auto px-6 py-8">
        <div className="luxury-card rounded-xl p-8">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-6 border-b border-white/10">
            <h2 className="font-display text-lg text-white">
              Arena Telemetry
            </h2>
            <span className="text-xs text-[#999999]">
              {hasDemoFallback
                ? 'Labeled Demo Showcase Figures (Live counts update as competitors register)'
                : 'Live Database Metrics'}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6">
            <div>
              <p className="text-xs text-[#999999]">Indexed Competitors</p>
              <p className="font-mono text-2xl font-semibold text-white tabular-nums mt-1">
                {profiles.length}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#999999]">Active Featured</p>
              <p className="font-mono text-2xl font-semibold text-[#F5DE9B] tabular-nums mt-1">
                {featuredProfiles.length}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#999999]">Hall of Fame Reigns</p>
              <p className="font-mono text-2xl font-semibold text-white tabular-nums mt-1">
                {history.length}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#999999]">Sandbox Throne Version</p>
              <p className="font-mono text-2xl font-semibold text-[#D4AF37] tabular-nums mt-1">
                #{leaderboardState?.version ?? 14}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* F. FAQ */}
      <section className="max-w-[1200px] mx-auto px-6 py-12 space-y-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-[#D4AF37]" />
          <h2 className="font-display text-2xl font-semibold text-white">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="luxury-card rounded-xl divide-y divide-white/8">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={item.q} className="px-6 py-4">
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between gap-4 text-left py-1 cursor-pointer"
                >
                  <span className="text-sm font-medium text-white">{item.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-[#D4AF37] shrink-0 transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <p className="text-sm text-[#999999] leading-relaxed pt-3 pr-8">
                    {item.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom Conversion Strip */}
        <div className="luxury-card-featured rounded-xl p-8 flex flex-wrap items-center justify-between gap-6 mt-8">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-[#D4AF37] uppercase tracking-[0.18em]">
              <Trophy className="w-4 h-4" />
              <span>Ready to Compete</span>
            </div>
            <h3 className="font-display text-2xl text-white">
              Claim Your Spot on the Global Leaderboard
            </h3>
          </div>
          <Link
            to="/register"
            className="px-6 py-3 rounded-lg gold-gradient-bg text-[#080808] text-xs font-semibold tracking-[0.14em] uppercase hover:brightness-110 transition whitespace-nowrap"
          >
            Create Free Profile
          </Link>
        </div>
      </section>
    </div>
  );
}
