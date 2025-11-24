import React from 'react';
import { AppShell } from '../layout/AppShell';
import { WalletOverview } from '../components/wallet/WalletOverview';

const SHELL_CLASS = 'mx-auto w-full max-w-[1680px] px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12';

export default function WalletPage() {
  return (
    <AppShell>
      <main className="flex-1 pb-10">
        <section className={SHELL_CLASS + ' space-y-5'}>
          <header className="flex items-baseline justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-nf-text-main">Wallet</h1>
              <p className="mt-1 text-sm text-nf-text-muted">
                Deine Konten, Karten und anstehenden Zahlungen auf einen Blick.
              </p>
            </div>
          </header>
          <WalletOverview />
          {/* Optional later: detailed accounts table, timeline, etc. */}
        </section>
      </main>
    </AppShell>
  );
}

