import React, { useEffect, useState } from 'react';
import { testNormalizer, type NormalizerResult } from '../../api/normalizer';

type PreviewCardProps = {
  text: string;
  counterparty?: string | null;
  amountCents: number;
  currency: string;
  bookingDate: string;
};

export const PreviewCard: React.FC<PreviewCardProps> = ({
  text,
  counterparty,
  amountCents,
  currency,
  bookingDate,
}) => {
  const [result, setResult] = useState<NormalizerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await testNormalizer({
        text,
        counterparty: counterparty ?? undefined,
      });
      if (!response.ok) {
        setError(response.error);
        setResult(null);
        return;
      }
      setResult(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void runPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, counterparty, amountCents, currency, bookingDate]);

  let amount: string;
  try {
    amount = new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(amountCents / 100);
  } catch {
    amount = `${(amountCents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
  const date = new Date(bookingDate);
  const dateLabel = Number.isNaN(date.getTime()) ? bookingDate : date.toLocaleDateString('de-DE');

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white/60 p-6 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/60">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Live Preview
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Beispielhafter Umsatz und das Normalizer-Ergebnis.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runPreview()}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/70"
        >
          Aktualisieren
        </button>
      </header>

        <div className="grid gap-4 rounded-xl border border-slate-200/70 bg-slate-50/80 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
        <div>
          <p className="text-xs uppercase text-slate-400 dark:text-slate-500">Vorher</p>
          <p className="mt-1 font-medium text-slate-700 dark:text-slate-200">{text}</p>
          {counterparty ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">Gegenpartei: {counterparty}</p>
          ) : null}
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {amount} · {dateLabel}
          </p>
        </div>
          <div aria-live="polite">
          <p className="text-xs uppercase text-slate-400 dark:text-slate-500">Nachher</p>
          {error ? (
              <p className="mt-1 text-xs text-rose-500 dark:text-rose-300" role="alert">
                {error}
              </p>
          ) : loading ? (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Lade Vorschau …</p>
          ) : (
            <>
              <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                {result?.merchant ?? '–'}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Kategorie-Hinweis:{' '}
                {result?.categoryHint ? (
                  <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-200">
                    {result.categoryHint}
                  </span>
                ) : (
                  '—'
                )}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Regel-ID: {result?.matchedRuleId ?? '—'}
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default PreviewCard;


