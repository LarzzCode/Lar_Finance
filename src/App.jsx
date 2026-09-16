import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

import LoginV2 from './pages/LoginV2';
import HomeV22 from './pages/HomeV22';
import InputDataV22 from './pages/InputDataV22';
import RekapanV22 from './pages/RekapanV22';
import ProfileV2 from './pages/ProfileV2';
import DompetV22 from './pages/DompetV22';
import BudgetingV22 from './pages/BudgetingV22';
import SubscriptionsV22 from './pages/SubscriptionsV22';
import CategoriesV22 from './pages/CategoriesV22';
import SavingsV2 from './pages/SavingsV2';
import Planning from './pages/Planning';
import NotFound from './pages/NotFound';

import NavbarV2 from './components/NavbarV2';
import AppErrorBoundary from './components/AppErrorBoundary';
import NetworkStatus from './components/NetworkStatus';
import PwaInstallPrompt from './components/PwaInstallPrompt';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 mx-auto rounded-full border-[3px] border-slate-200 border-t-slate-950 animate-spin" />
          <p className="text-xs font-black text-slate-400 mt-4 uppercase tracking-wider">Menyiapkan Lar Finance</p>
        </div>
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
}

function AppLayout({ children }) {
  const { user } = useAuth();
  return (
    <>
      <NetworkStatus />
      {user && <NavbarV2 />}
      {children}
      {user && <PwaInstallPrompt />}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppErrorBoundary>
        <Router>
          <Toaster
            position="top-center"
            reverseOrder={false}
            toastOptions={{
              duration: 3200,
              style: {
                borderRadius: '16px',
                background: '#0f172a',
                color: '#fff',
                fontWeight: 700,
                fontSize: '13px',
                padding: '12px 16px',
              },
            }}
          />

          <AppLayout>
            <Routes>
              <Route path="/login" element={<LoginV2 />} />

              <Route path="/" element={<PrivateRoute><HomeV22 /></PrivateRoute>} />
              <Route path="/input" element={<PrivateRoute><InputDataV22 /></PrivateRoute>} />
              <Route path="/rekap" element={<PrivateRoute><RekapanV22 /></PrivateRoute>} />
              <Route path="/wallet" element={<PrivateRoute><DompetV22 /></PrivateRoute>} />
              <Route path="/profile" element={<PrivateRoute><ProfileV2 /></PrivateRoute>} />

              <Route path="/planning" element={<PrivateRoute><Planning /></PrivateRoute>} />
              <Route path="/budget" element={<PrivateRoute><BudgetingV22 /></PrivateRoute>} />
              <Route path="/subscription" element={<PrivateRoute><SubscriptionsV22 /></PrivateRoute>} />
              <Route path="/savings" element={<PrivateRoute><SavingsV2 /></PrivateRoute>} />
              <Route path="/categories" element={<PrivateRoute><CategoriesV22 /></PrivateRoute>} />

              <Route path="*" element={<PrivateRoute><NotFound /></PrivateRoute>} />
            </Routes>
          </AppLayout>
        </Router>
      </AppErrorBoundary>
    </AuthProvider>
  );
}
