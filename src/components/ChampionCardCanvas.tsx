import React, { useState } from 'react';
import { Check, Copy, Download, Share2 } from 'lucide-react';
import { Profile, TIER_LABELS } from '../types/egorank';

interface ChampionCardCanvasProps {
  profile: Profile;
  rankLabel?: string;
}

export function ChampionCardCanvas({
  profile,
  rankLabel = '#1',
}: ChampionCardCanvasProps) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [igNotice, setIgNotice] = useState(false);

  const profileUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/u/${profile.username}`
      : `https://egorank.app/u/${profile.username}`;

  const tierLabel = TIER_LABELS[profile.featuredTier];
  const serverCardUrl = `/api/og/champion/${encodeURIComponent(
    profile.username
  )}?name=${encodeURIComponent(profile.displayName)}&achievement=${encodeURIComponent(
    profile.achievement || 'Global Competitor'
  )}&rank=${encodeURIComponent(rankLabel)}&tier=${encodeURIComponent(tierLabel)}`;

  const shareText = `Claiming ${rankLabel} on EgoRank — ${profile.displayName} (@${profile.username}). ${profile.achievement || 'Pay. Challenge. Dominate.'}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback ignored
    }
  };

  const handleDownloadPng = async () => {
    setDownloading(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 630;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Obsidian luxury backdrop
      const bgGrad = ctx.createLinearGradient(0, 0, 1200, 630);
      bgGrad.addColorStop(0, '#080808');
      bgGrad.addColorStop(0.55, '#131009');
      bgGrad.addColorStop(1, '#080808');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1200, 630);

      // Outer & inner frames
      ctx.fillStyle = '#151515';
      ctx.strokeStyle = '#D4AF37';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(36, 36, 1128, 558, 16);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = 'rgba(212, 175, 55, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(56, 56, 1088, 518, 10);
      ctx.stroke();

      // Header wordmark
      ctx.fillStyle = '#F5DE9B';
      ctx.font = '700 32px Georgia, serif';
      ctx.fillText('EGORANK', 96, 120);

      ctx.fillStyle = '#999999';
      ctx.font = '500 13px sans-serif';
      ctx.fillText('PAY. CHALLENGE. DOMINATE.', 96, 148);

      // Rank
      ctx.textAlign = 'right';
      ctx.fillStyle = '#D4AF37';
      ctx.font = '700 48px Georgia, serif';
      ctx.fillText(rankLabel, 1104, 126);
      ctx.textAlign = 'left';

      // Hairline divider
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.22)';
      ctx.beginPath();
      ctx.moveTo(96, 182);
      ctx.lineTo(1104, 182);
      ctx.stroke();

      // Crown glyph
      ctx.fillStyle = '#D4AF37';
      ctx.beginPath();
      ctx.moveTo(96, 260);
      ctx.lineTo(114, 224);
      ctx.lineTo(134, 248);
      ctx.lineTo(154, 214);
      ctx.lineTo(174, 248);
      ctx.lineTo(194, 224);
      ctx.lineTo(212, 260);
      ctx.lineTo(212, 274);
      ctx.lineTo(96, 274);
      ctx.closePath();
      ctx.fill();

      // Competitor identity
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 54px Georgia, serif';
      ctx.fillText(profile.displayName.slice(0, 32), 96, 350);

      ctx.fillStyle = '#D4AF37';
      ctx.font = '500 24px monospace';
      ctx.fillText(`@${profile.username}`, 96, 396);

      ctx.fillStyle = '#CCCCCC';
      ctx.font = '400 22px sans-serif';
      ctx.fillText(
        (profile.achievement || 'Global EgoRank Competitor').slice(0, 74),
        96,
        458
      );

      // Footer
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.18)';
      ctx.beginPath();
      ctx.moveTo(96, 508);
      ctx.lineTo(1104, 508);
      ctx.stroke();

      ctx.fillStyle = '#999999';
      ctx.font = '600 15px sans-serif';
      ctx.fillText(tierLabel.toUpperCase(), 96, 548);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#F5DE9B';
      ctx.font = '500 16px monospace';
      ctx.fillText(`egorank.app/u/${profile.username}`, 1104, 548);

      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `egorank-${profile.username}-card.png`;
      a.click();
    } finally {
      setDownloading(false);
    }
  };

  const handleInstagramWorkflow = async () => {
    await handleDownloadPng();
    setIgNotice(true);
    setTimeout(() => setIgNotice(false), 5000);
  };

  return (
    <div className="luxury-card rounded-xl p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-lg text-[#F5DE9B] tracking-wide">
            Official Champion Card
          </h3>
          <p className="text-xs text-[#999999] mt-1">
            Generated black-and-gold social asset ready for X, LinkedIn, WhatsApp, and Instagram.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDownloadPng}
          disabled={downloading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg gold-gradient-bg text-[#080808] text-xs font-semibold tracking-wide hover:brightness-110 transition whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
        >
          <Download className="w-3.5 h-3.5" />
          {downloading ? 'Rendering PNG...' : 'Download PNG Card'}
        </button>
      </div>

      {/* Live Preview of Server-Generated Card */}
      <div className="rounded-lg overflow-hidden border border-[#D4AF37]/25 bg-[#080808]">
        <img
          src={serverCardUrl}
          alt={`EgoRank Champion Card for ${profile.displayName}`}
          className="w-full h-auto block"
        />
      </div>

      {/* Social Sharing Actions */}
      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        <a
          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
            shareText
          )}&url=${encodeURIComponent(profileUrl)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-white/12 bg-[#0d0d0d] text-xs text-white hover:border-[#D4AF37]/50 hover:text-[#F5DE9B] transition whitespace-nowrap"
        >
          <Share2 className="w-3.5 h-3.5" />
          Share on X
        </a>

        <a
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
            profileUrl
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-white/12 bg-[#0d0d0d] text-xs text-white hover:border-[#D4AF37]/50 hover:text-[#F5DE9B] transition whitespace-nowrap"
        >
          <Share2 className="w-3.5 h-3.5" />
          LinkedIn
        </a>

        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${profileUrl}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-white/12 bg-[#0d0d0d] text-xs text-white hover:border-[#D4AF37]/50 hover:text-[#F5DE9B] transition whitespace-nowrap"
        >
          <Share2 className="w-3.5 h-3.5" />
          WhatsApp
        </a>

        <button
          type="button"
          onClick={handleInstagramWorkflow}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-white/12 bg-[#0d0d0d] text-xs text-white hover:border-[#D4AF37]/50 hover:text-[#F5DE9B] transition whitespace-nowrap cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          Instagram Story Card
        </button>

        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#D4AF37]/30 bg-[#18150d] text-xs text-[#F5DE9B] hover:bg-[#D4AF37]/15 transition whitespace-nowrap cursor-pointer ml-auto"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Link Copied' : 'Copy Profile Link'}
        </button>
      </div>

      {igNotice && (
        <p className="text-xs text-[#F5DE9B] bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg px-3 py-2">
          PNG downloaded. Upload the saved card image directly to your Instagram Post or Story and paste your copied profile URL in your link sticker.
        </p>
      )}
    </div>
  );
}
