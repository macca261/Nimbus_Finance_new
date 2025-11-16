import React from 'react';
import { PiggyBank, Trophy, Sparkles } from 'lucide-react';
import { formatCurrency } from '../../lib/format';
import type { Achievement } from '../../hooks/useDashboardData';

const EMERGENCY_FUND_TARGET = 3000;

type GoalsSectionProps = {
  currentBalance: number;
  achievements: Achievement[];
  cashflowByMonth: Array<{ month: string; income: number; expenses: number }>;
};

export const GoalsSection: React.FC<GoalsSectionProps> = ({
  currentBalance,
  achievements,
  cashflowByMonth,
}) => {
  const achieved = achievements.filter(item => item.achieved);
  const latestCashflow = cashflowByMonth.slice(-3);
  const positiveMonths = latestCashflow.filter(month => month.income - month.expenses > 0).length;

  const emergencyProgress = Math.max(0, Math.min(1, currentBalance / EMERGENCY_FUND_TARGET));
  const emergencyPercent = Math.round(emergencyProgress * 100);

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-6">
      <h3 className="mb-4 text-base font-medium text-slate-900 dark:text-slate-100 md:text-lg">
        Ziele & Fortschritt
      </h3>

      <div className="space-y-6">
        {/* Notgroschen */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <PiggyBank className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Notgroschen</span>
          </div>
          <div className="mb-2">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>Ziel: {formatCurrency(EMERGENCY_FUND_TARGET)}</span>
              <span className="tabular-nums font-medium">{emergencyPercent}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full bg-indigo-600 transition-all dark:bg-indigo-500"
                style={{ width: `${emergencyPercent}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Fortschritt: {formatCurrency(currentBalance)} von {formatCurrency(EMERGENCY_FUND_TARGET)}
          </p>
        </div>

        {/* Monate im Plus */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {positiveMonths}/3 Monate im Plus
            </span>
          </div>
          <div className="mb-2 flex items-center gap-2">
            {[1, 2, 3].map(month => {
              const isPositive = month <= positiveMonths;
              return (
                <div
                  key={month}
                  className={`h-8 flex-1 rounded-lg ${
                    isPositive
                      ? 'bg-indigo-600 dark:bg-indigo-500'
                      : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                />
              );
            })}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {positiveMonths >= 3
              ? 'Fantastisch! Drei Monate hintereinander im positiven Bereich.'
              : 'Du bist auf Kurs – plane deine Ausgaben für einen positiven Monat.'}
          </p>
        </div>

        {/* Erste Auszeichnung */}
        {achieved.length === 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Erste Auszeichnung sichern
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Halte Gebühren gering und bleib unter deinem Budget.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

