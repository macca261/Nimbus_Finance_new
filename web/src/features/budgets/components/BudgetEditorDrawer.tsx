import React, { useState, useEffect } from 'react';
import { createBudget, updateBudget, fetchBudgetById } from '../../../api/budgetsApi';
import type { CreateBudgetInput, UpdateBudgetInput } from '../../../types/budgets';
import { X } from 'lucide-react';
import { evaluateQuietly } from '../../../lib/achievements/evaluateQuietly';

interface BudgetEditorDrawerProps {
  open: boolean;
  onClose: () => void;
  budgetId?: string | null;
  defaultMonth?: string;
}

export const BudgetEditorDrawer: React.FC<BudgetEditorDrawerProps> = ({
  open,
  onClose,
  budgetId,
  defaultMonth,
}) => {
  const [name, setName] = useState('');
  const [period, setPeriod] = useState<'monthly' | 'weekly' | 'yearly'>('monthly');
  const [periodValue, setPeriodValue] = useState(defaultMonth || '');
  const [allocations, setAllocations] = useState<Array<{ categoryId: string; plannedCents: number }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && budgetId) {
      // Load existing budget
      fetchBudgetById(budgetId)
        .then((summary) => {
          setName(summary.budget.name);
          setPeriod(summary.budget.period);
          setPeriodValue(summary.budget.periodValue);
          setAllocations(
            summary.allocations.map((a) => ({
              categoryId: a.categoryId,
              plannedCents: a.plannedCents,
            }))
          );
        })
        .catch((err) => {
          setError(err.message);
        });
    } else if (open) {
      // Reset for new budget
      setName('');
      setPeriod('monthly');
      setPeriodValue(defaultMonth || '');
      setAllocations([]);
      setError(null);
    }
  }, [open, budgetId, defaultMonth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (budgetId) {
        const input: UpdateBudgetInput = {
          name,
          period,
          periodValue,
          allocations,
        };
        await updateBudget(budgetId, input);
      } else {
        const input: CreateBudgetInput = {
          name,
          period,
          periodValue,
          currency: 'EUR',
          allocations,
        };
        await createBudget(input);
      }
      // Trigger achievement evaluation in background
      void evaluateQuietly();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Fehler beim Speichern');
    } finally {
      setIsLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-nf-bg-card shadow-2xl">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-nf-border-subtle px-6 py-4">
            <h2 className="text-lg font-semibold text-nf-text-main">
              {budgetId ? 'Budget bearbeiten' : 'Neues Budget'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-nf-text-muted hover:bg-nf-bg-card-subtle"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6">
            {error && (
              <div className="mb-4 rounded-lg border border-nf-negative/30 bg-nf-negative/10 px-4 py-3 text-sm text-nf-negative">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-nf-text-main mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-nf-border-subtle bg-nf-bg-card px-3 py-2 text-sm text-nf-text-main focus:border-nf-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-nf-text-main mb-1">Zeitraum</label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as any)}
                  className="w-full rounded-lg border border-nf-border-subtle bg-nf-bg-card px-3 py-2 text-sm text-nf-text-main focus:border-nf-primary focus:outline-none"
                >
                  <option value="monthly">Monatlich</option>
                  <option value="weekly">Wöchentlich</option>
                  <option value="yearly">Jährlich</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-nf-text-main mb-1">Periode</label>
                <input
                  type="text"
                  value={periodValue}
                  onChange={(e) => setPeriodValue(e.target.value)}
                  required
                  placeholder={period === 'monthly' ? '2025-10' : period === 'weekly' ? '2025-W42' : '2025'}
                  className="w-full rounded-lg border border-nf-border-subtle bg-nf-bg-card px-3 py-2 text-sm text-nf-text-main focus:border-nf-primary focus:outline-none"
                />
              </div>

              {/* Allocations editor - simplified for now */}
              <div>
                <label className="block text-sm font-medium text-nf-text-main mb-2">Kategorien</label>
                <p className="text-xs text-nf-text-muted mb-4">
                  Kategorien können später hinzugefügt werden.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-nf-border-subtle bg-nf-bg-card px-4 py-2 text-sm font-medium text-nf-text-main hover:bg-nf-bg-card-subtle"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="rounded-lg bg-nf-primary px-4 py-2 text-sm font-medium text-white hover:bg-nf-primary/90 disabled:opacity-50"
              >
                {isLoading ? 'Speichern…' : 'Speichern'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

