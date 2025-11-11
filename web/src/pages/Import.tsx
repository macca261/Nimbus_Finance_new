import React, { useState } from 'react';
import type { ImportSuccessPayload } from '../types/import';
import { formatCurrency, formatPercent } from '../lib/format';

export default function ImportPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportSuccessPayload | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/import', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Import failed');
      setResult(json as ImportSuccessPayload);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-3">CSV hochladen</h1>
      <input type="file" accept=".csv,text/csv" onChange={onChange} className="mb-3" />
      {busy && <p className="mt-3">Parsing…</p>}
      {error && <p className="mt-3 text-red-600">{error}</p>}
      {result && (
        <div className="mt-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Detected: <b>{result.profileId}</b> • Confidence:{' '}
            {formatPercent(result.confidence)} • Transactions erkannt: {result.transactionCount}{' '}
            {result.openingBalance !== undefined && (
              <>• Opening Balance: {formatCurrency(result.openingBalance)}</>
            )}{' '}
            {result.closingBalance !== undefined && (
              <>• Closing Balance: {formatCurrency(result.closingBalance)}</>
            )}
          </p>
          <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            <p>Neu importiert: {result.insertedCount ?? '—'}</p>
            <p>Duplikate: {result.duplicateCount ?? 0}</p>
            {result.warnings.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-amber-600">
                {result.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

