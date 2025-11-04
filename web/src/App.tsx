import { Routes, Route, Navigate } from "react-router-dom";
import AppShell from "./components/AppShell/AppShell";
import Dashboard from "./pages/Dashboard";
import Import from "./pages/Import";
import { ToastContainer } from "./lib/toast";

export default function App() {
  return (
    <>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/overview" element={<Navigate to="/" replace />} />
          <Route path="/transactions" element={<div style={{padding:24}}>Transactions (todo)</div>} />
          <Route path="/goals" element={<div style={{padding:24}}>Goals (todo)</div>} />
          <Route path="/categories" element={<div style={{padding:24}}>Categories (todo)</div>} />
          <Route path="/import" element={<Import />} />
          <Route path="/settings" element={<div style={{padding:24}}>Settings (todo)</div>} />
        </Routes>
      </AppShell>
      <ToastContainer />
    </>
  );
}


