import React, { useState } from 'react';
import { AppShell } from '../../layout/AppShell';
import RulesTable from '../../features/normalizer/RulesTable';
import RuleTester from '../../features/normalizer/RuleTester';
import PreviewCard from '../../features/normalizer/PreviewCard';

export interface NormalizerConsoleProps {
  breadcrumb?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  banner?: React.ReactNode;
}

export const NormalizerConsole: React.FC<NormalizerConsoleProps> = ({
  breadcrumb,
  title,
  description,
  banner,
}) => {
  const [highlightRuleId, setHighlightRuleId] = useState<string | null>(null);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="space-y-1.5">
        {breadcrumb ?? (
          <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-300">Admin</p>
        )}
        {title ?? (
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">Normalizer</h1>
        )}
        {description ?? (
          <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Verwalte Regeln, die Händlernamen vereinheitlichen und optionale Kategorie-Hinweise vorschlagen.
          </p>
        )}
      </header>

      {banner}

      <div className="grid gap-6 lg:grid-cols-[1.75fr_1fr]">
        <section className="rounded-2xl border border-slate-200/80 bg-white/60 p-6 text-sm shadow-sm dark:border-slate-800/70 dark:bg-slate-900/60">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Regeln</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Verwalte Normalizer-Regeln, priorisiere Treffer und halte Händlernamen konsistent.
            </p>
          </div>
          <RulesTable highlightRuleId={highlightRuleId} />
        </section>
        <div className="flex flex-col gap-6">
          <RuleTester onMatch={setHighlightRuleId} />
          <PreviewCard
            text="UBER BV F1234 AMSTERDAM NL"
            counterparty="Uber BV"
            amountCents={-1190}
            currency="EUR"
            bookingDate="2025-01-12"
          />
        </div>
      </div>
    </div>
  );
};

export const NormalizerAdminPage: React.FC = () => (
  <AppShell>
    <NormalizerConsole />
  </AppShell>
);

export default NormalizerAdminPage;

