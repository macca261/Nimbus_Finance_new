import React, { useState } from 'react';
import { Info } from 'lucide-react';

interface ExplanationTooltipProps {
  explanationText?: string;
  explanationCode?: string;
  isOther?: boolean;
  children: React.ReactNode;
}

export const ExplanationTooltip: React.FC<ExplanationTooltipProps> = ({
  explanationText,
  explanationCode,
  isOther = false,
  children,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!explanationText) {
    return <>{children}</>;
  }

  return (
    <div className="relative inline-flex items-center gap-1.5">
      {children}
      <button
        type="button"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        className="inline-flex items-center justify-center rounded-full p-0.5 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:text-slate-500 dark:hover:text-slate-300 dark:focus:ring-indigo-500/30"
        aria-label="Warum diese Kategorie?"
        title={explanationText}
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {showTooltip && (
        <div
          className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-800"
          role="tooltip"
        >
          <div className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
            Warum diese Kategorie?
          </div>
          <div className="text-slate-600 dark:text-slate-300">
            {explanationText}
          </div>
          {isOther && (
            <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 italic">
              Noch keine Regel oder Händler-Übereinstimmung vorhanden.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

