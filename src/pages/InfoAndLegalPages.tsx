import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Send } from 'lucide-react';
import { usePageMeta } from '../components/Layout';

export function AboutPage() {
  usePageMeta('About EgoRank — Pay. Challenge. Dominate.', 'Learn about EgoRank, our competitive ranking model, and regional payment transparency.');
  return (
    <div className="max-w-[900px] mx-auto px-6 py-14 space-y-8">
      <div className="space-y-3">
        <p className="text-xs tracking-[0.2em] text-[#D4AF37] uppercase">About EgoRank</p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">
          Built for Measurable Digital Prestige
        </h1>
        <p className="text-base text-[#CCCCCC] leading-relaxed">
          EgoRank is a global competition platform where founders, creators, and strategists publish verified public dossiers, earn featured spotlight placements, and preserve their milestones inside an immutable Hall of Fame.
        </p>
      </div>

      <div className="luxury-card rounded-xl p-6 space-y-4 text-sm text-[#999999] leading-relaxed">
        <h2 className="font-display text-lg text-[#F5DE9B]">
          Transparent Commercial Architecture
        </h2>
        <p>
          EgoRank operates with clear, fixed-price featured placements (7-day Featured, 30-day Premium, and Sponsored Placements). Customers in India settle in INR via Cashfree (UPI &amp; domestic cards), while international customers settle in USD via PayPal Checkout.
        </p>
        <p>
          Our original escalating $1 challenge mechanic is maintained in a dedicated Sandbox Simulator on the Leaderboard so users and reviewers can inspect atomic concurrency without real-money risk. Live escalating charges will never be activated without explicit written provider approval.
        </p>
      </div>

      <div className="flex gap-4">
        <Link
          to="/leaderboard"
          className="px-5 py-2.5 rounded-lg gold-gradient-bg text-[#080808] text-xs font-semibold uppercase tracking-wider"
        >
          Explore Leaderboard
        </Link>
        <Link
          to="/contact"
          className="px-5 py-2.5 rounded-lg border border-white/15 text-xs text-white"
        >
          Contact Concierge
        </Link>
      </div>
    </div>
  );
}

export function ContactPage() {
  usePageMeta('Contact EgoRank — Concierge & Support', 'Reach the EgoRank support and compliance team for inquiries, sponsored placements, or account assistance.');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed.');
      setFeedback({ type: 'ok', text: data.message });
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to send message.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-[680px] mx-auto px-6 py-14 space-y-8">
      <div className="space-y-2">
        <p className="text-xs tracking-[0.2em] text-[#D4AF37] uppercase flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5" />
          Concierge Desk
        </p>
        <h1 className="font-display text-3xl font-bold text-white">Contact EgoRank</h1>
        <p className="text-sm text-[#999999]">
          Questions regarding featured placements, billing reconciliation, or account moderation? Send a direct inquiry below.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="luxury-card rounded-2xl p-8 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-[#999999]">Your Name</label>
            <input
              type="text"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#0c0c0c] border border-white/12 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-[#999999]">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#0c0c0c] border border-white/12 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-[#999999]">Subject</label>
          <input
            type="text"
            required
            minLength={3}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg bg-[#0c0c0c] border border-white/12 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-[#999999]">Message</label>
          <textarea
            required
            minLength={10}
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg bg-[#0c0c0c] border border-white/12 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
          />
        </div>

        {feedback && (
          <p
            className={`text-xs rounded-lg p-3 ${
              feedback.type === 'ok'
                ? 'bg-[#D4AF37]/10 text-[#F5DE9B] border border-[#D4AF37]/30'
                : 'bg-red-950/40 text-red-300 border border-red-800/40'
            }`}
          >
            {feedback.text}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg gold-gradient-bg text-[#080808] text-xs font-semibold uppercase tracking-wider cursor-pointer disabled:opacity-60"
        >
          <Send className="w-3.5 h-3.5" />
          {submitting ? 'Sending...' : 'Send Inquiry'}
        </button>
      </form>
    </div>
  );
}

export function PrivacyPage() {
  usePageMeta('Privacy Policy — EgoRank', 'How EgoRank protects user accounts, public profile data, and payment identifiers.');
  return (
    <div className="max-w-[840px] mx-auto px-6 py-14 space-y-6 text-sm text-[#CCCCCC] leading-relaxed">
      <h1 className="font-display text-3xl font-bold text-white">Privacy Policy</h1>
      <p className="text-xs text-[#999999]">Effective Date: November 15, 2026</p>
      <div className="luxury-card rounded-xl p-6 space-y-4">
        <p>
          EgoRank collects only the information necessary to authenticate your account, publish your chosen public profile details (username, display name, bio, avatar, links, and achievement), and process featured placement orders.
        </p>
        <p>
          We never store raw payment card numbers or UPI credentials on EgoRank servers. All payment instruments are handled directly by Cashfree (India · INR) or PayPal (International · USD). We store only order IDs, transaction IDs, currency, and fulfillment status for verification and reconciliation.
        </p>
        <p>
          You may update or remove your profile details anytime from your Competitor Dashboard or request account deletion via our Contact page.
        </p>
      </div>
    </div>
  );
}

export function TermsPage() {
  usePageMeta('Terms & Conditions — EgoRank', 'Rules governing EgoRank profiles, featured placements, and community conduct.');
  return (
    <div className="max-w-[840px] mx-auto px-6 py-14 space-y-6 text-sm text-[#CCCCCC] leading-relaxed">
      <h1 className="font-display text-3xl font-bold text-white">Terms &amp; Conditions</h1>
      <p className="text-xs text-[#999999]">Effective Date: November 15, 2026</p>
      <div className="luxury-card rounded-xl p-6 space-y-4">
        <p>
          By creating an account on EgoRank, you agree to provide accurate public profile information and refrain from impersonation, unlawful content, or automated abuse.
        </p>
        <p>
          Featured placement packages grant fixed-duration visibility (7 days or 30 days) on the EgoRank Leaderboard and Homepage. Placement activation occurs exclusively upon server-side verification of payment webhooks.
        </p>
        <p>
          EgoRank administrators reserve the right to suspend accounts or revoke featured placements in cases of verified abuse, fraud, or policy violations.
        </p>
      </div>
    </div>
  );
}

export function RefundPage() {
  usePageMeta('Refund Policy — EgoRank', 'EgoRank refund eligibility and dispute resolution policy for Cashfree and PayPal orders.');
  return (
    <div className="max-w-[840px] mx-auto px-6 py-14 space-y-6 text-sm text-[#CCCCCC] leading-relaxed">
      <h1 className="font-display text-3xl font-bold text-white">Refund Policy</h1>
      <p className="text-xs text-[#999999]">Effective Date: November 15, 2026</p>
      <div className="luxury-card rounded-xl p-6 space-y-4">
        <p>
          If a technical error prevents your featured placement from activating after a confirmed Cashfree (INR) or PayPal (USD) payment, contact our concierge within 7 days with your Order ID for immediate fulfillment or a full refund.
        </p>
        <p>
          Duplicate charges or unauthorized transactions verified through provider records are refunded in full back to the original payment method. Approved refunds automatically revert active featured placement status.
        </p>
      </div>
    </div>
  );
}
