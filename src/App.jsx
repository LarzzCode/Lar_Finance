import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import InputData from './pages/InputData';
import Rekapan from './pages/Rekapan';
import Budgeting from './pages/Budgeting';
import Wallets from './pages/Wallets';
import Categories from './pages/Categories';
import Login from './pages/Login';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Subscriptions from './pages/Subscriptions';

// Komponen Pembungkus (Satpam) untuk memproteksi halaman
const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="p-4 text-center">Loading auth...</div>;
  if (!user) return <Navigate to="/login" />;
  
  return (
    <>
      <Navbar /> {/* Navbar hanya muncul jika sudah login */}
      {children}
    </>
  );
};

function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen font-sans bg-[#fcfcfc]">
        <Toaster position="top-center" />
        
        <Routes>
          {/* Public Route (Bisa diakses tanpa login) */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes (Harus Login) */}
          {/* Perhatikan: Halaman utama ("/") mengarah ke InputData, BUKAN Dashboard */}
          <Route path="/" element={<PrivateRoute><InputData /></PrivateRoute>} />
          <Route path="/rekapan" element={<PrivateRoute><Rekapan /></PrivateRoute>} />
          <Route path="/budget" element={<PrivateRoute><Budgeting /></PrivateRoute>} />
          <Route path="/categories" element={<PrivateRoute><Categories /></PrivateRoute>} />
          <Route path="/subscriptions" element={<PrivateRoute><Subscriptions /></PrivateRoute>} />
        </Routes>
      </div>
    </AuthProvider>
  );
}

export default App;