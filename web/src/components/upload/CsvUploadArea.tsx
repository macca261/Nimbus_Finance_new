import React, { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { UploadCloud } from 'lucide-react';
import { useFinanceStore } from '../../state/useFinanceStore';
import { toast } from '../../lib/toast';
import { evaluateQuietly } from '../../lib/achievements/evaluateQuietly';
import { emitDataMutated } from '../../lib/dataEvents';

export type CsvUploadAreaVariant = 'compact' | 'full' | 'inline';

export interface CsvUploadAreaProps {
  onImported?: (data?: ImportResponse) => void;
  variant?: CsvUploadAreaVariant;
  title?: string;
  description?: React.ReactNode;
  supportedHint?: string;
  className?: string;
}

type ImportResponse = {
  code?: string;
  error?: string;
  message?: string;
  profileId?: string;
  confidence?: number;
  warnings?: string[];
  candidates?: Array<{ profileId: string; confidence: number }>;
  inserted?: number;
  imported?: number;
  insertedCount?: number;
  duplicateCount?: number;
  skippedCount?: number;
  reasons?: string[];
  rowCount?: number;
  details?: string;
  reason?: 'all_duplicates' | 'parse_error' | 'unsupported_format' | null; // Reason code for import result
  success?: boolean;
};

export const CsvUploadArea: React.FC<CsvUploadAreaProps> = ({
  onImported,
  variant = 'compact',
  title = 'CSV hochladen',
  description = 'Unterstützt: Deutsche Banken, Sparkasse, ING, PayPal, Tink (CSV-Export) und weitere.',
  supportedHint = 'Drag & Drop oder Klick, max. 50 MB, *.csv',
  className,
}) => {
  const inputId = useId();
  const applyImportResult = useFinanceStore(state => state.applyImportResult);
  const [dragActive, setDragActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || !files[0]) return;
    const file = files[0];
    setError(null);
    setInfo(null);

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Bitte eine CSV-Datei auswählen.');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('Datei ist zu groß (max. 50MB).');
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);

      const res = await fetch('/api/import', {
        method: 'POST',
        body: form,
      });

      // Always try to read JSON, even on error
      let data: ImportResponse | null = null;
      try {
        const text = await res.text();
        if (text) {
          data = JSON.parse(text) as ImportResponse;
        }
      } catch (jsonError) {
        // If JSON parsing fails, create a structured error
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.error('[CsvUploadArea] Failed to parse response JSON', {
            status: res.status,
            statusText: res.statusText,
            error: jsonError,
          });
        }
        data = {
          code: 'IMPORT_FAILED',
          message: `Import fehlgeschlagen (Status ${res.status})`,
          details: res.statusText || 'Ungültige Antwort vom Server.',
        };
      }

      if (res.ok) {
        const insertedCount =
          data?.insertedCount ??
          data?.inserted ??
          data?.imported ??
          0;
        const duplicateCount = data?.duplicateCount ?? data?.skippedCount ?? data?.skipped ?? 0;
        const reason = data?.reason;

        // Case A: New rows inserted
        if (insertedCount > 0) {
          const message = data?.message || `${insertedCount} neue Transaktion${insertedCount !== 1 ? 'en' : ''} importiert.`;
          setInfo(message);
          toast(message, 'success');
          
          // Trigger refetch of transaction data
          emitDataMutated({ reason: 'imports:csv-uploaded' });
          
          // Trigger achievement evaluation in background
          void evaluateQuietly();
          
          // Apply import result if store method exists
          const profileId = data?.profileId || 'unbekannt';
          if (applyImportResult) {
            await applyImportResult({ profileId, inserted: insertedCount });
          }
          
          onImported?.(data ?? undefined);
          return;
        }

        // Case B: All duplicates (no new data)
        if (insertedCount === 0 && duplicateCount > 0 && reason === 'all_duplicates') {
          const message = data?.message || 'Keine neuen Transaktionen – alle Buchungen waren bereits vorhanden.';
          setInfo(message);
          toast(message, 'info');
          onImported?.(data ?? undefined);
          return;
        }

        // Case C: No rows but not explicitly duplicates
        if (insertedCount === 0) {
          const message = data?.message || 'Keine neuen Transaktionen importiert.';
          setInfo(message);
          toast(message, 'info');
          onImported?.(data ?? undefined);
          return;
        }
      }

      // Handle error response
      const err = data || {};
      
      // Safe error logging that won't throw
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        try {
          const safeLogObj: Record<string, any> = {
            status: res.status,
            statusText: res.statusText || 'Unknown',
          };
          
          // Safely extract error properties
          try {
            if (err && typeof err === 'object') {
              safeLogObj.code = err.code || err.error || 'UNKNOWN';
              safeLogObj.message = err.message || 'Unknown error';
              if (err.details && typeof err.details === 'string') {
                safeLogObj.details = err.details;
              }
            }
          } catch (extractError) {
            safeLogObj.parseError = 'Could not extract error details';
          }
          
          console.error('[CsvUploadArea] CSV import failed', safeLogObj);
        } catch (logError) {
          // Fallback if console.error itself fails
          console.error('[CsvUploadArea] CSV import failed - could not log details');
        }
      }

      // Handle specific error codes
      if (err?.code === 'IMPORT_EMPTY' || err?.error === 'IMPORT_EMPTY') {
        const title = err.message ?? 'Keine gültigen Umsätze importiert.';
        const details: string[] = [];
        if (Array.isArray(err.reasons) && err.reasons.length > 0) {
          details.push(err.reasons.join(' '));
        }
        if (err.profileId) details.push(`Profil: ${err.profileId}`);
        if (typeof err.rowCount === 'number') details.push(`${err.rowCount} Zeilen`);
        const composed = [title, details.join(' ')].filter(Boolean).join(' ');
        setInfo(composed);
        toast(composed, 'info');
        onImported?.(err);
        return;
      }

      if (err?.code === 'PAYPAL_PARSE_ERROR' || err?.code === 'BANK_PARSE_ERROR' || err?.error === 'PAYPAL_PARSE_ERROR' || err?.error === 'BANK_PARSE_ERROR') {
        const lines = [err.message ?? 'Die CSV-Datei konnte nicht interpretiert werden.'];
        if (err.details) {
          lines.push(String(err.details));
        }
        const message = lines.join('\n');
        setError(message);
        toast(message, 'error');
        return;
      }

      if (err?.code === 'BAD_REQUEST' || err?.error === 'BAD_REQUEST') {
        const message = err.message ?? 'Ungültige Anfrage. Bitte überprüfe die Datei.';
        setError(message);
        toast(message, 'error');
        return;
      }

      // Handle CSV_IMPORT_FAILED (from backend)
      if (err?.code === 'CSV_IMPORT_FAILED' || err?.error === 'CSV_IMPORT_FAILED') {
        let message = err.message || 'Import fehlgeschlagen. Bitte prüfe die Datei oder versuche es erneut.';
        
        // Handle specific reason codes
        if (err.reason === 'parse_error') {
          message = 'Die CSV konnte nicht vollständig gelesen werden. Bitte prüfe Format und Trennzeichen.';
        } else if (err.reason === 'unsupported_format') {
          message = 'Das Format der CSV-Datei wird nicht unterstützt.';
        }
        
        const details = err.details ? `\n${err.details}` : '';
        const fullMessage = `${message}${details}`;
        setError(fullMessage);
        toast(message, 'error');
        return;
      }

      if (err?.code === 'IMPORT_FAILED' || err?.error === 'IMPORT_FAILED') {
        const message = err.message ?? 'Unbekannter Importfehler. Bitte versuche es erneut.';
        const details = err.details ? `\n${err.details}` : '';
        setError(`${message}${details}`);
        toast(message, 'error');
        return;
      }

      // Handle HTTP status codes
      if (res.status === 404) {
        const message = 'Import-Endpunkt nicht gefunden. Bitte überprüfe die Verbindung.';
        setError(message);
        toast(message, 'error');
        return;
      }

      if (res.status === 500) {
        const message = err?.message || err?.details || 'Server-Fehler beim Importieren. Bitte versuche es später erneut.';
        setError(message);
        toast(message, 'error');
        return;
      }

      // Fallback: show backend message if available, otherwise HTTP status
      const fallbackMessage = `Import fehlgeschlagen (HTTP ${res.status})`;
      const message = err?.message || err?.details || err?.code || err?.error || fallbackMessage;
      setError(message);
      toast(message, 'error');
    } catch (e: any) {
      // Network error or other fetch failures
      try {
        console.error('[CsvUploadArea] CSV upload error', {
          error: e?.message || String(e),
          name: e?.name,
          stack: e?.stack?.substring(0, 200), // Truncate stack trace
        });
      } catch (logError) {
        // Fallback if logging fails
        console.error('[CsvUploadArea] CSV upload error - could not log details');
      }
      
      let errorMessage = 'Fehler beim Upload.';
      try {
        if (e?.message) {
          if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError') || e.message.includes('ERR_CONNECTION')) {
            errorMessage = 'Verbindungsfehler. Bitte überprüfe, ob der Server läuft und versuche es erneut.';
          } else if (e.message.includes('JSON')) {
            errorMessage = 'Ungültige Server-Antwort. Bitte versuche es erneut.';
          } else {
            errorMessage = e.message.length > 100 ? e.message.substring(0, 100) + '...' : e.message;
          }
        }
      } catch (msgError) {
        // If error message processing fails, use default
        errorMessage = 'Unbekannter Fehler beim Upload.';
      }
      
      setError(errorMessage);
      toast(errorMessage, 'error');
    } finally {
      setBusy(false);
    }
  }

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files);
  };

  const containerTone =
    variant === 'full'
      ? 'border-slate-300/80 bg-white/80 dark:border-slate-700/80 dark:bg-slate-900/80'
      : 'border-slate-300 bg-slate-50 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:bg-slate-900/50';

  const paddingClass =
    variant === 'full' ? 'py-14 sm:py-20 px-6 sm:px-10 text-base' : variant === 'inline' ? 'py-8 px-6 text-sm' : 'py-6 px-5 text-sm';

  return (
    <div className={className}>
      <div className="mb-4 flex flex-col gap-1">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        {description ? (
          <p className="max-w-2xl text-xs text-slate-500 dark:text-slate-400">{description}</p>
        ) : null}
      </div>
      <div
        onDragOver={event => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={event => {
          event.preventDefault();
          setDragActive(false);
        }}
        onDrop={event => {
          event.preventDefault();
          event.stopPropagation();
          setDragActive(false);
          handleFiles(event.dataTransfer.files);
        }}
        onClick={() => document.getElementById(inputId)?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            document.getElementById(inputId)?.click();
          }
        }}
        className={[
          'group relative flex w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 dark:focus:ring-offset-slate-950',
          containerTone,
          paddingClass,
          dragActive ? 'border-indigo-500 bg-indigo-50/70 dark:border-indigo-400/80 dark:bg-indigo-900/40' : '',
        ].join(' ')}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-200">
            <UploadCloud className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
              {busy ? 'CSV wird importiert…' : 'CSV hochladen'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{supportedHint}</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/60 bg-white px-4 py-1.5 text-xs font-medium text-slate-600 transition group-hover:border-indigo-200 group-hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:group-hover:border-indigo-500/50 dark:group-hover:text-indigo-200">
            {busy ? (
              <>
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-500/40 border-t-transparent" aria-hidden="true" />
                <span>Wird verarbeitet…</span>
              </>
            ) : (
              <>
                <span className="font-semibold">Datei wählen</span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">oder hierher ziehen</span>
              </>
            )}
          </div>
        </div>
      </div>
      <input id={inputId} type="file" accept=".csv,text/csv" onChange={onInputChange} className="hidden" />
      {error ? (
        <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200 whitespace-pre-wrap">
          {error}
        </div>
      ) : null}
      {info && !error ? (
        <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
          <p className="whitespace-pre-wrap">{info}</p>
          <Link
            to="/admin/imports"
            className="mt-2 inline-flex text-[11px] font-semibold text-emerald-700 underline hover:text-emerald-800 dark:text-emerald-200 dark:hover:text-emerald-100"
          >
            Importe verwalten
          </Link>
        </div>
      ) : null}
      {!error && !info && !busy ? (
        <p className="mt-3 text-center text-[11px] text-slate-500 dark:text-slate-400">
          Deine CSV wird lokal analysiert – sensible Felder werden vor KI-Aufrufen automatisch gekürzt.
        </p>
      ) : null}
    </div>
  );
};


