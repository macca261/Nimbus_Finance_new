import React from 'react';
import type { Achievement } from '../../../types/achievements';
import { CheckCircle2, Lock, TrendingUp } from 'lucide-react';

interface AchievementCardProps {
  achievement: Achievement;
}

export const AchievementCard: React.FC<AchievementCardProps> = ({ achievement }) => {
  const { status, progress, title, description } = achievement;

  const statusConfig = {
    locked: {
      icon: Lock,
      iconColor: 'text-nf-text-muted',
      bgColor: 'bg-nf-bg-card-subtle',
      borderColor: 'border-nf-border-subtle',
      textColor: 'text-nf-text-muted',
      progressColor: 'bg-nf-bg-card-subtle',
    },
    in_progress: {
      icon: TrendingUp,
      iconColor: 'text-nf-primary',
      bgColor: 'bg-nf-primary-soft',
      borderColor: 'border-nf-primary/30',
      textColor: 'text-nf-text-main',
      progressColor: 'bg-nf-primary',
    },
    completed: {
      icon: CheckCircle2,
      iconColor: 'text-nf-positive',
      bgColor: 'bg-nf-positive/10',
      borderColor: 'border-nf-positive/30',
      textColor: 'text-nf-text-main',
      progressColor: 'bg-nf-positive',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  const getProgressText = () => {
    if (status === 'completed') {
      return 'Abgeschlossen! 🎉';
    }
    if (status === 'locked') {
      return 'Noch gesperrt';
    }
    const remaining = 100 - progress;
    if (remaining <= 5) {
      return `Noch ${Math.ceil(remaining)}% bis zum Erfolg!`;
    }
    if (remaining <= 20) {
      return `Noch ${Math.ceil(remaining)}% – du schaffst das! 💪`;
    }
    return `${progress}% erreicht`;
  };

  return (
    <div
      className={`group relative rounded-3xl border ${config.borderColor} ${config.bgColor} p-6 shadow-elevated transition-all hover:-translate-y-[1px] hover:shadow-xl`}
    >
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 rounded-full p-3 ${config.bgColor} border ${config.borderColor}`}>
          <Icon className={`h-6 w-6 ${config.iconColor}`} />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className={`text-base font-semibold mb-1 ${config.textColor}`}>{title}</h3>
          <p className="text-xs text-nf-text-muted mb-4 line-clamp-2">{description}</p>

          {status !== 'locked' && (
            <div className="space-y-2">
              <div className="h-2 bg-nf-bg-card-subtle rounded-full overflow-hidden">
                <div
                  className={`h-full ${config.progressColor} transition-all`}
                  style={{ width: `${Math.min(100, progress)}%` }}
                />
              </div>
              <p className="text-xs text-nf-text-muted">{getProgressText()}</p>
            </div>
          )}

          {status === 'locked' && (
            <p className="text-xs text-nf-text-muted">Erfolg noch nicht freigeschaltet</p>
          )}
        </div>
      </div>
    </div>
  );
};

