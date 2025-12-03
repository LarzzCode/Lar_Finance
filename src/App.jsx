import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import InputData from './pages/InputData';
import Rekapan from './pages/Rekapan';
import Budgeting from './pages/Budgeting';
import Categories from './pages/Categories';
import Subscriptions from './pages/Subscriptions';
import Profile from './pages/Profile';
import Login from './pages/Login';
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
        <Toaster position="top-center" />
        
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes */}
          {/* PERHATIKAN: Halaman "/" sekarang mengarah ke InputData */}
          <Route path="/" element={<PrivateRoute><InputData /></PrivateRoute>} />
          <Route path="/rekapan" element={<PrivateRoute><Rekapan /></PrivateRoute>} />
          <Route path="/budget" element={<PrivateRoute><Budgeting /></PrivateRoute>} />
          <Route path="/categories" element={<PrivateRoute><Categories /></PrivateRoute>} />
          <Route path="/subscriptions" element={<PrivateRoute><Subscriptions /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
        </Routes>
      </div>
    </AuthProvider>
  );
}

export default App;