/**
 * MoneyHealthCard Component
 * 
 * Displays a money health score based on the last 90 days of financial activity.
 */

import React from 'react';

interface MoneyHealthCardProps {
  score?: number; // 0-100 health score
}

export const MoneyHealthCard: React.FC<MoneyHealthCardProps> = ({ score = 82 }) => {
  return (
    <div className="mb-4">
      <p className="text-[11px] uppercase tracking-wide text-nf-text-muted mb-1">
        Money Health
      </p>
      <p className="text-[10px] text-nf-text-soft">
        Letzte 90 Tage
      </p>
      <div className="relative h-20 w-20 mx-auto mb-3">
        <svg className="absolute inset-0 -rotate-90 transform" viewBox="0 0 80 80">
          <circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-nf-border-subtle"
          />
          <circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeDasharray={`${2 * Math.PI * 36}`}
            strokeDashoffset={`${2 * Math.PI * 36 * (1 - score / 100)}`}
            strokeLinecap="round"
            className="text-nf-positive transition-all duration-1000 ease-out"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center tabular-nums text-lg font-bold text-nf-positive">
          {score}%
        </span>
      </div>
      <p className="text-center text-xs text-nf-text-muted">
        Basierend auf deinen letzten 90 Tagen.
      </p>
    </div>
  );
};

