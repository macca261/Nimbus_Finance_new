import React from 'react';

type Props = {
  isPassThrough?: boolean;
  isInternalTransfer?: boolean;
  internalTransferKind?: 'savings' | 'wallet' | 'other' | 'payment_provider_funding' | null;
  internalTransferDirection?: 'in' | 'out' | null;
  fromAccountName?: string | null;
  toAccountName?: string | null;
  isReimbursement?: boolean;
  reimbursementRole?: 'payer' | 'receiver' | null;
  isCashWithdrawal?: boolean;
};

export const TransactionFlagsBadges: React.FC<Props> = ({
  isPassThrough,
  isInternalTransfer,
  internalTransferKind,
  internalTransferDirection,
  fromAccountName,
  toAccountName,
  isReimbursement,
  reimbursementRole,
  isCashWithdrawal,
}) => {
  // Priority: Pass-through > Internal Transfer > Reimbursement > Cash Withdrawal
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

  if (isInternalTransfer) {
    // Payment provider funding: bank → PayPal funding transfer
    // Show a specific badge for this case
    if (internalTransferKind === 'payment_provider_funding') {
      const providerName = toAccountName?.toLowerCase().includes('paypal') ? 'PayPal' : 'Zahlungsdienstleister';
      const label = fromAccountName && toAccountName
        ? `${fromAccountName} → ${providerName}-Aufladung`
        : `${providerName}-Aufladung`;
      
      return (
        <span
          className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400"
          title={`Bank → ${providerName} Aufladung – in den Auswertungen als interner Transfer behandelt und von den Ausgaben ausgenommen. Nur die ${providerName} → Händler Buchung zählt als Ausgabe.`}
        >
          {label}
        </span>
      );
    }

    // Build label with account names if available
    let label = 'Interner Transfer';
    if (fromAccountName && toAccountName) {
      label = `${fromAccountName} → ${toAccountName}`;
    } else if (fromAccountName) {
      label = `→ ${fromAccountName}`;
    } else if (toAccountName) {
      label = `${toAccountName} ←`;
    } else if (internalTransferKind === 'savings') {
      label = 'Interner Transfer → Sparen';
    } else if (internalTransferKind === 'wallet') {
      label = 'Interner Transfer → Wallet';
    }

    const title = fromAccountName && toAccountName
      ? `Interner Transfer von ${fromAccountName} zu ${toAccountName} – in den Auswertungen als interner Transfer behandelt und von den Ausgaben ausgenommen.`
      : 'Interner Transfer zwischen eigenen Konten – in den Auswertungen als interner Transfer behandelt und von den Ausgaben ausgenommen.';

    return (
      <span
        className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
        title={title}
      >
        {label}
      </span>
    );
  }

  if (isReimbursement) {
    const label = reimbursementRole === 'receiver' ? 'Erstattung erhalten' : 'Erstattung gezahlt';
    return (
      <span
        className="inline-flex items-center rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-xs text-blue-800 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200"
        title="Erstattung oder geteilte Rechnung – in den Auswertungen neutral behandelt, bleibt aber in der Liste sichtbar."
      >
        {label}
      </span>
    );
  }

  if (isCashWithdrawal) {
    return (
      <span
        className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
        title="Bargeldauszahlung – in den Auswertungen von den Ausgaben ausgenommen."
      >
        Bargeldabhebung
      </span>
    );
  }

  return null;
};


