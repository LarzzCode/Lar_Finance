import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

import LoginV3 from './pages/LoginV3';
import HomeV33 from './pages/HomeV33';
import ForecastV33 from './pages/ForecastV33';
import SpendingInsightsV34 from './pages/SpendingInsightsV34';
import InputDataV31 from './pages/InputDataV31';
import RekapanV3 from './pages/RekapanV3';
import ProfileV3 from './pages/ProfileV3';
import DompetV31 from './pages/DompetV31';
import TransferV31 from './pages/TransferV31';
import CalendarV32 from './pages/CalendarV32';
import RecurringV32 from './pages/RecurringV32';
import BudgetingV31 from './pages/BudgetingV31';
import SubscriptionsV3 from './pages/SubscriptionsV3';
import CategoriesV3 from './pages/CategoriesV3';
import SavingsV3 from './pages/SavingsV3';
import PlanningV3 from './pages/PlanningV3';
import NotFound from './pages/NotFound';

import NavbarV3 from './components/NavbarV3';
import AppErrorBoundary from './components/AppErrorBoundary';
import NetworkStatus from './components/NetworkStatus';
import PwaInstallPrompt from './components/PwaInstallPrompt';

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="liquid-nav rounded-[1.75rem] px-8 py-7 text-center">
        <div className="w-9 h-9 mx-auto rounded-full border-[2px] border-slate-300/70 border-t-slate-700 dark:border-slate-600 dark:border-t-white animate-spin" />
        <p className="text-[11px] font-medium text-slate-500 mt-4 tracking-wide">Menyiapkan Lar Finance</p>
      </div>
    </div>
  );
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? children : <Navigate to="/login" replace />;
}

function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? <Navigate to="/" replace /> : children;
}

function AppLayout({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const authScreen = ['/login', '/register', '/forgot-password', '/reset-password'].includes(location.pathname);

  return (
    <div className="liquid-app">
      <NetworkStatus />
      {user && !authScreen && <NavbarV3 />}
      {children}
      {user && !authScreen && <PwaInstallPrompt />}
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
                <Route path="/login" element={<PublicOnlyRoute><LoginV3 /></PublicOnlyRoute>} />
                <Route path="/register" element={<PublicOnlyRoute><LoginV3 /></PublicOnlyRoute>} />
                <Route path="/forgot-password" element={<PublicOnlyRoute><LoginV3 /></PublicOnlyRoute>} />
                <Route path="/reset-password" element={<LoginV3 />} />

                <Route path="/" element={<PrivateRoute><HomeV33 /></PrivateRoute>} />
                <Route path="/forecast" element={<PrivateRoute><ForecastV33 /></PrivateRoute>} />
                <Route path="/insights" element={<PrivateRoute><SpendingInsightsV34 /></PrivateRoute>} />
                <Route path="/input" element={<PrivateRoute><InputDataV31 /></PrivateRoute>} />
                <Route path="/rekap" element={<PrivateRoute><RekapanV3 /></PrivateRoute>} />
                <Route path="/wallet" element={<PrivateRoute><DompetV31 /></PrivateRoute>} />
                <Route path="/transfer" element={<PrivateRoute><TransferV31 /></PrivateRoute>} />
                <Route path="/calendar" element={<PrivateRoute><CalendarV32 /></PrivateRoute>} />
                <Route path="/recurring" element={<PrivateRoute><RecurringV32 /></PrivateRoute>} />
                <Route path="/profile" element={<PrivateRoute><ProfileV3 /></PrivateRoute>} />
                <Route path="/planning" element={<PrivateRoute><PlanningV3 /></PrivateRoute>} />
                <Route path="/budget" element={<PrivateRoute><BudgetingV31 /></PrivateRoute>} />
                <Route path="/subscription" element={<PrivateRoute><SubscriptionsV3 /></PrivateRoute>} />
                <Route path="/savings" element={<PrivateRoute><SavingsV3 /></PrivateRoute>} />
                <Route path="/categories" element={<PrivateRoute><CategoriesV3 /></PrivateRoute>} />
                <Route path="*" element={<PrivateRoute><NotFound /></PrivateRoute>} />
              </Routes>
            </AppLayout>
          </Router>
        </AppErrorBoundary>
      </AuthProvider>
    </ThemeProvider>
  );
}
