import React from 'react';
import type { DashboardSubscription, Achievement } from '../../hooks/useDashboardData';
import { formatCurrency } from '../../lib/format';
import Card from '../ui/Card';
import { PiggyBank, Trophy, Sparkles, Bot } from 'lucide-react';

type EngagementStripProps = {
  achievements: Achievement[];
  subscriptions: DashboardSubscription[];
  cashflowByMonth: Array<{ month: string; income: number; expenses: number }>;
  currentBalance: number;
};

const EMERGENCY_FUND_TARGET = 3000;

export const EngagementStrip: React.FC<EngagementStripProps> = ({
  achievements,
  subscriptions,
  cashflowByMonth,
  currentBalance,
}) => {
  const subscriptionTotal = subscriptions.reduce((sum, item) => sum + item.averageAmount, 0);
  const achieved = achievements.filter(item => item.achieved);
  const latestCashflow = cashflowByMonth.slice(-3);
  const positiveMonths = latestCashflow.filter(month => month.income - month.expenses > 0).length;

  const cards: EngagementCard[] = [
    {
      icon: <PiggyBank className="h-4 w-4" />,
      title: 'Notgroschen',
      body: buildEmergencyCopy(currentBalance),
      tone: 'emerald',
    },
    {
      icon: <Trophy className="h-4 w-4" />,
      title: achieved.length ? achieved[0].title : 'Erste Auszeichnung sichern',
      body: achieved.length ? achieved[0].description : 'Halte Gebühren gering und bleib unter deinem Budget.',
      tone: achieved.length ? 'amber' : 'slate',
    },
    {
      icon: <Sparkles className="h-4 w-4" />,
      title: `${positiveMonths}/3 Monate im Plus`,
      body:
        positiveMonths >= 3
          ? 'Fantastisch! Drei Monate hintereinander im positiven Bereich.'
          : 'Du bist auf Kurs – plane deine Ausgaben für einen positiven Monat.',
      tone: positiveMonths >= 3 ? 'indigo' : 'slate',
    },
    buildAiTipCard(subscriptionTotal, latestCashflow),
  ];

  return (
    <section className="overflow-hidden">
      <div className="flex gap-4 overflow-x-auto pb-2">
        {cards.map(card => (
          <Card
            key={card.title}
            className={`min-w-[220px] flex-1 border px-4 py-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 ${
              toneClasses[card.tone]
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-current">
              {card.icon}
              {card.title}
            </div>
            <p className="mt-2 text-sm text-current/90">{card.body}</p>
          </Card>
        ))}
      </div>
    </section>
  );
};

type EngagementCard = {
  icon: React.ReactNode;
  title: string;
  body: string;
  tone: 'emerald' | 'amber' | 'indigo' | 'slate';
};

const toneClasses: Record<EngagementCard['tone'], string> = {
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
  amber: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
  indigo:
    'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200',
  slate: 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
};

function buildEmergencyCopy(currentBalance: number) {
  const progress = Math.max(0, Math.min(1, currentBalance / EMERGENCY_FUND_TARGET));
  const percent = Math.round(progress * 100);
  return `Ziel: ${EMERGENCY_FUND_TARGET.toLocaleString('de-DE')} € · Fortschritt ${percent}%`;
}

function buildAiTipCard(totalSubscriptions: number, cashflowByMonth: Array<{ income: number; expenses: number }>): EngagementCard {
  if (totalSubscriptions > 0) {
    return {
      icon: <Bot className="h-4 w-4" />,
      title: 'AI Tip',
      body: `Deine laufenden Abos kosten ${formatCurrency(totalSubscriptions)} pro Monat. Prüfe, ob alles noch genutzt wird.`,
      tone: 'indigo',
    };
  }

  if (cashflowByMonth.length >= 2) {
    const [previous, latest] = [cashflowByMonth.at(-2)!, cashflowByMonth.at(-1)!];
    const delta = latest.expenses - previous.expenses;
    if (delta > 0) {
      return {
        icon: <Bot className="h-4 w-4" />,
        title: 'AI Tip',
        body: `Deine Ausgaben sind um ${formatCurrency(delta)} gestiegen. Setze dir ein Limit für variable Kosten.`,
        tone: 'amber',
      };
    }
  }

  return {
    icon: <Bot className="h-4 w-4" />,
    title: 'AI Tip',
    body: 'Alles im grünen Bereich – halte deine Automatismen bei & plane den nächsten Upload.',
    tone: 'slate',
  };
}


