import React from 'react';
import { AppShell } from '../layout/AppShell';
import { CsvUploadArea } from '../components/upload/CsvUploadArea';
import { useImportHistory } from '../hooks/useImportHistory';
import { formatDate, formatPercent } from '../lib/format';

export const ImportsPage: React.FC = () => {
  const { entries, loading, error, refetch } = useImportHistory();

  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Daten & Uploads</h1>
          <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            Lade Kontoauszüge im CSV-Format hoch, überprüfe Parser-Details und verwalte deine Import-Historie. Die
            Nimbus-Parser unterstützen bereits deutsche Banken (Sparkasse, ING, comdirect, DKB), PayPal sowie weitere
            Provider.
          </p>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-xl shadow-indigo-500/5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 sm:p-8">
          <CsvUploadArea variant="full" onImported={refetch} />
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white/80 shadow-lg shadow-slate-500/5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
          <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Upload-Historie</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Neueste CSV-Uploads mit automatisch erkannten Profilen und Parser-Hinweisen.
              </p>
            </div>
          </header>
          <div className="max-h-[480px] overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left">
                    Zeitstempel
                  </th>
                  <th scope="col" className="px-6 py-3 text-left">
                    Profil
                  </th>
                  <th scope="col" className="px-6 py-3 text-left">
                    Confidence
                  </th>
                  <th scope="col" className="px-6 py-3 text-left">
                    Buchungen
                  </th>
                  <th scope="col" className="px-6 py-3 text-left">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left">
                    Hinweise
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white/60 dark:divide-slate-800 dark:bg-slate-900/40">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                      Lade Upload-Historie…
                    </td>
                  </tr>
                ) : entries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                      Noch keine Uploads durchgeführt.
                    </td>
                  </tr>
                ) : (
                  entries.map(entry => (
                    <tr key={entry.id ?? entry.importedAt}>
                      <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-300">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {formatDate(entry.importedAt)}
                        </div>
                        {entry.fileName ? (
                          <div className="text-xs text-slate-500 dark:text-slate-400">{entry.fileName}</div>
                        ) : null}
                      </td>
                      <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-300">{entry.profileId}</td>
                      <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-300">
                        {entry.confidence != null ? formatPercent(entry.confidence) : '—'}
                      </td>
                      <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-300">
                        {entry.rowsImported != null ? entry.rowsImported.toLocaleString('de-DE') : '—'}
                      </td>
                      <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-300">
                        <StatusBadge status={entry.status ?? 'success'} />
                      </td>
                      <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-300">
                        {entry.warnings && entry.warnings.length ? (
                          <ul className="space-y-1 text-xs text-amber-600 dark:text-amber-300">
                            {entry.warnings.slice(0, 3).map((warning, idx) => (
                              <li key={idx}>{warning}</li>
                            ))}
                            {entry.warnings.length > 3 ? <li>…</li> : null}
                          </ul>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-500">Keine Hinweise</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {error ? (
            <div className="border-t border-slate-200 px-6 py-4 text-xs text-rose-600 dark:border-slate-800 dark:text-rose-300">
              {error}
            </div>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
};

type StatusBadgeProps = {
  status: 'success' | 'warning' | 'error';
};

function StatusBadge({ status }: StatusBadgeProps) {
  const tone =
    status === 'error'
      ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200'
      : status === 'warning'
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200'
      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200';

  const label = {
    success: 'Erfolgreich',
    warning: 'Mit Hinweisen',
    error: 'Fehlgeschlagen',
  }[status];

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${tone}`}>{label}</span>
  );
}

export default ImportsPage;


