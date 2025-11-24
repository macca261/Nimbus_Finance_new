import React, { useState, useMemo } from 'react';
import { AppShell } from '../../../layout/AppShell';
import { useBudgets } from '../../../hooks/useBudgets';
import { BudgetSummaryStrip } from './BudgetSummaryStrip';
import { BudgetGrid } from './BudgetGrid';
import { BudgetEditorDrawer } from './BudgetEditorDrawer';
import { formatCurrency } from '../../../lib/format';
import { Plus } from 'lucide-react';

const SHELL_CLASS = 'mx-auto w-full max-w-[1680px] px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12';

export const BudgetOverviewPage: React.FC = () => {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);

  const { budgets, isLoading, error, refetch } = useBudgets({ month: selectedMonth, period: 'monthly' });
  const currentBudget = budgets[0] || null;

  const handleCreateBudget = () => {
    setEditingBudgetId(null);
    setEditorOpen(true);
  };

  const handleEditBudget = (budgetId: string) => {
    setEditingBudgetId(budgetId);
    setEditorOpen(true);
  };

  const handleEditorClose = () => {
    setEditorOpen(false);
    setEditingBudgetId(null);
    refetch();
  };

  return (
    <AppShell>
      <main className="flex-1 pb-10">
        <section className={SHELL_CLASS + ' space-y-6'}>
          <header className="flex items-baseline justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-nf-text-main">Budgets</h1>
              <p className="mt-1 text-sm text-nf-text-muted">
                Plane deine Ausgaben und verfolge Budgetziele monatlich, wöchentlich oder jährlich.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCreateBudget}
              className="inline-flex items-center gap-2 rounded-full bg-nf-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-nf-primary/90"
            >
              <Plus className="h-4 w-4" />
              Budget erstellen
            </button>
          </header>

          {error && (
            <div className="rounded-2xl border border-nf-negative/30 bg-nf-negative/10 px-4 py-3 text-sm text-nf-negative">
              {error}
            </div>
          )}

          {isLoading && !currentBudget ? (
            <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card p-12 text-center text-nf-text-muted">
              Lade Budgets…
            </div>
          ) : currentBudget ? (
            <>
              <BudgetSummaryStrip summary={currentBudget} />
              <BudgetGrid summary={currentBudget} onEdit={handleEditBudget} />
            </>
          ) : (
            <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card p-12 text-center">
              <p className="text-nf-text-muted mb-4">Noch keine Budgets vorhanden.</p>
              <button
                type="button"
                onClick={handleCreateBudget}
                className="inline-flex items-center gap-2 rounded-full bg-nf-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-nf-primary/90"
              >
                <Plus className="h-4 w-4" />
                Erstes Budget erstellen
              </button>
            </div>
          )}

          <BudgetEditorDrawer
            open={editorOpen}
            onClose={handleEditorClose}
            budgetId={editingBudgetId}
            defaultMonth={selectedMonth}
          />
        </section>
      </main>
    </AppShell>
  );
};

