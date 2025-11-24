import React, { useState } from 'react';
import { AppShell } from '../../../layout/AppShell';
import { useGoals } from '../../../hooks/useGoals';
import { GoalCard } from './GoalCard';
import { GoalEditorDrawer } from './GoalEditorDrawer';
import { Plus } from 'lucide-react';

const SHELL_CLASS = 'mx-auto w-full max-w-[1680px] px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12';

export const GoalsOverviewPage: React.FC = () => {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const { goals, isLoading, error, refetch } = useGoals({ isActive: true });

  const handleCreateGoal = () => {
    setEditingGoalId(null);
    setEditorOpen(true);
  };

  const handleEditGoal = (goalId: string) => {
    setEditingGoalId(goalId);
    setEditorOpen(true);
  };

  const handleEditorClose = () => {
    setEditorOpen(false);
    setEditingGoalId(null);
    refetch();
  };

  return (
    <AppShell>
      <main className="flex-1 pb-10">
        <section className={SHELL_CLASS + ' space-y-6'}>
          <header className="flex items-baseline justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-nf-text-main">Ziele</h1>
              <p className="mt-1 text-sm text-nf-text-muted">
                Setze dir Ziele und verfolge deinen Fortschritt beim Sparen, Schuldenabbau oder Vermögensaufbau.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCreateGoal}
              className="inline-flex items-center gap-2 rounded-full bg-nf-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-nf-primary/90"
            >
              <Plus className="h-4 w-4" />
              Ziel erstellen
            </button>
          </header>

          {error && (
            <div className="rounded-2xl border border-nf-negative/30 bg-nf-negative/10 px-4 py-3 text-sm text-nf-negative">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card p-6 animate-pulse">
                  <div className="h-4 bg-nf-bg-card-subtle rounded w-3/4 mb-4" />
                  <div className="h-8 bg-nf-bg-card-subtle rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : goals.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {goals.map((goalProgress) => (
                <GoalCard key={goalProgress.goal.id} progress={goalProgress} onEdit={handleEditGoal} />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card p-12 text-center">
              <p className="text-nf-text-muted mb-4">Noch keine Ziele vorhanden.</p>
              <button
                type="button"
                onClick={handleCreateGoal}
                className="inline-flex items-center gap-2 rounded-full bg-nf-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-nf-primary/90"
              >
                <Plus className="h-4 w-4" />
                Erstes Ziel erstellen
              </button>
            </div>
          )}

          <GoalEditorDrawer open={editorOpen} onClose={handleEditorClose} goalId={editingGoalId} />
        </section>
      </main>
    </AppShell>
  );
};

