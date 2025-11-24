import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_ACHIEVEMENTS = [
  {
    key: 'first_import',
    title: 'Erster CSV-Import 🎉',
    description: 'Du hast deine erste CSV-Datei importiert.',
    type: 'import',
  },
  {
    key: 'transactions_50',
    title: '50 Buchungen',
    description: 'Du hast 50 Transaktionen importiert.',
    type: 'import',
  },
  {
    key: 'transactions_500',
    title: '500 Buchungen',
    description: 'Du hast 500 Transaktionen importiert.',
    type: 'import',
  },
  {
    key: 'streak_7',
    title: '7 Tage in Folge aktiv',
    description: 'Mindestens 7 aufeinanderfolgende Tage mit Buchungen.',
    type: 'streak',
  },
  {
    key: 'streak_30',
    title: '30 Tage in Folge aktiv',
    description: 'Mindestens 30 aufeinanderfolgende Tage mit Buchungen.',
    type: 'streak',
  },
  {
    key: 'first_budget',
    title: 'Erstes Budget erstellt',
    description: 'Du hast dein erstes Budget erstellt.',
    type: 'budget',
  },
  {
    key: 'budget_3_months',
    title: 'Budget unter Kontrolle',
    description: 'Du hast 3 Monate in Folge Budgets erstellt.',
    type: 'budget',
  },
  {
    key: 'first_goal',
    title: 'Erstes Ziel gesetzt',
    description: 'Du hast dein erstes Ziel erstellt.',
    type: 'goal',
  },
  {
    key: 'goals_5_progress_50',
    title: 'Zielstrebig',
    description: '5 Ziele haben mindestens 50% Fortschritt.',
    type: 'goal',
  },
  {
    key: 'reimbursements_10',
    title: '10 Erstattungen geprüft',
    description: 'Du hast 10 Erstattungen geprüft.',
    type: 'reimbursement',
  },
  {
    key: 'monthly_saver_500',
    title: 'Sparer · 500 €',
    description: 'Einnahmen minus Ausgaben liegt bei mindestens 500 € im letzten Monat.',
    type: 'streak',
  },
];

async function seed() {
  console.log('Seeding achievements...');

  for (const achievement of DEFAULT_ACHIEVEMENTS) {
    const existing = await prisma.achievement.findUnique({
      where: { key: achievement.key },
    });

    if (existing) {
      console.log(`  ✓ Achievement "${achievement.key}" already exists, skipping`);
      continue;
    }

    await prisma.achievement.create({
      data: achievement,
    });

    console.log(`  ✓ Created achievement: ${achievement.key} - ${achievement.title}`);
  }

  console.log('Seeding complete!');
}

seed()
  .catch((e) => {
    console.error('Error seeding achievements:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

