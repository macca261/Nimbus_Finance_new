import React, { useMemo } from 'react';
import { AppShell } from '../layout/AppShell';
import { useAchievements } from '../hooks/useAchievements';
import { AchievementCard } from '../features/achievements/components/AchievementCard';
import { MoneyCoachPanel } from '../features/achievements/components/MoneyCoachPanel';
import { RefreshCw } from 'lucide-react';

const SHELL_CLASS = 'mx-auto w-full max-w-[1680px] px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12';

export const Achievements: React.FC = () => {
  const { achievements, isLoading, error, evaluate } = useAchievements();

  // Group achievements by type
  const groupedAchievements = useMemo(() => {
    const groups: Record<string, typeof achievements> = {
      import: [],
      streak: [],
      budget: [],
      goal: [],
      reimbursement: [],
    };

    for (const achievement of achievements) {
      const type = achievement.type || 'other';
      if (groups[type]) {
        groups[type].push(achievement);
      }
    }

    return groups;
  }, [achievements]);

  const allAchievements = useMemo(() => {
    return Object.values(groupedAchievements).flat();
  }, [groupedAchievements]);

  if (error) {
    return (
      <AppShell>
        <main className="flex-1 pb-10">
          <div className={SHELL_CLASS}>
            <div className="rounded-2xl border border-nf-negative/30 bg-nf-negative/10 px-4 py-3 text-sm text-nf-negative">
              {error}
            </div>
          </div>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="flex-1 pb-10">
        <div className={SHELL_CLASS}>
          <div className="py-6 space-y-6">
            {/* Header */}
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-nf-text-main">Erfolge</h1>
                <p className="mt-1 text-sm text-nf-text-muted">
                  Deine Fortschritte und Meilensteine auf einen Blick.
                </p>
              </div>
              <button
                type="button"
                onClick={evaluate}
                disabled={isLoading}
                className="inline-flex items-center gap-2 rounded-full border border-nf-border-subtle bg-nf-bg-card px-4 py-2 text-sm font-medium text-nf-text-main hover:border-nf-primary hover:text-nf-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Aktualisieren
              </button>
            </div>

            {/* Main Content Grid */}
            <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
              {/* Achievements Grid */}
              <div className="space-y-6">
                {isLoading ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="h-48 bg-nf-bg-card-subtle rounded-3xl animate-pulse" />
                    ))}
                  </div>
                ) : allAchievements.length === 0 ? (
                  <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card p-12 text-center">
                    <p className="text-nf-text-muted">Noch keine Erfolge verfügbar.</p>
                    <p className="text-sm text-nf-text-muted mt-2">
                      Importiere Transaktionen oder erstelle Budgets, um Erfolge zu sammeln.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Import Achievements */}
                    {groupedAchievements.import.length > 0 && (
                      <div>
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-nf-text-muted mb-4">
                          Import
                        </h2>
                        <div className="grid gap-4 sm:grid-cols-2">
                          {groupedAchievements.import.map(achievement => (
                            <AchievementCard key={achievement.id} achievement={achievement} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Streak Achievements */}
                    {groupedAchievements.streak.length > 0 && (
                      <div>
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-nf-text-muted mb-4">
                          Serien
                        </h2>
                        <div className="grid gap-4 sm:grid-cols-2">
                          {groupedAchievements.streak.map(achievement => (
                            <AchievementCard key={achievement.id} achievement={achievement} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Budget Achievements */}
                    {groupedAchievements.budget.length > 0 && (
                      <div>
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-nf-text-muted mb-4">
                          Budgets
                        </h2>
                        <div className="grid gap-4 sm:grid-cols-2">
                          {groupedAchievements.budget.map(achievement => (
                            <AchievementCard key={achievement.id} achievement={achievement} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Goal Achievements */}
                    {groupedAchievements.goal.length > 0 && (
                      <div>
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-nf-text-muted mb-4">
                          Ziele
                        </h2>
                        <div className="grid gap-4 sm:grid-cols-2">
                          {groupedAchievements.goal.map(achievement => (
                            <AchievementCard key={achievement.id} achievement={achievement} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Reimbursement Achievements */}
                    {groupedAchievements.reimbursement.length > 0 && (
                      <div>
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-nf-text-muted mb-4">
                          Erstattungen
                        </h2>
                        <div className="grid gap-4 sm:grid-cols-2">
                          {groupedAchievements.reimbursement.map(achievement => (
                            <AchievementCard key={achievement.id} achievement={achievement} />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Money Coach Panel (Sticky) */}
              <div className="lg:sticky lg:top-6 lg:self-start">
                <MoneyCoachPanel achievements={allAchievements} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
};

