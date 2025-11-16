import React, { useEffect, useState } from 'react';
import { X, Trash2, RefreshCw } from 'lucide-react';
import { getCategoryMeta, getCategoryLabel } from '../lib/categories';
import { formatDate } from '../lib/format';

export type ApiUserRule = {
  id: string;
  pattern: string;
  patternType: string;
  categoryId: string;
  createdAt: string;
};

type ApplyRuleResponse = {
  ok: boolean;
  ruleId: string;
  updatedCount: number;
  error?: string;
};

interface UserRulesPanelProps {
  onClose: () => void;
}

export const UserRulesPanel: React.FC<UserRulesPanelProps> = ({ onClose }) => {
  const [rules, setRules] = useState<ApiUserRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applyingRuleId, setApplyingRuleId] = useState<string | null>(null);

  const loadRules = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/transactions/user-rules');
      if (!response.ok) {
        throw new Error('Failed to load rules');
      }
      const data = await response.json();
      setRules(data.rules || []);
    } catch (err) {
      setError('Regeln konnten nicht geladen werden.');
      console.error('Failed to load rules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleDelete = async (ruleId: string, pattern: string, categoryId: string) => {
    const categoryLabel = getCategoryLabel(categoryId);
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;
    
    const confirmed = window.confirm(
      `Diese Regel wirklich löschen?\n\nKünftige Buchungen werden nicht mehr automatisch so kategorisiert.\n\nRegel: ${patternTypeLabel(rule.patternType, rule.pattern)} → "${categoryLabel}"`
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`/api/transactions/user-rules/${ruleId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete rule');
      }

      // Remove from local state
      setRules(prev => prev.filter(r => r.id !== ruleId));
      alert('Regel gelöscht.');
    } catch (err) {
      console.error('Failed to delete rule:', err);
      alert('Regel konnte nicht gelöscht werden.');
    }
  };

  const patternTypeLabel = (patternType: string, pattern: string): string => {
    if (patternType === 'payee') {
      return `Händler enthält "${pattern}"`;
    } else if (patternType === 'memo') {
      return `Memo enthält "${pattern}"`;
    }
    return `${patternType} enthält "${pattern}"`;
  };

  const handleApplyToPast = async (rule: ApiUserRule) => {
    const categoryLabel = getCategoryLabel(rule.categoryId);
    const patternLabel = patternTypeLabel(rule.patternType, rule.pattern);
    
    const confirmed = window.confirm(
      `Regel auf bestehende Buchungen anwenden?\n\nWir versuchen, alle bestehenden Buchungen zu finden, die zum Muster passen:\n\n${patternLabel} → ${categoryLabel}\n\nRückerstattungen, interne Transfers und Erstattungen werden nicht verändert.`
    );

    if (!confirmed) {
      return;
    }

    setApplyingRuleId(rule.id);
    try {
      const response = await fetch(`/api/transactions/user-rules/${rule.id}/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result: ApplyRuleResponse = await response.json();

      if (result.ok && response.ok) {
        alert(`Regel angewendet. ${result.updatedCount} Buchung(en) wurden aktualisiert.`);
      } else {
        alert('Fehler beim Anwenden der Regel. Bitte später erneut versuchen.');
      }
    } catch (err) {
      console.error('Failed to apply rule to past:', err);
      alert('Fehler beim Anwenden der Regel. Bitte später erneut versuchen.');
    } finally {
      setApplyingRuleId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-800 rounded-lg shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Eigene Regeln verwalten
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              Lade Regeln...
            </div>
          ) : error ? (
            <div className="text-center py-8 text-rose-600 dark:text-rose-400">
              {error}
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              <p className="mb-2">Noch keine eigenen Regeln.</p>
              <p className="text-sm">
                Du kannst bei einer Buchung auf „Merken" klicken, um eine anzulegen.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map(rule => {
                const categoryMeta = getCategoryMeta(rule.categoryId);
                return (
                  <div
                    key={rule.id}
                    className="flex items-start justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{ backgroundColor: categoryMeta.background, color: categoryMeta.color }}
                        >
                          {categoryMeta.label}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        {rule.patternType === 'payee' ? (
                          <>Händler enthält <span className="font-mono font-medium">"{rule.pattern}"</span></>
                        ) : (
                          <>Memo enthält <span className="font-mono font-medium">"{rule.pattern}"</span></>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                        Erstellt: {formatDate(rule.createdAt)}
                      </div>
                    </div>
                    <div className="ml-4 flex items-center gap-2">
                      <button
                        onClick={() => handleApplyToPast(rule)}
                        disabled={applyingRuleId === rule.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
                        title="Auf bestehende Buchungen anwenden"
                      >
                        {applyingRuleId === rule.id ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            <span>Wird angewendet…</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-3.5 w-3.5" />
                            <span>Auf bestehende anwenden</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id, rule.pattern, rule.categoryId)}
                        className="p-2 rounded-md hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-600 dark:text-rose-400 transition-colors"
                        title="Regel löschen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

