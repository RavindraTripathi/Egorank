import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Search, ShieldAlert, Sparkles, Trophy } from 'lucide-react';
import { AvatarWithFallback } from '../components/AvatarWithFallback';
import { usePageMeta } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import {
  claimSandboxThrone,
  fetchChampionHistory,
  fetchLeaderboardState,
  fetchPublicProfiles,
  fetchSandboxChallenges,
} from '../lib/firestoreService';
import {
  ChallengeRecord,
  ChampionHistoryRecord,
  LeaderboardState,
  Profile,
  TIER_LABELS,
  TIER_PRIORITY,
} from '../types/egorank';

const PAGE_SIZE = 8;

export function LeaderboardPage() {
  usePageMeta(
    'Global Leaderboard — EgoRank',
    'Search and inspect ranked competitors, featured profiles, previous champions, and test the atomic sandbox throne challenge simulator.'
  );

  const { user, profile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [hasDemo, setHasDemo] = useState(false);
  const [state, setState] = useState<LeaderboardState | null>(null);
  const [history, setHistory] = useState<ChampionHistoryRecord[]>([]);
  const [challenges, setChallenges] = useState<ChallengeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'rank' | 'featured' | 'newest'>('rank');
  const [page, setPage] = useState(1);

  const [claiming, setClaiming] = useState(false);
  const [sandboxMsg, setSandboxMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [profRes, stateRes, histRes, chRes] = await Promise.all([
        fetchPublicProfiles(),
        fetchLeaderboardState(),
        fetchChampionHistory(),
        fetchSandboxChallenges().catch(() => []),
      ]);
      setProfiles(profRes.profiles);
      setHasDemo(profRes.hasDemoFallback);
      setState(stateRes);
      setHistory(histRes);
      setChallenges(chRes);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = profiles.filter((p) => {
      if (!q) return true;
      return (
        p.username.toLowerCase().includes(q) ||
        p.displayName.toLowerCase().includes(q) ||
        (p.achievement || '').toLowerCase().includes(q)
      );
    });

    if (sortBy === 'featured') {
      return [...list].sort(
        (a, b) => TIER_PRIORITY[b.featuredTier] - TIER_PRIORITY[a.featuredTier]
      );
    }
    if (sortBy === 'newest') {
      return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    return list;
  }, [profiles, search, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSandboxClaim = async () => {
    if (!user || !profile) return;
    setClaiming(true);
    setSandboxMsg(null);
    try {
      const next = await claimSandboxThrone(profile);
      setState(next);
      setSandboxMsg({
        type: 'ok',
        text: `Sandbox claim committed atomically (Version #${next.version}, simulated price $${(next.currentPriceCents / 100).toFixed(0)}). No real money was charged.`,
      });
      await loadData();
    } catch (err) {
      setSandboxMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to execute sandbox claim.',
      });
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-12 space-y-12">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-2">
          <p className="text-xs tracking-[0.2em] text-[#D4AF37] uppercase">
            Global Standings
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">
            The EgoRank Leaderboard
          </h1>
          <p className="text-sm text-[#999999] max-w-2xl">
            Verified competitors ranked by featured spotlight tier and leaderboard score.
            {hasDemo && ' Displaying clearly labeled Demo Showcase records until live competitors register.'}
          </p>
        </div>

        <Link
          to="/checkout"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg gold-gradient-bg text-[#080808] text-xs font-semibold tracking-wider uppercase hover:brightness-110 transition whitespace-nowrap"
        >
          <Sparkles className="w-4 h-4" />
          Boost With Featured Placement
        </Link>
      </div>

      {/* Champion Highlight + Sandbox Challenge Engine */}
      {state && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 luxury-card-featured rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4 min-w-0">
              <AvatarWithFallback
                src={state.currentChampionAvatar}
                name={state.currentChampionDisplayName}
                sizeClass="w-16 h-16"
                highlightGold
              />
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 text-xs text-[#D4AF37] uppercase tracking-wider">
                  <Crown className="w-4 h-4" />
                  <span>#1 Reigning Throne</span>
                  {state.isDemo && <span className="text-[#999999]">· Demo</span>}
                </div>
                <h2 className="font-display text-xl font-semibold text-white truncate">
                  {state.currentChampionDisplayName}
                </h2>
                <p className="text-xs text-[#999999] truncate">
                  @{state.currentChampionUsername} · {state.currentChampionAchievement}
                </p>
              </div>
            </div>

            <Link
              to={`/u/${state.currentChampionUsername}`}
              className="px-4 py-2 rounded-lg border border-[#D4AF37]/40 text-xs text-[#F5DE9B] hover:bg-[#D4AF37]/10 transition whitespace-nowrap shrink-0"
            >
              View Profile
            </Link>
          </div>

          {/* Modular Sandbox Challenge Simulator ($1 Escalation, Zero Real Charges) */}
          <div className="lg:col-span-5 luxury-card rounded-xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#D4AF37] uppercase tracking-wider">
                Challenge Engine Sandbox
              </span>
              <span className="font-mono text-xs text-[#999999] tabular-nums">
                v{state.version} · No Real Charges
              </span>
            </div>
            <p className="text-xs text-[#999999] leading-relaxed">
              Test the atomic +$1 throne claim transaction safely in sandbox mode. Real-money escalating billing remains disabled pending provider approval.
            </p>
            <div className="flex items-center justify-between gap-4 pt-1">
              <div>
                <p className="text-[11px] text-[#999999]">Simulated Next Claim</p>
                <p className="font-mono text-lg font-semibold text-[#F5DE9B] tabular-nums">
                  ${(state.nextPriceCents / 100).toFixed(0)} <span className="text-xs text-[#999999] font-sans">(Sandbox)</span>
                </p>
              </div>
              {user && profile ? (
                <button
                  type="button"
                  onClick={handleSandboxClaim}
                  disabled={claiming || !user.emailVerified}
                  className="px-4 py-2 rounded-lg border border-[#D4AF37]/50 bg-[#1c180e] text-xs font-semibold text-[#F5DE9B] hover:bg-[#D4AF37]/20 transition whitespace-nowrap cursor-pointer disabled:opacity-50"
                >
                  {claiming ? 'Executing Transaction...' : 'Run Sandbox Claim'}
                </button>
              ) : (
                <Link
                  to="/login"
                  className="px-4 py-2 rounded-lg border border-white/15 text-xs text-white hover:border-[#D4AF37]/50 transition whitespace-nowrap"
                >
                  Sign In to Test
                </Link>
              )}
            </div>
            {sandboxMsg && (
              <p
                className={`text-xs rounded-lg px-3 py-2 ${
                  sandboxMsg.type === 'ok'
                    ? 'bg-[#D4AF37]/10 text-[#F5DE9B] border border-[#D4AF37]/30'
                    : 'bg-red-950/50 text-red-300 border border-red-800/40'
                }`}
              >
                {sandboxMsg.text}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Search & Sorting Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="w-4 h-4 text-[#999999] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search username, display name, or achievement..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#151515] border border-white/12 text-sm text-white placeholder-[#666666] focus:outline-none focus:border-[#D4AF37]"
          />
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#151515] border border-white/10">
          {(
            [
              { id: 'rank', label: 'Top Ranked' },
              { id: 'featured', label: 'Featured Tier' },
              { id: 'newest', label: 'Newest' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSortBy(tab.id);
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition whitespace-nowrap cursor-pointer ${
                sortBy === tab.id
                  ? 'bg-[#D4AF37] text-[#080808]'
                  : 'text-[#999999] hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard Table (Desktop) & Cards (Mobile) */}
      {loading ? (
        <div className="luxury-card rounded-xl p-6 space-y-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-14 rounded bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : paginated.length === 0 ? (
        <div className="luxury-card rounded-xl p-12 text-center space-y-3">
          <ShieldAlert className="w-8 h-8 text-[#D4AF37] mx-auto" />
          <h3 className="font-display text-lg text-white">No Matching Competitors</h3>
          <p className="text-sm text-[#999999]">
            Adjust your search filter or register a new profile to join the standings.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block luxury-card rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-[#999999]">
                  <th className="py-3.5 px-6 font-medium">Rank</th>
                  <th className="py-3.5 px-6 font-medium">Competitor</th>
                  <th className="py-3.5 px-6 font-medium">Confirmed Achievement</th>
                  <th className="py-3.5 px-6 font-medium">Tier</th>
                  <th className="py-3.5 px-6 font-medium text-right">Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8 text-sm">
                {paginated.map((p, idx) => {
                  const globalRank = (page - 1) * PAGE_SIZE + idx + 1;
                  return (
                    <tr key={p.uid} className="hover:bg-white/[0.02] transition">
                      <td className="py-4 px-6 font-mono tabular-nums text-[#F5DE9B] font-semibold">
                        #{globalRank}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3.5">
                          <AvatarWithFallback
                            src={p.avatarUrl}
                            name={p.displayName}
                            sizeClass="w-10 h-10"
                            highlightGold={p.featuredTier !== 'none'}
                          />
                          <div>
                            <div className="font-medium text-white">
                              {p.displayName}{' '}
                              {p.isDemo && (
                                <span className="text-xs text-[#999999] font-normal">· Demo</span>
                              )}
                            </div>
                            <div className="font-mono text-xs text-[#999999]">
                              @{p.username}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-[#CCCCCC] max-w-md truncate">
                        {p.achievement || 'Active EgoRank Competitor'}
                      </td>
                      <td className="py-4 px-6 text-xs text-[#D4AF37] whitespace-nowrap">
                        {TIER_LABELS[p.featuredTier]}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Link
                          to={`/u/${p.username}`}
                          className="inline-flex px-3.5 py-1.5 rounded-lg border border-white/12 text-xs text-white hover:border-[#D4AF37]/50 hover:text-[#F5DE9B] transition whitespace-nowrap"
                        >
                          Open Profile
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {paginated.map((p, idx) => {
              const globalRank = (page - 1) * PAGE_SIZE + idx + 1;
              return (
                <div key={p.uid} className="luxury-card rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-semibold text-[#F5DE9B] tabular-nums">
                      #{globalRank}
                    </span>
                    <span className="text-xs text-[#D4AF37]">{TIER_LABELS[p.featuredTier]}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <AvatarWithFallback
                      src={p.avatarUrl}
                      name={p.displayName}
                      sizeClass="w-11 h-11"
                      highlightGold={p.featuredTier !== 'none'}
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate">{p.displayName}</p>
                      <p className="font-mono text-xs text-[#999999]">@{p.username}</p>
                    </div>
                  </div>
                  <p className="text-xs text-[#CCCCCC]">{p.achievement}</p>
                  <Link
                    to={`/u/${p.username}`}
                    className="block text-center py-2 rounded-lg border border-white/12 text-xs text-[#F5DE9B]"
                  >
                    Open Profile
                  </Link>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-[#999999] font-mono tabular-nums">
              Page {page} of {totalPages} · {filtered.length} competitors
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3.5 py-1.5 rounded-lg border border-white/12 text-xs text-white disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3.5 py-1.5 rounded-lg border border-white/12 text-xs text-white disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {/* Previous Champion History + Recent Sandbox Challenges */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
        <div className="luxury-card rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg text-white flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#D4AF37]" />
              Previous Champion History
            </h3>
            <Link to="/hall-of-fame" className="text-xs text-[#D4AF37] hover:underline">
              Full Archive
            </Link>
          </div>
          <div className="divide-y divide-white/8">
            {history.slice(0, 4).map((h) => (
              <div key={h.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="text-white truncate">{h.displayName}</p>
                  <p className="text-xs text-[#999999] truncate">
                    @{h.username} · {h.durationLabel || 'Historical Reign'}
                  </p>
                </div>
                <span className="font-mono text-xs text-[#F5DE9B] tabular-nums shrink-0">
                  ${(h.winningPriceCents / 100).toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="luxury-card rounded-xl p-6 space-y-4">
          <h3 className="font-display text-lg text-white">
            Recent Sandbox Challenge Log
          </h3>
          {challenges.length === 0 ? (
            <p className="text-sm text-[#999999]">
              No live sandbox challenges recorded yet. Sign in and run a Sandbox Claim above to test atomic throne transitions.
            </p>
          ) : (
            <div className="divide-y divide-white/8">
              {challenges.slice(0, 5).map((c) => (
                <div key={c.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="text-white font-mono text-xs">@{c.challengerUsername}</p>
                    <p className="text-xs text-[#999999]">
                      {new Date(c.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="font-mono text-xs text-[#D4AF37] tabular-nums">
                    ${(c.offeredPriceCents / 100).toFixed(0)} (Sandbox)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
