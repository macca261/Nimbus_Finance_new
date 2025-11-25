/**
 * TransactionExplanationPanel Component
 * 
 * Displays a transparent explanation of why a transaction was categorized
 * in a specific way. Shows method (RULE/ML/LLM), confidence, and reasoning.
 */

import React from 'react';
import { useTransactionExplanation } from '../../../hooks/useTransactionExplanation';
import { Shield } from 'lucide-react';

interface TransactionExplanationPanelProps {
  transactionId: number | string | null;
}

export const TransactionExplanationPanel: React.FC<TransactionExplanationPanelProps> = ({
  transactionId,
}) => {
  const { data, isLoading, error } = useTransactionExplanation(transactionId);

  if (!transactionId) return null;

  // Loading state
  if (isLoading) {
    return (
      <div className="mt-3 rounded-2xl border border-nf-border-subtle bg-nf-bg-card p-4 text-sm text-nf-text-main">
        <div className="h-4 w-1/3 animate-pulse rounded bg-nf-bg-card-subtle" />
        <div className="mt-3 h-3 w-2/3 animate-pulse rounded bg-nf-bg-card-subtle" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="mt-3 rounded-2xl border border-nf-negative/30 bg-nf-negative/10 p-4 text-sm text-nf-negative">
        <p className="font-medium">Erklärung gerade nicht verfügbar</p>
        <p className="mt-1 text-xs text-nf-negative/80">
          Die Kategorie bleibt gültig, aber Nimbus konnte die Begründung nicht laden.
        </p>
      </div>
    );
  }

  if (!data) return null;

  const { trace, aiSummary, displayName } = data;

  // No trace available
  if (!trace) {
    return (
      <div className="mt-3 rounded-2xl border border-nf-border-subtle bg-nf-bg-card p-4 text-sm text-nf-text-main">
        <p className="font-medium">Warum diese Kategorie?</p>
        <p className="mt-1 text-xs text-nf-text-muted">
          Für diese Buchung liegt noch keine detaillierte Begründung vor. Künftige Zuordnungen werden transparenter
          gespeichert.
        </p>
      </div>
    );
  }

  // Determine source label
  const sourceLabel =
    trace.method === 'RULE'
      ? 'Regelbasierte Zuordnung'
      : trace.method === 'ML'
      ? 'ML-Modell'
      : trace.method === 'LLM'
      ? 'Nimbus KI'
      : 'Automatische Zuordnung';

  // Format confidence (handle both 0-1 and 0-100 scales)
  const confidencePercent = trace.confidence <= 1 
    ? Math.round(trace.confidence * 100) 
    : Math.round(trace.confidence);

  // Format date
  const traceDate = new Date(trace.createdAt).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <div className="mt-3 rounded-2xl border border-nf-border-subtle bg-nf-bg-card p-4 text-sm text-nf-text-main">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="font-medium">Warum diese Kategorie?</p>
        <span className="inline-flex items-center rounded-full bg-nf-primary-soft px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-nf-primary">
          {sourceLabel}
        </span>
      </div>

      {/* Transaction name (if available) */}
      {displayName && displayName !== 'Unbekannt' && (
        <p className="text-xs text-nf-text-muted mb-2">{displayName}</p>
      )}

      {/* Explanation text */}
      <p className="text-xs leading-relaxed text-nf-text-main">
        {aiSummary ||
          trace.ruleDescription ||
          trace.llmReasoning ||
          'Nimbus hat diese Buchung anhand deiner bisherigen Muster und Regeln dieser Kategorie zugeordnet.'}
      </p>

      {/* Metadata footer */}
      <div className="mt-3 flex items-center justify-between pt-2 border-t border-nf-border-subtle">
        <p className="text-[11px] text-nf-text-muted">
          Vertrauen: <span className="font-medium">{confidencePercent}%</span> • Stand: {traceDate}
        </p>
        {/* Optional: Datenschutz link */}
        {trace.method === 'LLM' && (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11px] text-nf-text-soft hover:text-nf-primary transition-colors"
            title="Deine Daten werden lokal verarbeitet und nur in stark gekürzter Form an Nimbus KI gesendet, wenn du KI-Funktionen aktiviert hast."
          >
            <Shield className="h-3 w-3" />
            <span>Datenschutz</span>
          </button>
        )}
      </div>
    </div>
  );
};

