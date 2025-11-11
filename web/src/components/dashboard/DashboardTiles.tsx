import React from 'react';
import { ArrowUpRight, ChevronRight, ShieldAlert } from 'lucide-react';
import type { DashboardSummary } from '../../hooks/useDashboardData';
import { formatCurrency, formatDate, formatPercent } from '../../lib/format';

type DashboardTilesProps = {
  subscriptions: DashboardSummary['subscriptions'];
  review: {
    uncategorized: number;
    lowConfidence: number;
  };
  dataQuality: {
    lastImport?: DashboardSummary['lastImport'];
    warningsCount: number;
    importsCount: number;
  };
  insights: Array<{ title: string; description: string }>;
  onOpenSubscriptions?: () => void;
  onOpenReview?: () => void;
  onOpenImports?: () => void;
};

export const DashboardTiles: React.FC<DashboardTilesProps> = ({
  subscriptions,
  review,
  dataQuality,
  insights,
  onOpenSubscriptions,
  onOpenReview,
  onOpenImports,
}) => {
  const topSubscriptions = subscriptions.slice(0, 5);

  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
      <TileCard
        title="Subscriptions & Verträge"
        actionLabel="Alle ansehen"
        onAction={onOpenSubscriptions}
      >
        {topSubscriptions.length === 0 ? (
          <EmptyHint text="Noch keine wiederkehrenden Buchungen erkannt." />
        ) : (
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            {topSubscriptions.map(sub => (
              <li key={`${sub.merchant}-${sub.lastDate}`} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{sub.merchant}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatCurrency(sub.averageAmount ?? (sub as any).amount ?? 0)} ·{' '}
                    {sub.intervalGuess === 'unknown' ? 'Intervall offen' : sub.intervalGuess}
                  </p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-300 dark:text-slate-600" />
              </li>
            ))}
          </ul>
        )}
      </TileCard>

      <TileCard
        title="Zu prüfen"
        actionLabel="Zur Review"
        onAction={onOpenReview}
      >
        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <ReviewRow label="Unkategorisiert" value={review.uncategorized} />
          <ReviewRow label="Niedrige Confidence" value={review.lowConfidence} />
        </div>
      </TileCard>

      <TileCard
        title="Datenqualität & Parser"
        actionLabel="Details"
        onAction={onOpenImports}
      >
        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
          {dataQuality.lastImport ? (
            <p>
              Letzter Upload:{' '}
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {dataQuality.lastImport.profileId}
              </span>
              <br />
              {formatDate(dataQuality.lastImport.importedAt)} ·{' '}
              {formatPercent(dataQuality.lastImport.confidence ?? 0)} ·{' '}
              {(dataQuality.lastImport.transactionCount ?? 0).toLocaleString('de-DE')} Buchungen
            </p>
          ) : (
            <p>Noch kein Upload erfolgt.</p>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {dataQuality.warningsCount > 0
              ? `${dataQuality.warningsCount} Parser-Hinweise offen`
              : 'Keine Parser-Hinweise erkannt'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Gesamtimporte: {dataQuality.importsCount.toLocaleString('de-DE')}
          </p>
        </div>
      </TileCard>

      <TileCard title="Insights">
        {insights.length === 0 ? (
          <EmptyHint text="Noch keine Insights verfügbar. Weitere Daten helfen uns bei Analysen." />
        ) : (
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            {insights.map((insight, index) => (
              <li key={`${insight.title}-${index}`}>
                <p className="font-medium text-slate-900 dark:text-slate-100">{insight.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{insight.description}</p>
              </li>
            ))}
          </ul>
        )}
      </TileCard>
    </div>
  );

};

function TileCard({
  title,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white/80 px-5 py-4 shadow-sm shadow-slate-500/10 dark:border-slate-800 dark:bg-slate-900/70">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        {actionLabel ? (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 transition hover:text-indigo-500 dark:text-indigo-200"
          >
            {actionLabel}
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
          </button>
        ) : null}
      </header>
      <div className="mt-3 flex-1">{children}</div>
    </section>
  );
}

function ReviewRow({ label, value }: { label: string; value: number }) {
  const tone =
    value > 0
      ? 'bg-amber-500/10 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200'
      : 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-200';

  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
      <span>{label}</span>
      <span className={`inline-flex min-w-[40px] justify-center rounded-full px-3 py-1 text-xs font-medium ${tone}`}>
        {value.toLocaleString('de-DE')}
      </span>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-6 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
      <span className="inline-flex items-center gap-2">
        <ShieldAlert className="h-4 w-4" aria-hidden="true" />
        {text}
      </span>
    </div>
  );
}


