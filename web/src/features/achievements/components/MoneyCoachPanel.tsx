import React, { useMemo } from 'react';
import type { Achievement } from '../../../types/achievements';
import { Lightbulb, TrendingUp, Target } from 'lucide-react';

interface MoneyCoachPanelProps {
  achievements: Achievement[];
}

export const MoneyCoachPanel: React.FC<MoneyCoachPanelProps> = ({ achievements }) => {
  const nudges = useMemo(() => {
    const result: Array<{ icon: React.ComponentType<{ className?: string }>; text: string; priority: number }> = [];

    // Find in-progress achievements that are close to completion
    const inProgress = achievements.filter(a => a.status === 'in_progress');
    const closeToCompletion = inProgress
      .filter(a => a.progress >= 80 && a.progress < 100)
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 2);

    for (const achievement of closeToCompletion) {
      const remaining = 100 - achievement.progress;
      result.push({
        icon: TrendingUp,
        text: `Du bist zu ${achievement.progress}% auf Kurs für "${achievement.title}". Noch ${Math.ceil(remaining)}% bis zum Erfolg! 💪`,
        priority: achievement.progress,
      });
    }

    // Suggest creating first budget if not done
    const hasBudget = achievements.find(a => a.key === 'first_budget' && a.status === 'completed');
    if (!hasBudget) {
      result.push({
        icon: Target,
        text: 'Erstelle dein erstes Budget, um deine Ausgaben besser zu kontrollieren.',
        priority: 50,
      });
    }

    // Suggest creating first goal if not done
    const hasGoal = achievements.find(a => a.key === 'first_goal' && a.status === 'completed');
    if (!hasGoal) {
      result.push({
        icon: Target,
        text: 'Setze dir ein Ziel, um motiviert zu bleiben und deine Finanzen zu verbessern.',
        priority: 50,
      });
    }

    // Suggest importing more transactions if low count
    const transactions50 = achievements.find(a => a.key === 'transactions_50');
    if (transactions50 && transactions50.status === 'locked') {
      result.push({
        icon: TrendingUp,
        text: 'Importiere mehr Transaktionen, um bessere Einblicke zu erhalten.',
        priority: 30,
      });
    }

    // Sort by priority (highest first) and take top 3
    return result.sort((a, b) => b.priority - a.priority).slice(0, 3);
  }, [achievements]);

  if (nudges.length === 0) {
    return (
      <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card p-6 shadow-elevated">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-full bg-nf-primary-soft p-2">
            <Lightbulb className="h-5 w-5 text-nf-primary" />
          </div>
          <h3 className="text-base font-semibold text-nf-text-main">Money Coach</h3>
        </div>
        <p className="text-sm text-nf-text-muted">
          Du bist auf einem guten Weg! 🎉 Halte weiter durch und erreiche deine Ziele.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-nf-border-subtle bg-nf-bg-card p-6 shadow-elevated">
      <div className="flex items-center gap-3 mb-4">
        <div className="rounded-full bg-nf-primary-soft p-2">
          <Lightbulb className="h-5 w-5 text-nf-primary" />
        </div>
        <h3 className="text-base font-semibold text-nf-text-main">Money Coach</h3>
      </div>

      <div className="space-y-3">
        {nudges.map((nudge, idx) => {
          const Icon = nudge.icon;
          return (
            <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-nf-bg-card-subtle">
              <Icon className="h-4 w-4 text-nf-primary mt-0.5 flex-shrink-0" />
              <p className="text-sm text-nf-text-main">{nudge.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

