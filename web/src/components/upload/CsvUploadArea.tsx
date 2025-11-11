import React, { useId, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { useFinanceStore } from '../../state/useFinanceStore';

export type CsvUploadAreaVariant = 'compact' | 'full' | 'inline';

export interface CsvUploadAreaProps {
  onImported?: () => void;
  variant?: CsvUploadAreaVariant;
  title?: string;
  description?: React.ReactNode;
  supportedHint?: string;
  className?: string;
}

export const CsvUploadArea: React.FC<CsvUploadAreaProps> = ({
  onImported,
  variant = 'compact',
  title = 'CSV hochladen',
  description = 'Unterstützt: Deutsche Banken, Sparkasse, ING, PayPal, Tink (CSV-Export) und weitere.',
  supportedHint = 'Drag & Drop oder Klick, max. 10 MB, *.csv',
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
    if (file.size > 10 * 1024 * 1024) {
      setError('Datei ist zu groß (max. 10MB).');
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

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        const hints = Array.isArray(json?.hints) ? `\nHinweise: ${json.hints.join(' | ')}` : '';
        setError((json?.error as string) || `Import fehlgeschlagen.${hints}`);
        return;
      }

      const profileId = (json?.profileId as string) || 'unbekannt';
      const inserted = (json?.inserted as number) ?? (json?.insertedCount as number) ?? 0;
      setInfo(`Import erfolgreich: ${inserted} Buchungen (${profileId}).`);
      await applyImportResult({ profileId, inserted });
      onImported?.();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Fehler beim Upload.');
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
        <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </div>
      ) : null}
      {info && !error ? (
        <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
          {info}
        </div>
      ) : null}
    </div>
  );
};


