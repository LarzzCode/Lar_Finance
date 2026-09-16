import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

import LoginV2 from './pages/LoginV2';
import HomeV2 from './pages/HomeV2';
import InputDataSecure from './pages/InputDataSecure';
import RekapanV2 from './pages/RekapanV2';
import ProfileV2 from './pages/ProfileV2';
import DompetSecure from './pages/DompetSecure';
import BudgetingV2 from './pages/BudgetingV2';
import SubscriptionsSecure from './pages/SubscriptionsSecure';
import CategoriesSecure from './pages/CategoriesSecure';
import SavingsV2 from './pages/SavingsV2';
import Planning from './pages/Planning';
import NotFound from './pages/NotFound';

import NavbarV2 from './components/NavbarV2';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-[3px] border-slate-200 border-t-slate-950 animate-spin" />
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
}

function AppLayout({ children }) {
  const { user } = useAuth();
  return (
    <>
      {user && <NavbarV2 />}
      {children}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
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

            <Route path="/" element={<PrivateRoute><HomeV2 /></PrivateRoute>} />
            <Route path="/input" element={<PrivateRoute><InputDataSecure /></PrivateRoute>} />
            <Route path="/rekap" element={<PrivateRoute><RekapanV2 /></PrivateRoute>} />
            <Route path="/wallet" element={<PrivateRoute><DompetSecure /></PrivateRoute>} />
            <Route path="/profile" element={<PrivateRoute><ProfileV2 /></PrivateRoute>} />

            <Route path="/planning" element={<PrivateRoute><Planning /></PrivateRoute>} />
            <Route path="/budget" element={<PrivateRoute><BudgetingV2 /></PrivateRoute>} />
            <Route path="/subscription" element={<PrivateRoute><SubscriptionsSecure /></PrivateRoute>} />
            <Route path="/savings" element={<PrivateRoute><SavingsV2 /></PrivateRoute>} />
            <Route path="/categories" element={<PrivateRoute><CategoriesSecure /></PrivateRoute>} />

            <Route path="*" element={<PrivateRoute><NotFound /></PrivateRoute>} />
          </Routes>
        </AppLayout>
      </Router>
    </AuthProvider>
  );
}
