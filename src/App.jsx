import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import InputData from './pages/InputData';
import Rekapan from './pages/Rekapan'; // File fisiknya tetap Rekapan.jsx tidak masalah
import Budgeting from './pages/Budgeting';
import Categories from './pages/Categories';
import Subscriptions from './pages/Subscriptions';
import Profile from './pages/Profile';
import Login from './pages/Login';
import Savings from './pages/Savings'; // <--- Import
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

// Komponen Satpam (Proteksi Halaman)
const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="p-4 text-center">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  
  return (
    <>
      <Navbar />
      {children}
    </>
  );
};

function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen font-sans bg-[#fcfcfc]">
        
        {/* --- KONFIGURASI NOTIFIKASI BARU (GLASSMORPHISM) --- */}
        <Toaster 
          position="top-right"
          reverseOrder={false}
          containerStyle={{
            top: 24, // Jarak dari atas
            right: 24, // Jarak dari kanan
            zIndex: 99999
          }}
          toastOptions={{
            duration: 4000,
            style: {
              background: 'rgba(255, 255, 255, 0.85)', // Putih transparan
              backdropFilter: 'blur(12px)', // Efek kaca
              color: '#1f2937', // Teks abu gelap
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.8)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)', // Shadow halus
              fontSize: '13px',
              fontWeight: '600',
              padding: '12px 16px',
              maxWidth: '350px',
            },
            success: {
              iconTheme: { primary: '#10B981', secondary: 'white' },
              style: { borderLeft: '4px solid #10B981' }, // Aksen Hijau
            },
            error: {
              iconTheme: { primary: '#EF4444', secondary: 'white' },
              style: { borderLeft: '4px solid #EF4444' }, // Aksen Merah
            },
          }}
        />
        
        
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes */}
          <Route path="/" element={<PrivateRoute><InputData /></PrivateRoute>} />
          
          {/* PERUBAHAN PENTING: Ubah path '/rekapan' jadi '/reports' agar match dengan Navbar */}
          <Route path="/rekapan" element={<PrivateRoute><Rekapan /></PrivateRoute>} />         
          <Route path="/budget" element={<PrivateRoute><Budgeting /></PrivateRoute>} />
          <Route path="/subscriptions" element={<PrivateRoute><Subscriptions /></PrivateRoute>} />
          <Route path="/savings" element={<PrivateRoute><Savings /></PrivateRoute>} />
          <Route path="/categories" element={<PrivateRoute><Categories /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
        </Routes>
      </div>
    </AuthProvider>
  );
}

export default App;