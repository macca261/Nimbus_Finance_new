import { useEffect, useState } from 'react';
import { fetchReviewTransactions, fetchCategories, ReviewTransaction, CategoryMeta } from '../api/reviewApi';
import { AlertCircle } from 'lucide-react';
import { AppShell } from '../layout/AppShell';
import { useMemo } from 'react';
import CategoryControl from '../components/CategoryControl';

interface CategoryIndex {
  [id: string]: CategoryMeta;
}

export default function ReviewPage() {
  const [transactions, setTransactions] = useState<ReviewTransaction[]>([]);
  const [categories, setCategories] = useState<CategoryIndex>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [txs, cats] = await Promise.all([
          fetchReviewTransactions(),
          fetchCategories(),
        ]);

        if (cancelled) return;

        const index: CategoryIndex = {};
        for (const c of cats) {
          index[c.id] = c;
        }

        setTransactions(txs);
        setCategories(index);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? 'Unbekannter Fehler');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Categorization quality panel data
  const [quality, setQuality] = useState<{
    otherSharePct: number;
    transfersCount: number;
    refundsCount: number;
    reimbursementsCount: number;
    passThroughCount: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadQuality() {
      try {
        // Month from backend default
        const [catsRes, itRes, recentRes] = await Promise.all([
          fetch('/api/summary/categories'),
          fetch('/api/summary/internal-transfers'),
          fetch('/api/transactions/recent?limit=500'),
        ]);
        const catsJson = await catsRes.json();
        const itJson = await itRes.json();
        const recentJson = await recentRes.json();

        // Compute "other" share from categories
        const catRows: Array<{ category: string; rawExpenseCents: number }> = catsJson?.data ?? [];
        const otherRows = catRows.filter((r) => r.category === 'other' || r.category === 'other_review');
        const otherSum = otherRows.reduce((acc, r) => acc + (r.rawExpenseCents || 0), 0);
        const totalExpense = catRows.reduce((acc, r) => acc + (r.category?.startsWith('income_') ? 0 : (r.rawExpenseCents || 0)), 0);
        const otherSharePct = totalExpense > 0 ? (otherSum / totalExpense) * 100 : 0;

        // Transfers count (outgoing transfers sum across kinds)
        const transfersCount = Math.round(
          ((itJson?.totals?.savingsOutCents ?? 0) +
            (itJson?.totals?.walletOutCents ?? 0) +
            (itJson?.totals?.otherOutCents ?? 0)) / 100
        );

        // Approximate counts from recent (best-effort without dedicated endpoints)
        const rec: any[] = recentJson?.transactions ?? [];
        const refundsCount = rec.filter((r) => r.isRefund || r.isRefunded).length;
        const reimbursementsCount = rec.filter((r) => r.isReimbursement).length;
        const passThroughCount = rec.filter((r) => r.isPassThrough).length;

        if (!cancelled) {
          setQuality({
            otherSharePct,
            transfersCount,
            refundsCount,
            reimbursementsCount,
            passThroughCount,
          });
        }
      } catch {
        if (!cancelled) setQuality(null);
      }
    }
    void loadQuality();
    return () => {
      cancelled = true;
    };
  }, []);

  const content = (() => {
    if (loading) {
      return (
        <div className="flex flex-col gap-8">
          <header className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Überprüfung</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Lade verdächtige Buchungen…</p>
          </header>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col gap-8">
          <header className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Überprüfung</h1>
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </header>
        </div>
      );
    }

    if (transactions.length === 0) {
      return (
        <div className="flex flex-col gap-8">
          <header className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Überprüfung</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Keine Buchungen zur Überprüfung – sehr gut! ✨
            </p>
          </header>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Überprüfung</h1>
          <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            Zeigt Buchungen mit unsicherer Kategorie oder geringer Trefferquote.
          </p>
        </header>

        {/* Quality Panel */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-600 dark:text-slate-300">Datenqualität & Kategorien</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">
                {quality ? `${quality.otherSharePct.toFixed(1)} % deiner Ausgaben sind 'Sonstiges'` : '—'}
              </div>
              {quality && quality.otherSharePct > 10 && (
                <span className="mt-2 inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                  Aufräumen empfohlen
                </span>
              )}
              <div className="mt-3">
                <a
                  href="/review/sonstiges"
                  className="inline-flex items-center rounded-full bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus:ring-indigo-500/40"
                >
                  Sonstiges bereinigen
                </a>
              </div>
            </div>
            <div className="flex-1">
              <ul className="grid grid-cols-1 gap-2 text-sm text-slate-700 dark:text-slate-300">
                <li className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                  <span>Interne Transfers erkannt</span>
                  <span className="font-semibold">{quality ? quality.transfersCount.toLocaleString('de-DE') : '—'}</span>
                </li>
                <li className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                  <span>Rückerstattungen</span>
                  <span className="font-semibold">{quality ? quality.refundsCount.toLocaleString('de-DE') : '—'}</span>
                </li>
                <li className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                  <span>Durchlaufende Posten</span>
                  <span className="font-semibold">{quality ? quality.passThroughCount.toLocaleString('de-DE') : '—'}</span>
                </li>
                <li className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                  <span>Erstattete Ausgaben</span>
                  <span className="font-semibold">
                    {quality ? quality.reimbursementsCount.toLocaleString('de-DE') : '—'}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white/80 shadow-lg shadow-slate-500/5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50">
              <tr className="text-left">
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Datum</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Beschreibung</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Kategorie</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Quelle</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Sicherheit</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Warum?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {transactions.map(tx => {
                const cat = tx.category ? categories[tx.category] : undefined;
                const label =
                  cat?.labelDe ??
                  (tx.category ?? 'Unkategorisiert');

                const source = tx.categorySource ?? 'unbekannt';
                const confidence = tx.categoryConfidence ?? 0;
                const isLow = confidence < 0.4;
                const isMedium = confidence >= 0.4 && confidence < 0.8;
                const isHigh = confidence >= 0.8;

                return (
                  <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 align-top whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                      {tx.bookingDate}
                    </td>
                    <td className="px-6 py-4 align-top">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-50 line-clamp-2">
                        {tx.categoryExplanation?.merchantName ?? tx.rawText}
                      </div>
                      {tx.categoryExplanation?.matchedText && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-1">
                          {tx.categoryExplanation.matchedText}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 align-top">
                      <CategoryControl
                        id={tx.id}
                        fingerprintInput={{
                          bookingDate: tx.bookingDate,
                          valueDate: tx.bookingDate,
                          amountCents: tx.amountCents,
                          currency: tx.currency,
                          purpose: tx.rawText,
                          counterpartName: tx.categoryExplanation?.merchantName ?? null,
                          accountIban: null,
                        }}
                        category={tx.category}
                        categorySource={tx.categorySource}
                        rawText={tx.rawText}
                        merchant={tx.categoryExplanation?.merchantName ?? null}
                        onApplied={(_resolvedId, next) => {
                          // Update local state to reflect the change
                          setTransactions(prev =>
                            prev.map(t =>
                              t.id === tx.id ? { ...t, category: next, categorySource: 'user' } : t
                            )
                          );
                        }}
                      />
                    </td>
                    <td className="px-6 py-4 align-top">
                      <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-600 dark:text-slate-300">
                        {source === 'rule' && 'Regel'}
                        {source === 'user' && 'Manuell'}
                        {source === 'ml' && 'ML'}
                        {source === 'fallback' && 'Fallback'}
                        {source === 'unknown' && 'Unbekannt'}
                        {!['rule','user','ml','fallback','unknown'].includes(source) && source}
                      </span>
                    </td>
                    <td className="px-6 py-4 align-top">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div
                            className={[
                              'h-full transition-all',
                              isLow ? 'bg-red-400 dark:bg-red-500' : isMedium ? 'bg-yellow-400 dark:bg-yellow-500' : 'bg-green-400 dark:bg-green-500',
                            ].join(' ')}
                            style={{ width: `${Math.round(confidence * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {Math.round(confidence * 100)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top">
                      <WhyButton tx={tx} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
      </div>
    </div>
    );
  })();

  return <AppShell>{content}</AppShell>;
}

function WhyButton({ tx }: { tx: ReviewTransaction }) {
  const explanation = tx.categoryExplanation;
  if (!explanation) {
    return (
      <span className="text-xs text-slate-400 dark:text-slate-500 italic">
        Keine Details
      </span>
    );
  }

  return (
    <details className="group">
      <summary className="cursor-pointer text-xs text-indigo-600 dark:text-indigo-400 hover:underline list-none">
        Warum?
      </summary>
      <div className="mt-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 shadow-sm max-w-xs">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
          Regel
        </div>
        <div className="text-xs text-slate-800 dark:text-slate-200 mb-1">
          <span className="font-mono text-[11px] bg-slate-50 dark:bg-slate-900 px-1 py-0.5 rounded">
            {explanation.ruleId}
          </span>
        </div>
        {explanation.matchedText && (
          <div className="text-[11px] text-slate-600 dark:text-slate-300">
            <span className="font-semibold">Fundstelle:&nbsp;</span>
            {explanation.matchedText}
          </div>
        )}
      </div>
    </details>
  );
}
