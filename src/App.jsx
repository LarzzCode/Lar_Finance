import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

import LoginV2 from './pages/LoginV2';
import HomeV3 from './pages/HomeV3';
import InputDataV3 from './pages/InputDataV3';
import RekapanV3 from './pages/RekapanV3';
import ProfileV3 from './pages/ProfileV3';
import DompetV3 from './pages/DompetV3';
import BudgetingV22 from './pages/BudgetingV22';
import SubscriptionsV22 from './pages/SubscriptionsV22';
import CategoriesV22 from './pages/CategoriesV22';
import SavingsV2 from './pages/SavingsV2';
import PlanningV3 from './pages/PlanningV3';
import NotFound from './pages/NotFound';

import NavbarV3 from './components/NavbarV3';
import AppErrorBoundary from './components/AppErrorBoundary';
import NetworkStatus from './components/NetworkStatus';
import PwaInstallPrompt from './components/PwaInstallPrompt';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="liquid-nav rounded-[1.75rem] px-8 py-7 text-center">
          <div className="w-9 h-9 mx-auto rounded-full border-[2px] border-slate-300/70 border-t-slate-700 dark:border-slate-600 dark:border-t-white animate-spin" />
          <p className="text-[11px] font-medium text-slate-500 mt-4 tracking-wide">Menyiapkan Lar Finance</p>
        </div>
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
}

function AppLayout({ children }) {
  const { user } = useAuth();
  return (
    <div className="liquid-app">
      <NetworkStatus />
      {user && <NavbarV3 />}
      {children}
      {user && <PwaInstallPrompt />}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppErrorBoundary>
          <Router>
            <Toaster
              position="top-center"
              reverseOrder={false}
              toastOptions={{
                duration: 3200,
                style: {
                  borderRadius: '18px',
                  background: 'rgba(15,23,42,.88)',
                  color: '#fff',
                  fontWeight: 500,
                  fontSize: '13px',
                  padding: '12px 16px',
                  backdropFilter: 'blur(18px)',
                  border: '1px solid rgba(255,255,255,.10)',
                  boxShadow: '0 18px 50px rgba(15,23,42,.18)',
                },
              }}
            />

            <AppLayout>
              <Routes>
                <Route path="/login" element={<LoginV2 />} />
                <Route path="/" element={<PrivateRoute><HomeV3 /></PrivateRoute>} />
                <Route path="/input" element={<PrivateRoute><InputDataV3 /></PrivateRoute>} />
                <Route path="/rekap" element={<PrivateRoute><RekapanV3 /></PrivateRoute>} />
                <Route path="/wallet" element={<PrivateRoute><DompetV3 /></PrivateRoute>} />
                <Route path="/profile" element={<PrivateRoute><ProfileV3 /></PrivateRoute>} />
                <Route path="/planning" element={<PrivateRoute><PlanningV3 /></PrivateRoute>} />
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
    </ThemeProvider>
  );
}
