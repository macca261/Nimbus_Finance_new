import React from "react";
import AppLayout from "../components/layout/AppLayout";
import { KpiCard } from "../components/ui/KpiCard";
import { Section } from "../components/ui/Card";
import { MonthlyAreaChart } from "../components/dashboard/MonthlyAreaChart";
import { TransactionsTable } from "../components/dashboard/TransactionsTable";
import { TopCategoriesList } from "../components/dashboard/TopCategoriesList";
import { getBalance, getMonthly, getCategories, getTransactions, getAchievements } from "../lib/api";
import { formatEuro } from "../lib/format";
import { Link } from "react-router-dom";

export default function Overview() {
  const [balance, setBalance] = React.useState<{ data?: { balanceCents: number } }>({});
  const [monthly, setMonthly] = React.useState<{ data?: any[] }>({});
  const [categories, setCategories] = React.useState<{ data?: any[] }>({});
  const [transactions, setTransactions] = React.useState<{ data?: any[] }>({});
  const [achievements, setAchievements] = React.useState<{ data?: any }>({});

  React.useEffect(() => {
    (async () => {
      try {
        setBalance(await getBalance());
      } catch {}
      try {
        setMonthly(await getMonthly());
      } catch {}
      try {
        setCategories(await getCategories());
      } catch {}
      try {
        setTransactions(await getTransactions(10));
      } catch {}
      try {
        setAchievements(await getAchievements());
      } catch {}
    })();
  }, []);

  const monthlyData = monthly?.data ?? [];
  const catRows = categories?.data ?? [];
  const txRows = transactions?.data ?? [];

  const thisMonth = monthlyData[monthlyData.length - 1] ?? { incomeCents: 0, expenseCents: 0 };
  const kpis = [
    { label: "Saldo gesamt", value: formatEuro(balance?.data?.balanceCents ?? 0) },
    { label: "Einnahmen (akt. Monat)", value: formatEuro(thisMonth.incomeCents ?? 0) },
    { label: "Ausgaben (akt. Monat)", value: formatEuro(thisMonth.expenseCents ?? 0) },
    { label: "CSV-Importe", value: `${(txRows?.length ?? 0)} / 10 angezeigt`, hint: "siehe Transaktionen" },
  ];

  return (
    <AppLayout>
      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map(k => <KpiCard key={k.label} label={k.label} value={k.value} hint={k.hint} />)}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
        {/* Chart (2 cols) */}
        <Section title="Monatsüberblick (6M)" subtitle="Einnahmen vs Ausgaben">
          <MonthlyAreaChart series={monthlyData.slice(-6)} />
        </Section>

        {/* Top categories (1 col) */}
        <Section title="Top Kategorien" subtitle="Nach Ausgaben">
          <TopCategoriesList rows={catRows} />
        </Section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Recent transactions (2 cols) */}
        <Section
          title="Letzte Buchungen"
          right={<Link to="/transactions" className="text-sm text-indigo-600 hover:underline">Alle anzeigen</Link>}
        >
          <TransactionsTable rows={txRows ?? []} />
        </Section>

        {/* Goals / achievements (1 col) */}
        <Section title="Erfolge" subtitle="Ziele & Fortschritt">
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            {/* Render achievements when hooked in */}
            {achievements?.data ? (
              <pre className="text-xs overflow-auto">{JSON.stringify(achievements.data, null, 2)}</pre>
            ) : (
              "Noch keine Erfolge ermittelt."
            )}
          </div>
        </Section>
      </div>

      {/* Upload CTA */}
      <div className="mt-6">
        <Section title="Schnellstart">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Lade eine Konto-CSV hoch (Comdirect & Sparkasse bereits unterstützt). Mehr Banken & Formate folgen.
            </p>
            <Link to="/upload" className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700">
              CSV hochladen
            </Link>
          </div>
        </Section>
      </div>
    </AppLayout>
  );
}

