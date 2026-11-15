import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Crown, Trophy } from 'lucide-react';
import { AvatarWithFallback } from '../components/AvatarWithFallback';
import { usePageMeta } from '../components/Layout';
import { fetchChampionHistory } from '../lib/firestoreService';
import { ChampionHistoryRecord } from '../types/egorank';

export function HallOfFamePage() {
  usePageMeta(
    'Hall of Fame — EgoRank',
    'Permanent historical archive of EgoRank champions, winning dates, confirmed achievements, and reign durations.'
  );

  const [records, setRecords] = useState<ChampionHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchChampionHistory()
      .then((res) => {
        if (active) setRecords(res);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-12 space-y-10">
      <div className="space-y-2 max-w-2xl">
        <p className="text-xs tracking-[0.2em] text-[#D4AF37] uppercase">
          Immutable Legacy
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">
          The Hall of Fame
        </h1>
        <p className="text-sm text-[#999999] leading-relaxed">
          Every champion who claims the throne is permanently inscribed below. Historical reigns are never erased when leadership changes.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="luxury-card rounded-xl h-44 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {records.map((rec, index) => {
            const isActive = !rec.endedAt;
            return (
              <div
                key={rec.id}
                className={`${
                  isActive ? 'luxury-card-featured' : 'luxury-card'
                } rounded-xl p-6 space-y-5`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <AvatarWithFallback
                      src={rec.avatarUrl}
                      name={rec.displayName}
                      sizeClass="w-14 h-14"
                      highlightGold={isActive}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs text-[#D4AF37]">
                        {isActive ? (
                          <Crown className="w-3.5 h-3.5" />
                        ) : (
                          <Trophy className="w-3.5 h-3.5" />
                        )}
                        <span>{isActive ? 'Reigning Champion' : `Inductee #${records.length - index}`}</span>
                        {rec.isDemo && <span className="text-[#999999]">· Demo</span>}
                      </div>
                      <h2 className="font-display text-xl text-white truncate mt-0.5">
                        {rec.displayName}
                      </h2>
                      <Link
                        to={`/u/${rec.username}`}
                        className="font-mono text-xs text-[#D4AF37] hover:underline"
                      >
                        @{rec.username}
                      </Link>
                    </div>
                  </div>

                  <span className="font-mono text-sm text-[#F5DE9B] tabular-nums shrink-0">
                    ${(rec.winningPriceCents / 100).toFixed(0)}
                  </span>
                </div>

                <p className="text-sm text-[#CCCCCC] leading-relaxed">
                  {rec.achievement}
                </p>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10 text-xs">
                  <div>
                    <p className="text-[#999999]">Crowned Date</p>
                    <p className="font-mono text-white tabular-nums mt-0.5">
                      {new Date(rec.startedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#999999] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#D4AF37]" />
                      Time at Top
                    </p>
                    <p className="font-mono text-[#F5DE9B] tabular-nums mt-0.5">
                      {rec.durationLabel || (isActive ? 'Ongoing' : 'Recorded')}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
