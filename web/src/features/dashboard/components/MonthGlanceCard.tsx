import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, RefreshCw, ArrowRight, AlertCircle } from 'lucide-react';
import type { MonthSummary, MonthNarrative } from '../../../hooks/useMonthSummary';
import { formatCurrency } from '../../../lib/format';

interface MonthGlanceCardProps {
  summary: MonthSummary | null;
  narrative: MonthNarrative | null;
  isLoading: boolean;
  error?: Error | null;
  onRefresh?: () => void;
}

export const MonthGlanceCard: React.FC<MonthGlanceCardProps> = ({
  summary,
  narrative,
  isLoading,
  error,
  onRefresh,
}) => {
  const navigate = useNavigate();

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm p-5 sm:p-6 lg:p-7 shadow-elevated">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-nf-primary flex-shrink-0" />
          <h3 className="text-base font-semibold text-nf-text-main">Monat auf einen Blick</h3>
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-nf-bg-card-subtle rounded animate-pulse" />
          <div className="h-4 bg-nf-bg-card-subtle rounded animate-pulse w-3/4" />
          <div className="h-4 bg-nf-bg-card-subtle rounded animate-pulse w-2/3" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-3xl border border-nf-negative/30 bg-nf-negative/10 backdrop-blur-sm p-5 sm:p-6 lg:p-7 shadow-elevated">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-nf-negative flex-shrink-0" />
            <h3 className="text-base font-semibold text-nf-text-main">Monat auf einen Blick</h3>
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="p-1.5 rounded-full text-nf-text-muted hover:text-nf-text-main hover:bg-nf-bg-card-subtle transition-colors"
              title="Erneut versuchen"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="py-6 text-center">
          <AlertCircle className="h-8 w-8 text-nf-negative mx-auto mb-2" />
          <p className="text-sm text-nf-negative">
            Zusammenfassung gerade nicht verfügbar.
          </p>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="mt-3 px-4 py-2 text-sm font-medium text-nf-primary hover:text-nf-primary-hover bg-nf-bg-card-subtle rounded-lg transition-colors"
            >
              Erneut versuchen
            </button>
          )}
        </div>
      </div>
    );
  }

  // Empty state (no data)
  if (!summary || (summary.incomeCents === 0 && summary.expenseCents === 0)) {
    return (
      <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm p-5 sm:p-6 lg:p-7 shadow-elevated">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-nf-primary flex-shrink-0" />
          <h3 className="text-base font-semibold text-nf-text-main">Monat auf einen Blick</h3>
        </div>
        <div className="py-6 text-center">
          <p className="text-sm text-nf-text-muted">
            Noch keine Buchungen für diesen Monat – importiere Daten, um deinen Überblick zu sehen.
          </p>
        </div>
      </div>
    );
  }

  // Format numbers
  const income = formatCurrency(summary.incomeCents / 100);
  const expenses = formatCurrency(summary.expenseCents / 100);
  const net = formatCurrency(Math.abs(summary.netCents) / 100);
  const netSign = summary.netCents >= 0 ? '+' : '';

  // Get bullets (from narrative or empty)
  const bullets = narrative?.bullets || [];

  return (
    <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card backdrop-blur-sm p-5 sm:p-6 lg:p-7 shadow-elevated transition-all duration-200 ease-out hover:-translate-y-[1px] hover:shadow-xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-nf-primary flex-shrink-0" />
          <h3 className="text-base font-semibold text-nf-text-main">Monat auf einen Blick</h3>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="p-1.5 rounded-full text-nf-text-muted hover:text-nf-text-main hover:bg-nf-bg-card-subtle transition-colors"
            title="Aktualisieren"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Key numbers */}
      <div className="mb-4 pb-4 border-b border-nf-border-subtle">
        <p className="text-sm text-nf-text-main">
          Einnahmen {income}, Ausgaben {expenses}, Netto {netSign}{net}
        </p>
      </div>

      {/* Bullet list */}
      {bullets.length > 0 ? (
        <ul className="space-y-2 mb-4">
          {bullets.map((bullet, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-nf-text-muted">
              <span className="text-nf-primary mt-1.5 flex-shrink-0">•</span>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mb-4">
          <p className="text-sm text-nf-text-muted italic">
            Keine Zusammenfassung verfügbar.
          </p>
        </div>
      )}

      {/* CTA buttons */}
      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-nf-border-subtle">
        <button
          type="button"
          onClick={() => navigate('/review')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-nf-text-muted hover:text-nf-text-main hover:bg-nf-bg-card-subtle rounded-lg transition-colors"
        >
          Sonstiges aufräumen
          <ArrowRight className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => navigate('/budgets')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-nf-text-muted hover:text-nf-text-main hover:bg-nf-bg-card-subtle rounded-lg transition-colors"
        >
          Zu Budgets & Ziele
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};

