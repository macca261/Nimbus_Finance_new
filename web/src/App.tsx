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

const Budgets = () => (
  <ComingSoon title="Budgets" description="Plane deine Ausgaben und verfolge Budgetziele." />
);

const Goals = () => <ComingSoon title="Goals" description="Setze dir Ziele und beobachte deinen Fortschritt." />;

const Accounts = () => <AccountsPage />;

const Insights = () => <ComingSoon title="Insights" description="Intelligente Analysen und Reports folgen bald." />;

const Settings = () => <ComingSoon title="Settings" description="Passe Nimbus Finance an deine Bedürfnisse an." />;

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/imports" element={<ImportsPage />} />
        <Route path="/budgets" element={<Budgets />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/insights" element={<Insights />} />
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
