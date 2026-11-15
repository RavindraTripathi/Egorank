import React, { useState } from 'react';
import { Crown } from 'lucide-react';

interface AvatarWithFallbackProps {
  src?: string | null;
  name: string;
  sizeClass?: string;
  highlightGold?: boolean;
}

export function AvatarWithFallback({
  src,
  name,
  sizeClass = 'w-12 h-12',
  highlightGold = false,
}: AvatarWithFallbackProps) {
  const [failed, setFailed] = useState(false);

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('') || 'ER';

  const borderClass = highlightGold
    ? 'border-[#D4AF37] shadow-[0_0_24px_rgba(212,175,55,0.28)]'
    : 'border-white/15';

  if (!src || failed) {
    return (
      <div
        className={`${sizeClass} rounded-full border ${borderClass} bg-gradient-to-br from-[#1f1b10] to-[#0e0e0e] flex items-center justify-center shrink-0 select-none`}
        aria-label={name}
      >
        {initials ? (
          <span className="font-display font-semibold text-sm tracking-wider text-[#F5DE9B]">
            {initials}
          </span>
        ) : (
          <Crown className="w-5 h-5 text-[#D4AF37]" />
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${name} portrait`}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${sizeClass} rounded-full object-cover border ${borderClass} shrink-0 bg-[#151515]`}
    />
  );
}
