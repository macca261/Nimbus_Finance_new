import React, { useState } from 'react';
import { Bookmark, X } from 'lucide-react';
import { getCategoryLabel } from '../lib/categories';

type ApplyRuleResponse = {
  ok: boolean;
  ruleId: string;
  updatedCount: number;
  error?: string;
};

type PromoteRuleResponse = {
  ok: boolean;
  ruleId: string;
  pattern: string;
  patternType: string;
  categoryId: string;
  message?: string;
};

interface PromoteRuleButtonProps {
  transactionId: number;
  category: string | null;
  merchant: string | null;
  onSuccess?: () => void;
}

export const PromoteRuleButton: React.FC<PromoteRuleButtonProps> = ({
  transactionId,
  category,
  merchant,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [promoted, setPromoted] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [applyToPast, setApplyToPast] = useState(false);
  const [isApplyingToPast, setIsApplyingToPast] = useState(false);

  const handlePromoteClick = () => {
    if (!category || category === 'other' || category === 'other_review') {
      return;
    }
    setShowDialog(true);
  };

  const handleConfirm = async () => {
    if (!category || category === 'other' || category === 'other_review') {
      return;
    }

    const categoryLabel = getCategoryLabel(category);
    setLoading(true);
    
    try {
      // Step 1: Create the rule
      const response = await fetch(`/api/transactions/${transactionId}/promote-rule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Konnte Regel nicht speichern.');
        setLoading(false);
        return;
      }

      const result: PromoteRuleResponse = await response.json();
      setPromoted(true);
      setShowDialog(false);
      
      // Step 2: Apply to past if requested
      if (applyToPast && result.ruleId) {
        setIsApplyingToPast(true);
        try {
          const applyResponse = await fetch(`/api/transactions/user-rules/${result.ruleId}/apply`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          const applyResult: ApplyRuleResponse = await applyResponse.json();
          
          if (applyResult.ok && applyResponse.ok) {
            const message = `Regel gespeichert. ${applyResult.updatedCount} bestehende Buchung(en) wurden angepasst.`;
            alert(message);
          } else {
            alert('Regel wurde gespeichert, aber bestehende Buchungen konnten nicht angepasst werden.');
          }
        } catch (applyError) {
          console.error('Failed to apply rule to past:', applyError);
          alert('Regel wurde gespeichert, aber bestehende Buchungen konnten nicht angepasst werden.');
        } finally {
          setIsApplyingToPast(false);
        }
      } else {
        // Show success message for rule creation only
        const message = result.message || `Regel gespeichert. Ähnliche Buchungen werden künftig als "${categoryLabel}" kategorisiert.`;
        alert(message);
      }
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Failed to promote rule:', error);
      alert('Konnte Regel nicht speichern.');
    } finally {
      setLoading(false);
      setApplyToPast(false);
    }
  };

  const categoryLabel = category ? getCategoryLabel(category) : '';
  const merchantName = merchant || 'diesem Händler';

  if (promoted) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
        <Bookmark className="h-3 w-3" />
        Regel aktiv
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handlePromoteClick}
        disabled={loading || isApplyingToPast}
        className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Zukünftig so kategorisieren"
      >
        <Bookmark className="h-3 w-3" />
        {loading || isApplyingToPast ? 'Speichere…' : 'Merken'}
      </button>

      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Zukünftig so kategorisieren?
              </h3>
              <button
                onClick={() => {
                  setShowDialog(false);
                  setApplyToPast(false);
                }}
                className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
                disabled={loading || isApplyingToPast}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Alle zukünftigen Buchungen mit Händler wie <span className="font-medium">"{merchantName}"</span> als <span className="font-medium">"{categoryLabel}"</span> kategorisieren?
              </p>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyToPast}
                  onChange={(e) => setApplyToPast(e.target.checked)}
                  disabled={loading || isApplyingToPast}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    Auch bestehende Buchungen mit diesem Händler anpassen
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Wir aktualisieren passende Buchungen im Hintergrund. Rückerstattungen, Umbuchungen und interne Transfers bleiben unverändert.
                  </div>
                </div>
              </label>
            </div>

            {(loading || isApplyingToPast) && (
              <div className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                Bitte warten…
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDialog(false);
                  setApplyToPast(false);
                }}
                disabled={loading || isApplyingToPast}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-600"
              >
                Abbrechen
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading || isApplyingToPast}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Bestätigen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

