import { Link, Route, Routes, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Upload from './pages/Upload';
import UploadCSVPage from './pages/UploadCSV';
import TransactionsPage from './pages/Transactions';
import ReviewPage from './pages/Review';
import Dashboard from './pages/Dashboard';
import ConnectionsPage from './pages/Connections';
import ReportsPage from './pages/Reports';

function isAuthed() {
  return Boolean(localStorage.getItem('token'));
}

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-semibold text-primary-500">Nimbus Finance</Link>
          <nav className="flex gap-4">
            {isAuthed() ? (
              <>
                <Link to="/upload" className="text-gray-700 hover:text-primary-500">Upload CSV</Link>
                <Link to="/connections" className="text-gray-700 hover:text-primary-500">Connections</Link>
                <button className="btn" onClick={() => { localStorage.removeItem('token'); location.href = '/login'; }}>Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-gray-700 hover:text-primary-500">Login</Link>
                <Link to="/signup" className="text-gray-700 hover:text-primary-500">Sign up</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<Navigate to={isAuthed() ? '/upload' : '/login'} replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/upload" element={isAuthed() ? <UploadCSVPage /> : <Navigate to="/login" replace />} />
          <Route path="/dashboard" element={isAuthed() ? <Dashboard /> : <Navigate to="/login" replace />} />
          <Route path="/reports" element={isAuthed() ? <ReportsPage /> : <Navigate to="/login" replace />} />
          <Route path="/transactions" element={isAuthed() ? <TransactionsPage /> : <Navigate to="/login" replace />} />
          <Route path="/review" element={isAuthed() ? <ReviewPage /> : <Navigate to="/login" replace />} />
          <Route path="/connections" element={isAuthed() ? <ConnectionsPage /> : <Navigate to="/login" replace />} />
        </Routes>
      </main>
    </div>
  );
}


