import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

import Login from './pages/Login';
import HomeV2 from './pages/HomeV2';
import InputData from './pages/InputData';
import Rekapan from './pages/Rekapan';
import Profile from './pages/Profile';
import Dompet from './pages/Dompet';
import Budgeting from './pages/Budgeting';
import Subscriptions from './pages/Subscriptions';
import Categories from './pages/Categories';
import Savings from './pages/Savings';
import Planning from './pages/Planning';
import NotFound from './pages/NotFound';

import NavbarV2 from './components/NavbarV2';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
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
            },
          }}
        />

        <AppLayout>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/" element={<PrivateRoute><HomeV2 /></PrivateRoute>} />
            <Route path="/input" element={<PrivateRoute><InputData /></PrivateRoute>} />
            <Route path="/rekap" element={<PrivateRoute><Rekapan /></PrivateRoute>} />
            <Route path="/wallet" element={<PrivateRoute><Dompet /></PrivateRoute>} />
            <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />

            <Route path="/planning" element={<PrivateRoute><Planning /></PrivateRoute>} />
            <Route path="/budget" element={<PrivateRoute><Budgeting /></PrivateRoute>} />
            <Route path="/subscription" element={<PrivateRoute><Subscriptions /></PrivateRoute>} />
            <Route path="/savings" element={<PrivateRoute><Savings /></PrivateRoute>} />
            <Route path="/categories" element={<PrivateRoute><Categories /></PrivateRoute>} />

            <Route path="*" element={<PrivateRoute><NotFound /></PrivateRoute>} />
          </Routes>
        </AppLayout>
      </Router>
    </AuthProvider>
  );
}
