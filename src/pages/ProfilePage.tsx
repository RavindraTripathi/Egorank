import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Award, Calendar, ExternalLink, Flag, Globe, Sparkles } from 'lucide-react';
import { AvatarWithFallback } from '../components/AvatarWithFallback';
import { ChampionCardCanvas } from '../components/ChampionCardCanvas';
import { usePageMeta } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import {
  fetchProfileByUsername,
  fetchPublicProfiles,
  submitProfileReport,
} from '../lib/firestoreService';
import { Profile, TIER_LABELS } from '../types/egorank';

export function ProfilePage() {
  const { username = '' } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rankIndex, setRankIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportStatus, setReportStatus] = useState<string | null>(null);

  usePageMeta(
    profile ? `${profile.displayName} (@${profile.username}) — EgoRank` : 'Competitor Profile — EgoRank',
    profile?.bio || 'Verified EgoRank competitor profile, achievements, and official Champion Card.'
  );

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const [p, listRes] = await Promise.all([
          fetchProfileByUsername(username),
          fetchPublicProfiles(),
        ]);
        if (!active) return;
        setProfile(p);
        if (p) {
          const idx = listRes.profiles.findIndex((item) => item.usernameLower === p.usernameLower);
          setRankIndex(idx >= 0 ? idx + 1 : null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [username]);

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    setReportStatus(null);
    try {
      await submitProfileReport({
        reporterUid: user.uid,
        targetUid: profile.uid,
        targetUsername: profile.username,
        reason: reportReason,
      });
      setReportStatus('Report submitted for administrator moderation review.');
      setReportReason('');
      setTimeout(() => setReportOpen(false), 1800);
    } catch (err) {
      setReportStatus(err instanceof Error ? err.message : 'Unable to submit report.');
    }
  };

  if (loading) {
    return (
      <div className="max-w-[1000px] mx-auto px-6 py-16 space-y-6">
        <div className="luxury-card rounded-2xl p-8 h-52 animate-pulse" />
        <div className="luxury-card rounded-2xl p-8 h-80 animate-pulse" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-[700px] mx-auto px-6 py-24 text-center space-y-5">
        <h1 className="font-display text-3xl text-white">Competitor Not Found</h1>
        <p className="text-sm text-[#999999]">
          No active profile exists for @{username}. Claim this handle before someone else does.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            to="/register"
            className="px-5 py-2.5 rounded-lg gold-gradient-bg text-[#080808] text-xs font-semibold uppercase tracking-wider"
          >
            Claim @{username}
          </Link>
          <Link
            to="/leaderboard"
            className="px-5 py-2.5 rounded-lg border border-white/15 text-xs text-white"
          >
            Back to Leaderboard
          </Link>
        </div>
      </div>
    );
  }

  const rankLabel = rankIndex ? `#${rankIndex}` : 'Ranked';

  return (
    <div className="max-w-[1000px] mx-auto px-6 py-12 space-y-8">
      {/* Main Profile Header Card */}
      <div
        className={`${
          profile.featuredTier !== 'none' ? 'luxury-card-featured' : 'luxury-card'
        } rounded-2xl p-8 space-y-6`}
      >
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-6">
            <AvatarWithFallback
              src={profile.avatarUrl}
              name={profile.displayName}
              sizeClass="w-24 h-24"
              highlightGold={profile.featuredTier !== 'none'}
            />
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#D4AF37]">
                <span className="font-mono font-semibold tabular-nums">{rankLabel}</span>
                <span aria-hidden="true">·</span>
                <span>{TIER_LABELS[profile.featuredTier]}</span>
                {profile.isDemo && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#999999]">Demo Showcase</span>
                  </>
                )}
              </div>
              <h1 className="font-display text-3xl font-bold text-white">
                {profile.displayName}
              </h1>
              <p className="font-mono text-sm text-[#D4AF37]">@{profile.username}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user && user.uid === profile.uid && (
              <Link
                to="/dashboard"
                className="px-4 py-2 rounded-lg border border-[#D4AF37]/40 text-xs text-[#F5DE9B] hover:bg-[#D4AF37]/10 transition"
              >
                Edit Profile
              </Link>
            )}
            {user && user.uid !== profile.uid && (
              <button
                type="button"
                onClick={() => setReportOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-xs text-[#999999] hover:text-white transition cursor-pointer"
              >
                <Flag className="w-3.5 h-3.5" />
                Report
              </button>
            )}
          </div>
        </div>

        {profile.bio && (
          <p className="text-sm text-[#CCCCCC] leading-relaxed max-w-2xl">
            {profile.bio}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-white/10 text-sm">
          <div className="space-y-1">
            <p className="text-xs text-[#999999] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
              Confirmed Achievement
            </p>
            <p className="text-white">{profile.achievement || 'Active EgoRank Competitor'}</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-[#999999] flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#D4AF37]" />
              Joined Arena
            </p>
            <p className="text-white font-mono text-xs tabular-nums">
              {new Date(profile.createdAt).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>

        {/* Links */}
        <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-[#F5DE9B]">
          {profile.websiteUrl && (
            <a
              href={profile.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 hover:underline"
            >
              <Globe className="w-3.5 h-3.5" />
              Website
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {profile.socialLinks?.x && (
            <a href={profile.socialLinks.x} target="_blank" rel="noopener noreferrer" className="hover:underline">
              X / Twitter
            </a>
          )}
          {profile.socialLinks?.linkedin && (
            <a href={profile.socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="hover:underline">
              LinkedIn
            </a>
          )}
          {profile.socialLinks?.instagram && (
            <a href={profile.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="hover:underline">
              Instagram
            </a>
          )}
        </div>
      </div>

      {/* Report Modal Form */}
      {reportOpen && (
        <form onSubmit={handleReportSubmit} className="luxury-card rounded-xl p-6 space-y-4">
          <h3 className="font-display text-base text-white">Report Profile</h3>
          <textarea
            required
            minLength={5}
            maxLength={500}
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Describe why this profile violates EgoRank community standards..."
            rows={3}
            className="w-full rounded-lg bg-[#0d0d0d] border border-white/15 p-3 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg gold-gradient-bg text-[#080808] text-xs font-semibold cursor-pointer"
            >
              Submit Report
            </button>
            <button
              type="button"
              onClick={() => setReportOpen(false)}
              className="px-4 py-2 rounded-lg border border-white/12 text-xs text-[#999999] cursor-pointer"
            >
              Cancel
            </button>
          </div>
          {reportStatus && <p className="text-xs text-[#F5DE9B]">{reportStatus}</p>}
        </form>
      )}

      {/* Achievement Badges */}
      <div className="luxury-card rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-[#D4AF37]" />
          <h2 className="font-display text-lg text-white">Verified Badges</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {profile.badges.map((badge) => (
            <div
              key={badge}
              className="rounded-lg border border-[#D4AF37]/25 bg-[#0e0e0e] px-4 py-3 text-xs text-[#F5DE9B]"
            >
              {badge}
            </div>
          ))}
        </div>
      </div>

      {/* Champion Card Generator & Viral Share */}
      <ChampionCardCanvas profile={profile} rankLabel={rankLabel} />
    </div>
  );
}
