import React from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../../layout/AppShell';
import { NormalizerConsole } from '../admin/NormalizerAdminPage';

const SettingsNormalizer: React.FC = () => {
  return (
    <AppShell>
      <NormalizerConsole
        breadcrumb={
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Settings / Normalizer (Admin)
          </p>
        }
        title={<h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">Normalizer</h1>}
        description={
          <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            This view reuses the Admin Normalizer console.
          </p>
        }
        banner={
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 p-4 text-sm text-amber-800 shadow-sm dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
            <p>You're viewing the Admin Normalizer console. Changes here affect the import pipeline.</p>
            <Link
              to="/admin/normalizer"
              className="mt-2 inline-flex text-xs font-semibold text-amber-800 underline hover:text-amber-900 dark:text-amber-200 dark:hover:text-amber-100"
            >
              Go to Admin Normalizer
            </Link>
          </div>
        }
      />
    </AppShell>
  );
};

export default SettingsNormalizer;


