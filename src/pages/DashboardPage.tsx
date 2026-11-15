import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Award,
  Bell,
  Check,
  Copy,
  CreditCard,
  ExternalLink,
  LogOut,
  MailCheck,
  Shield,
  Sparkles,
} from 'lucide-react';
import { AvatarWithFallback } from '../components/AvatarWithFallback';
import { ChampionCardCanvas } from '../components/ChampionCardCanvas';
import { usePageMeta } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import {
  checkUsernameAvailability,
  fetchUserPayments,
  fetchUserReferralCount,
  markNotificationRead,
  saveUserProfile,
} from '../lib/firestoreService';
import { formatMoney, PaymentRecord, TIER_LABELS } from '../types/egorank';

export function DashboardPage() {
  usePageMeta('Competitor Dashboard — EgoRank', 'Manage your EgoRank profile, handle, referrals, notifications, and featured placements.');
  const {
    user,
    profile,
    notifications,
    loading,
    isAdmin,
    refreshProfile,
    refreshUser,
    resendVerification,
    logout,
  } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [achievement, setAchievement] = useState('');
  const [xUrl, setXUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');

  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [referralCount, setReferralCount] = useState(0);
  const [copiedRef, setCopiedRef] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username);
      setDisplayName(profile.displayName);
      setAvatarUrl(profile.avatarUrl || '');
      setBio(profile.bio || '');
      setWebsiteUrl(profile.websiteUrl || '');
      setAchievement(profile.achievement || '');
      setXUrl(profile.socialLinks?.x || '');
      setLinkedinUrl(profile.socialLinks?.linkedin || '');
      setInstagramUrl(profile.socialLinks?.instagram || '');
    } else if (user) {
      setDisplayName(user.displayName || user.email?.split('@')[0] || '');
      setAvatarUrl(user.photoURL || '');
    }
  }, [profile, user]);

  useEffect(() => {
    if (!user || !user.emailVerified) return;
    fetchUserPayments(user.uid).then(setPayments).catch(() => setPayments([]));
    fetchUserReferralCount(user.uid).then(setReferralCount).catch(() => setReferralCount(0));
  }, [user]);

  useEffect(() => {
    const clean = username.trim().toLowerCase();
    if (!clean || !/^[a-z0-9_]{3,32}$/.test(clean)) {
      setUsernameAvailable(null);
      return;
    }
    const timer = setTimeout(() => {
      checkUsernameAvailability(clean, user?.uid)
        .then(setUsernameAvailable)
        .catch(() => setUsernameAvailable(null));
    }, 300);
    return () => clearTimeout(timer);
  }, [username, user?.uid]);

  if (loading || !user) {
    return (
      <div className="max-w-[1100px] mx-auto px-6 py-16">
        <div className="luxury-card rounded-2xl h-64 animate-pulse" />
      </div>
    );
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMessage(null);
    try {
      const refCode = sessionStorage.getItem('egorank_referral_code') || undefined;
      await saveUserProfile({
        uid: user.uid,
        username,
        displayName,
        avatarUrl,
        bio,
        websiteUrl,
        achievement,
        socialLinks: {
          x: xUrl.trim() || undefined,
          linkedin: linkedinUrl.trim() || undefined,
          instagram: instagramUrl.trim() || undefined,
        },
        referredByCode: refCode,
      });
      await refreshProfile();
      setSaveMessage({ type: 'ok', text: 'Your public profile has been saved and published.' });
    } catch (err) {
      setSaveMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to save profile.',
      });
    } finally {
      setSaving(false);
    }
  };

  const referralUrl = profile
    ? `${window.location.origin}/register?ref=${profile.referralCode}`
    : '';

  const copyReferral = async () => {
    if (!referralUrl) return;
    await navigator.clipboard.writeText(referralUrl);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-12 space-y-8">
      {/* Top Identity Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="flex items-center gap-4">
          <AvatarWithFallback
            src={profile?.avatarUrl || user.photoURL}
            name={profile?.displayName || user.email || 'Competitor'}
            sizeClass="w-14 h-14"
            highlightGold={Boolean(profile && profile.featuredTier !== 'none')}
          />
          <div>
            <h1 className="font-display text-2xl font-bold text-white">
              {profile ? profile.displayName : 'Complete Your Profile'}
            </h1>
            <p className="text-xs text-[#999999]">
              {user.email} · {profile ? TIER_LABELS[profile.featuredTier] : 'Handle unclaimed'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && (
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#D4AF37]/40 text-xs text-[#F5DE9B] hover:bg-[#D4AF37]/10 transition"
            >
              <Shield className="w-3.5 h-3.5" />
              Admin Console
            </Link>
          )}
          {profile && (
            <Link
              to={`/u/${profile.username}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/15 text-xs text-white hover:border-[#D4AF37]/50 transition"
            >
              Public Profile
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}
          <button
            type="button"
            onClick={() => void logout().then(() => navigate('/'))}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/10 text-xs text-[#999999] hover:text-white transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Email Verification Gate Banner */}
      {!user.emailVerified && (
        <div className="luxury-card-featured rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[#F5DE9B] flex items-center gap-2">
              <MailCheck className="w-4 h-4" />
              Verify Your Email Address to Publish
            </p>
            <p className="text-xs text-[#CCCCCC]">
              We sent a verification link to {user.email}. Click it, then refresh your status to unlock public profile creation and payments.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={async () => {
                await resendVerification();
                setVerificationSent(true);
              }}
              className="px-4 py-2 rounded-lg border border-[#D4AF37]/40 text-xs text-[#F5DE9B] cursor-pointer"
            >
              {verificationSent ? 'Sent!' : 'Resend Email'}
            </button>
            <button
              type="button"
              onClick={() => void refreshUser()}
              className="px-4 py-2 rounded-lg gold-gradient-bg text-[#080808] text-xs font-semibold cursor-pointer"
            >
              I Verified My Email
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Profile Editor */}
        <form onSubmit={handleSaveProfile} className="lg:col-span-7 luxury-card rounded-xl p-6 space-y-5">
          <h2 className="font-display text-xl text-white">Public Profile Settings</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-[#999999]">Unique Username</label>
              <input
                type="text"
                required
                pattern="^[a-zA-Z0-9_]{3,32}$"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="alex_mercer"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#0c0c0c] border border-white/12 text-sm text-white font-mono focus:outline-none focus:border-[#D4AF37]"
              />
              {username && (
                <p className="text-[11px] text-[#999999]">
                  {usernameAvailable === true && (
                    <span className="text-[#F5DE9B]">@{username.toLowerCase()} is available</span>
                  )}
                  {usernameAvailable === false && (
                    <span className="text-red-400">Handle unavailable or invalid format</span>
                  )}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-[#999999]">Display Name</label>
              <input
                type="text"
                required
                maxLength={80}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Alex Mercer"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#0c0c0c] border border-white/12 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-[#999999]">Confirmed Achievement Headline</label>
            <input
              type="text"
              maxLength={160}
              value={achievement}
              onChange={(e) => setAchievement(e.target.value)}
              placeholder="e.g. Founder at Apex Labs · 2x Design Award Winner"
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#0c0c0c] border border-white/12 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-[#999999]">Bio</label>
            <textarea
              rows={3}
              maxLength={400}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell the leaderboard what you build, lead, or dominate..."
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#0c0c0c] border border-white/12 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-[#999999]">Profile Image URL</label>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#0c0c0c] border border-white/12 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-[#999999]">Website URL</label>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://yourdomain.com"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#0c0c0c] border border-white/12 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-[#999999]">X / Twitter URL</label>
              <input
                type="url"
                value={xUrl}
                onChange={(e) => setXUrl(e.target.value)}
                placeholder="https://x.com/..."
                className="w-full px-3 py-2 rounded-lg bg-[#0c0c0c] border border-white/12 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-[#999999]">LinkedIn URL</label>
              <input
                type="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/..."
                className="w-full px-3 py-2 rounded-lg bg-[#0c0c0c] border border-white/12 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-[#999999]">Instagram URL</label>
              <input
                type="url"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                placeholder="https://instagram.com/..."
                className="w-full px-3 py-2 rounded-lg bg-[#0c0c0c] border border-white/12 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
          </div>

          {saveMessage && (
            <p
              className={`text-xs rounded-lg p-3 ${
                saveMessage.type === 'ok'
                  ? 'bg-[#D4AF37]/10 text-[#F5DE9B] border border-[#D4AF37]/30'
                  : 'bg-red-950/40 text-red-300 border border-red-800/40'
              }`}
            >
              {saveMessage.text}
            </p>
          )}

          <button
            type="submit"
            disabled={saving || !user.emailVerified}
            className="px-6 py-3 rounded-lg gold-gradient-bg text-[#080808] text-xs font-semibold tracking-wider uppercase hover:brightness-110 transition cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving Profile...' : profile ? 'Update Public Profile' : 'Publish Profile'}
          </button>
        </form>

        {/* Right: Featured Upgrade, Referrals, Badges, Notifications */}
        <div className="lg:col-span-5 space-y-6">
          {/* Featured Status */}
          <div className="luxury-card-featured rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg text-[#F5DE9B] flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Featured Placement
              </h3>
              <span className="text-xs text-white font-medium">
                {profile ? TIER_LABELS[profile.featuredTier] : 'Free Basic'}
              </span>
            </div>
            <p className="text-xs text-[#CCCCCC] leading-relaxed">
              {profile?.featuredExpiresAt
                ? `Active through ${new Date(profile.featuredExpiresAt).toLocaleDateString()}`
                : 'Elevate your profile to the Homepage & Global Leaderboard Spotlight via Cashfree (INR) or PayPal (USD).'}
            </p>
            <Link
              to="/checkout"
              className="block text-center py-2.5 rounded-lg gold-gradient-bg text-[#080808] text-xs font-semibold tracking-wider uppercase"
            >
              Upgrade Placement
            </Link>
          </div>

          {/* Referral System */}
          {profile && (
            <div className="luxury-card rounded-xl p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base text-white">Your Referral Link</h3>
                <span className="font-mono text-xs text-[#D4AF37] tabular-nums">
                  {referralCount} joined
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={referralUrl}
                  className="flex-1 px-3 py-2 rounded-lg bg-[#0c0c0c] border border-white/10 text-xs font-mono text-[#CCCCCC]"
                />
                <button
                  type="button"
                  onClick={copyReferral}
                  className="px-3 py-2 rounded-lg border border-[#D4AF37]/30 text-xs text-[#F5DE9B] hover:bg-[#D4AF37]/10 transition cursor-pointer inline-flex items-center gap-1"
                >
                  {copiedRef ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedRef ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          {/* Achievement Badges */}
          {profile && (
            <div className="luxury-card rounded-xl p-6 space-y-3">
              <h3 className="font-display text-base text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-[#D4AF37]" />
                Earned Badges
              </h3>
              <div className="flex flex-wrap gap-2">
                {profile.badges.map((b) => (
                  <span
                    key={b}
                    className="px-3 py-1.5 rounded-md border border-[#D4AF37]/25 bg-[#0c0c0c] text-xs text-[#F5DE9B]"
                  >
                    {b}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notifications */}
          <div className="luxury-card rounded-xl p-6 space-y-3">
            <h3 className="font-display text-base text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#D4AF37]" />
              Notifications
            </h3>
            {notifications.length === 0 ? (
              <p className="text-xs text-[#999999]">No alerts yet.</p>
            ) : (
              <div className="divide-y divide-white/8 max-h-60 overflow-y-auto">
                {notifications.map((n) => (
                  <div key={n.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium text-white">{n.title}</p>
                      <p className="text-xs text-[#999999]">{n.message}</p>
                    </div>
                    {!n.read && (
                      <button
                        type="button"
                        onClick={async () => {
                          await markNotificationRead(n.id);
                          await refreshProfile();
                        }}
                        className="text-[11px] text-[#D4AF37] hover:underline shrink-0 cursor-pointer"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment History */}
          <div className="luxury-card rounded-xl p-6 space-y-3">
            <h3 className="font-display text-base text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#D4AF37]" />
              Payment History
            </h3>
            {payments.length === 0 ? (
              <p className="text-xs text-[#999999]">No transactions recorded yet.</p>
            ) : (
              <div className="divide-y divide-white/8">
                {payments.map((pay) => (
                  <div key={pay.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="text-white uppercase font-mono">
                        {pay.provider} · {pay.package_type}
                      </p>
                      <p className="text-[#999999]">{pay.payment_status}</p>
                    </div>
                    <span className="font-mono text-[#F5DE9B] tabular-nums">
                      {formatMoney(pay.amount, pay.currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Champion Card Generator */}
      {profile && <ChampionCardCanvas profile={profile} />}
    </div>
  );
}
