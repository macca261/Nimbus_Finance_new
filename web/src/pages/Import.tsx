import React, { useState } from "react";
import AppLayout from "../components/layout/AppLayout";

export default function ImportPage() {
  const [preview, setPreview] = useState<any>(null);
  const [bank, setBank] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setError(null);
    setPreview(null);

    try {
      const data = new FormData();
      data.append('file', file);
      const qs = bank ? `?bank=${encodeURIComponent(bank)}` : '';
      const res = await fetch(`/api/import${qs}`, { method: 'POST', body: data });
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error || 'Import failed');

      setPreview(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4 text-zinc-900 dark:text-zinc-100">Bank CSV Import (DE)</h1>
        <div className="mb-3 flex gap-3 items-end">
          <div>
            <label className="block mb-1 text-sm text-zinc-700 dark:text-zinc-300">Optional Bank-Override</label>
            <select
              className="border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
              value={bank}
              onChange={e => setBank(e.target.value)}
            >
              <option value="">Auto-detect</option>
              <option value="deutsche-bank">Deutsche Bank</option>
              <option value="commerzbank">Commerzbank</option>
              <option value="ing">ING</option>
              <option value="postbank">Postbank</option>
            </select>
          </div>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={onUpload}
            className="px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
          />
        </div>

        {busy && <p className="mt-3 text-zinc-600 dark:text-zinc-400">Parsing…</p>}
        {error && <p className="mt-3 text-red-600 dark:text-red-400">{error}</p>}

        {preview && (
          <div className="mt-6">
            <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
              Detected bank: <b>{preview.bank}</b> • Rows: <b>{preview.count}</b>
            </p>
            <div className="overflow-auto border border-zinc-200 dark:border-zinc-800 rounded">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-zinc-100 dark:bg-zinc-800">
                    <th className="text-left p-2 text-zinc-700 dark:text-zinc-300">Datum</th>
                    <th className="text-left p-2 text-zinc-700 dark:text-zinc-300">Betrag</th>
                    <th className="text-left p-2 text-zinc-700 dark:text-zinc-300">Währung</th>
                    <th className="text-left p-2 text-zinc-700 dark:text-zinc-300">Verwendungszweck</th>
                    <th className="text-left p-2 text-zinc-700 dark:text-zinc-300">Gegenpartei</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.transactions.slice(0, 50).map((t: any, i: number) => (
                    <tr key={i} className="odd:bg-white even:bg-zinc-50 dark:odd:bg-zinc-900 dark:even:bg-zinc-800/50">
                      <td className="p-2 text-zinc-900 dark:text-zinc-100">{t.bookingDate}</td>
                      <td className="p-2 text-zinc-900 dark:text-zinc-100">{t.amount}</td>
                      <td className="p-2 text-zinc-600 dark:text-zinc-400">{t.currency}</td>
                      <td className="p-2 text-zinc-900 dark:text-zinc-100">{t.description}</td>
                      <td className="p-2 text-zinc-600 dark:text-zinc-400">{t.counterparty || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
                Raw JSON
              </summary>
              <pre className="text-xs bg-zinc-100 dark:bg-zinc-800 p-3 rounded overflow-auto text-zinc-900 dark:text-zinc-100">
                {JSON.stringify(preview, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

