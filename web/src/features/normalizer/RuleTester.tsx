import React, { useState } from 'react';
import { testNormalizer, type NormalizerResult } from '../../api/normalizer';

type RuleTesterProps = {
  onMatch?: (ruleId: string | null) => void;
};

export const RuleTester: React.FC<RuleTesterProps> = ({ onMatch }) => {
  const [text, setText] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NormalizerResult | null>(null);

  const handleTest = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Bitte gib mindestens eine Beschreibung ein.');
      setResult(null);
      onMatch?.(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await testNormalizer({
        text: trimmed,
        counterparty: counterparty.trim() || undefined,
      });
      if (!response.ok) {
        setResult(null);
        setError(response.error);
        onMatch?.(null);
        return;
      }
      setResult(response.data);
      onMatch?.(response.data.matchedRuleId ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setResult(null);
      onMatch?.(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white/60 p-6 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/60">
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Rule Tester</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Prüfe, welche Regel auf einen Beispieltext greifen würde.
        </p>
      </header>
      <div className="space-y-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="tester-text" className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Beschreibung / Verwendungszweck
          </label>
          <textarea
            id="tester-text"
            value={text}
            onChange={event => setText(event.currentTarget.value)}
            rows={3}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            placeholder="z. B. UBER BV F12345 Amsterdam NL"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label
            htmlFor="tester-counterparty"
            className="text-xs font-medium text-slate-500 dark:text-slate-400"
          >
            Gegenpartei (optional)
          </label>
          <input
            id="tester-counterparty"
            value={counterparty}
            onChange={event => setCounterparty(event.currentTarget.value)}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            placeholder="z. B. Uber BV"
          />
        </div>
        {error ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </div>
        ) : null}
        <button
          type="button"
          onClick={handleTest}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60"
        >
          {loading ? 'Prüfe…' : 'Test ausführen'}
        </button>
        <div className="rounded-lg border border-slate-200/70 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
          {result ? (
            <>
              <p>
                <span className="text-xs uppercase text-slate-400">Merchant</span>{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {result.merchant ?? '–'}
                </span>
              </p>
              <p className="mt-1">
                <span className="text-xs uppercase text-slate-400">Kategorie-Hinweis</span>{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {result.categoryHint ?? '–'}
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Regel-ID:{' '}
                {result.matchedRuleId ? (
                  <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-200">
                    {result.matchedRuleId}
                  </span>
                ) : (
                  '—'
                )}
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Noch keine Ergebnisse. Fülle die Felder aus und klicke auf „Test ausführen“.
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

export default RuleTester;


