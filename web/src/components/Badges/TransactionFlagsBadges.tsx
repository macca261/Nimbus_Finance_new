import React from 'react';

type Props = {
  isPassThrough?: boolean;
  isInternalTransfer?: boolean;
  internalTransferKind?: 'savings' | 'wallet' | 'other' | null;
  internalTransferDirection?: 'in' | 'out' | null;
};

export const TransactionFlagsBadges: React.FC<Props> = ({
  isPassThrough,
  isInternalTransfer,
  internalTransferKind,
}) => {
  if (isPassThrough) {
    return (
      <span
        className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
        title="Dieser Betrag wird in den Auswertungen als durchlaufender Posten ignoriert (kein Einfluss auf Einnahmen/Ausgaben)."
      >
        Durchlaufender Posten
      </span>
    );
  }

  if (isInternalTransfer && internalTransferKind === 'savings') {
    return (
      <span
        className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
        title="Übertrag auf ein Sparkonto – in den Auswertungen als interner Transfer behandelt und von den Ausgaben ausgenommen."
      >
        Interner Transfer → Sparen
      </span>
    );
  }

  if (isInternalTransfer) {
    return (
      <span
        className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
        title="Interner Transfer zwischen eigenen Konten."
      >
        Interner Transfer
      </span>
    );
  }

  return null;
};


