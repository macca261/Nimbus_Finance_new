import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { Transactions } from './pages/Transactions';
import { ComingSoon } from './pages/ComingSoon';
import AccountsPage from './pages/Accounts';
import { ImportsPage } from './pages/Imports';
import { NormalizerAdminPage } from './pages/admin/NormalizerAdminPage';
import AdminImports from './pages/admin/AdminImports';
import SettingsNormalizer from './pages/settings/SettingsNormalizer';
import ReviewPage from './pages/Review';
import SonstigesCleanupPage from './pages/SonstigesCleanup';
import { Insights } from './pages/Insights';
import WalletPage from './pages/Wallet';
import { BudgetOverviewPage } from './features/budgets/components/BudgetOverviewPage';
import { GoalsOverviewPage } from './features/goals/components/GoalsOverviewPage';
import { Achievements } from './pages/Achievements';
import { ToastContainer } from './lib/toast';

const Budgets = () => <BudgetOverviewPage />;

const Goals = () => <GoalsOverviewPage />;

const Accounts = () => <AccountsPage />;


const Settings = () => <ComingSoon title="Settings" description="Passe Nimbus Finance an deine Bedürfnisse an." />;

function App() {
  return (
    <BrowserRouter>
      <ToastContainer />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/imports" element={<ImportsPage />} />
        <Route path="/budgets" element={<Budgets />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/achievements" element={<Achievements />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/normalizer" element={<SettingsNormalizer />} />
        <Route path="/admin/normalizer" element={<NormalizerAdminPage />} />
        <Route path="/admin/imports" element={<AdminImports />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/review/sonstiges" element={<SonstigesCleanupPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
