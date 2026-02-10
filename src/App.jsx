import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

// Import Pages
import Login from './pages/Login';
import Home from './pages/Home';
import InputData from './pages/InputData';
import Rekapan from './pages/Rekapan';
import Profile from './pages/Profile';
import Dompet from './pages/Dompet';

// --- IMPORT FILE ASLI BOS (BUKAN PLACEHOLDER) ---
import Budgeting from './pages/Budgeting';      // Sesuai nama file Bos
import Subscriptions from './pages/Subscriptions'; // Sesuai nama file Bos
import Categories from './pages/Categories';    // File baru tadi

import Navbar from './components/Navbar';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null; 
  return user ? children : <Navigate to="/login" />;
}

function Layout({ children }) {
    const { user } = useAuth();
    return (
        <>
            {user && <Navbar />}
            {children}
        </>
    )
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster position="top-center" reverseOrder={false} />
        <Layout>
            <Routes>
                <Route path="/login" element={<Login />} />
                
                {/* Protected Routes */}
                <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
                <Route path="/input" element={<PrivateRoute><InputData /></PrivateRoute>} />
                <Route path="/rekap" element={<PrivateRoute><Rekapan /></PrivateRoute>} />
                <Route path="/wallet" element={<PrivateRoute><Dompet /></PrivateRoute>} />
                <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
                
                {/* --- SAMBUNGKAN KE FILE ASLI --- */}
                <Route path="/budget" element={<PrivateRoute><Budgeting /></PrivateRoute>} />
                <Route path="/subscription" element={<PrivateRoute><Subscriptions /></PrivateRoute>} />
                <Route path="/categories" element={<PrivateRoute><Categories /></PrivateRoute>} />
            </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}