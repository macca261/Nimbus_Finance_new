/**
 * HybridProgressBar Component
 * 
 * Visualizes "Hybrid Savings" progress by showing:
 * - Solid green: External savings (locked in, e.g., Trade Republic)
 * - Striped green: Virtual savings (liquid, in checking account)
 * - Grey: Remaining target
 * 
 * This component educates users that solid bars are safer and encourages
 * converting virtual savings to external savings.
 */

import React from 'react';

export interface HybridProgressBarProps {
  external: number; // External savings in cents
  virtual: number; // Virtual savings in cents
  target: number; // Target amount in cents
  className?: string;
}

export const HybridProgressBar: React.FC<HybridProgressBarProps> = ({
  external,
  virtual,
  target,
  className = '',
}) => {
  const extPct = target > 0 ? Math.min(100, (external / target) * 100) : 0;
  const virtPct = target > 0 ? Math.min(100, (virtual / target) * 100) : 0;
  const remainingPct = Math.max(0, 100 - extPct - virtPct);

  // Format amounts for display
  const formatCents = (cents: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Progress Bar */}
      <div className="w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full flex overflow-hidden relative">
        {/* External Savings (Solid Green) */}
        {extPct > 0 && (
          <div
            style={{ width: `${extPct}%` }}
            className="bg-green-700 dark:bg-green-600 h-full transition-all duration-300"
            title={`Extern: ${formatCents(external)}`}
          />
        )}

        {/* Virtual Savings (Striped Green) */}
        {virtPct > 0 && (
          <div
            style={{ width: `${virtPct}%` }}
            className="bg-green-400 dark:bg-green-500 h-full bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,.2)_25%,rgba(255,255,255,.2)_50%,transparent_50%,transparent_75%,rgba(255,255,255,.2)_75%,rgba(255,255,255,.2))] bg-[length:8px_8px] transition-all duration-300"
            title={`Virtuell: ${formatCents(virtual)}`}
          />
        )}

        {/* Remaining (Grey) */}
        {remainingPct > 0 && (
          <div
            style={{ width: `${remainingPct}%` }}
            className="bg-gray-300 dark:bg-gray-600 h-full transition-all duration-300"
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 text-xs text-gray-600 dark:text-gray-400">
        {external > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-green-700 dark:bg-green-600" />
            <span>Extern: {formatCents(external)}</span>
          </div>
        )}
        {virtual > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-green-400 dark:bg-green-500 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,.2)_25%,rgba(255,255,255,.2)_50%,transparent_50%,transparent_75%,rgba(255,255,255,.2)_75%,rgba(255,255,255,.2))] bg-[length:4px_4px]" />
            <span>Virtuell: {formatCents(virtual)}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="font-medium">
            {formatCents(external + virtual)} / {formatCents(target)}
          </span>
          <span className="text-gray-500">
            ({Math.round((extPct + virtPct))}%)
          </span>
        </div>
      </div>
    </div>
  );
};

