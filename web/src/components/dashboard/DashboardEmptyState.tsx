import React from 'react';
import { CsvUploadArea } from '../upload/CsvUploadArea';

type DashboardEmptyStateProps = {
  onImported?: () => void;
  onNavigateToImports?: () => void;
};

export const DashboardEmptyState: React.FC<DashboardEmptyStateProps> = ({ onImported, onNavigateToImports }) => {
  return (
    <section className="flex flex-col gap-6 rounded-3xl border border-dashed border-slate-300/80 bg-white/80 px-6 py-10 text-center shadow-sm shadow-slate-500/10 dark:border-slate-700/60 dark:bg-slate-900/70 sm:px-12 sm:py-16">
      <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">Starte mit einem Kontoauszug</h1>
      <p className="mx-auto max-w-2xl text-sm text-slate-500 dark:text-slate-400">
        Lade einen CSV-Export von deiner Bank oder PayPal hoch. Wir erkennen das Profil, normalisieren die Daten und
        geben dir innerhalb von Sekunden saubere Finanzinformationen.
      </p>
      <div className="mx-auto w-full max-w-2xl">
        <CsvUploadArea
          variant="inline"
          onImported={onImported}
          description={
            <>
              Unterstützt werden comdirect, Sparkasse, ING, DKB, PayPal und weitere Banken. Du kannst mehrere Dateien
              nacheinander laden – wir erkennen Duplikate automatisch.
            </>
          }
          supportedHint="Drag & Drop oder Klick • CSV bis 10 MB"
        />
      </div>
      <button
        type="button"
        onClick={onNavigateToImports}
        className="mx-auto inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-indigo-500/40 dark:hover:text-indigo-200"
      >
        Mehr Infos zu Imports
      </button>
    </section>
  );
};


