import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

import NavbarV3 from './components/NavbarV3';
import AppErrorBoundary from './components/AppErrorBoundary';
import NetworkStatus from './components/NetworkStatus';
import PwaInstallPrompt from './components/PwaInstallPrompt';
import MonthlyBackupReminder from './components/MonthlyBackupReminder';

const LoginV3 = lazy(() => import('./pages/LoginV3'));
const HomeV37 = lazy(() => import('./pages/HomeV37'));
const ForecastV33 = lazy(() => import('./pages/ForecastV33'));
const SpendingInsightsV36 = lazy(() => import('./pages/SpendingInsightsV36'));
const InputDataV36 = lazy(() => import('./pages/InputDataV36'));
const RekapanV37 = lazy(() => import('./pages/RekapanV37'));
const ProfileV3 = lazy(() => import('./pages/ProfileV3'));
const DompetV35 = lazy(() => import('./pages/DompetV35'));
const TransferV35 = lazy(() => import('./pages/TransferV35'));
const CalendarV32 = lazy(() => import('./pages/CalendarV32'));
const RecurringV32 = lazy(() => import('./pages/RecurringV32'));
const BudgetingV31 = lazy(() => import('./pages/BudgetingV31'));
const SubscriptionsV3 = lazy(() => import('./pages/SubscriptionsV3'));
const CategoriesV3 = lazy(() => import('./pages/CategoriesV3'));
const SavingsV3 = lazy(() => import('./pages/SavingsV3'));
const PlanningV36 = lazy(() => import('./pages/PlanningV36'));
const AutomationRulesV35 = lazy(() => import('./pages/AutomationRulesV35'));
const ReconciliationV35 = lazy(() => import('./pages/ReconciliationV35'));
const TrashV35 = lazy(() => import('./pages/TrashV35'));
const SinkingFundsV36 = lazy(() => import('./pages/SinkingFundsV36'));
const DebtsV36 = lazy(() => import('./pages/DebtsV36'));
const NetWorthV36 = lazy(() => import('./pages/NetWorthV36'));
const MoneyTagsV36 = lazy(() => import('./pages/MoneyTagsV36'));
const InboxV36 = lazy(() => import('./pages/InboxV36'));
const FinancialNotesV36 = lazy(() => import('./pages/FinancialNotesV36'));
const NotFound = lazy(() => import('./pages/NotFound'));

const PLANNING_SUBROUTES = [
  '/budget',
  '/subscription',
  '/recurring',
  '/calendar',
  '/forecast',
  '/insights',
  '/inbox',
  '/rules',
  '/tags',
  '/reconcile',
  '/trash',
  '/savings',
  '/sinking-funds',
  '/debts',
  '/net-worth',
  '/notes',
  '/categories',
];

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
  const isPlanningSubroute = PLANNING_SUBROUTES.includes(location.pathname);

  return (
    <div className="liquid-app">
      <NetworkStatus />
      {user && !authScreen && <NavbarV3 />}
      {user && !authScreen && isPlanningSubroute && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 md:pt-28">
          <div className="flex items-center gap-2">
            <Link
              to="/planning"
              className="liquid-nav-pill inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white transition-colors"
            >
              <ArrowLeft size={14} /> Kembali ke Planning
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-medium text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              <Home size={13} /> Dashboard
            </Link>
          </div>
        </div>
      )}
      <div className={user && !authScreen && isPlanningSubroute ? 'lf-subroute-shell' : ''}>
        <Suspense fallback={<LoadingScreen />}>
          {children}
        </Suspense>
      </div>
      {user && !authScreen && <PwaInstallPrompt />}
      {user && !authScreen && <MonthlyBackupReminder />}
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

                <Route path="/" element={<PrivateRoute><HomeV37 /></PrivateRoute>} />
                <Route path="/forecast" element={<PrivateRoute><ForecastV33 /></PrivateRoute>} />
                <Route path="/insights" element={<PrivateRoute><SpendingInsightsV36 /></PrivateRoute>} />
                <Route path="/input" element={<PrivateRoute><InputDataV36 /></PrivateRoute>} />
                <Route path="/rekap" element={<PrivateRoute><RekapanV37 /></PrivateRoute>} />
                <Route path="/wallet" element={<PrivateRoute><DompetV35 /></PrivateRoute>} />
                <Route path="/transfer" element={<PrivateRoute><TransferV35 /></PrivateRoute>} />
                <Route path="/calendar" element={<PrivateRoute><CalendarV32 /></PrivateRoute>} />
                <Route path="/recurring" element={<PrivateRoute><RecurringV32 /></PrivateRoute>} />
                <Route path="/profile" element={<PrivateRoute><ProfileV3 /></PrivateRoute>} />
                <Route path="/planning" element={<PrivateRoute><PlanningV36 /></PrivateRoute>} />
                <Route path="/rules" element={<PrivateRoute><AutomationRulesV35 /></PrivateRoute>} />
                <Route path="/reconcile" element={<PrivateRoute><ReconciliationV35 /></PrivateRoute>} />
                <Route path="/trash" element={<PrivateRoute><TrashV35 /></PrivateRoute>} />
                <Route path="/inbox" element={<PrivateRoute><InboxV36 /></PrivateRoute>} />
                <Route path="/tags" element={<PrivateRoute><MoneyTagsV36 /></PrivateRoute>} />
                <Route path="/sinking-funds" element={<PrivateRoute><SinkingFundsV36 /></PrivateRoute>} />
                <Route path="/debts" element={<PrivateRoute><DebtsV36 /></PrivateRoute>} />
                <Route path="/net-worth" element={<PrivateRoute><NetWorthV36 /></PrivateRoute>} />
                <Route path="/notes" element={<PrivateRoute><FinancialNotesV36 /></PrivateRoute>} />
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
