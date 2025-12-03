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

// Komponen Pembungkus (Satpam)
const PrivateRoute = ({ children }) => {
  const { user } = useAuth();
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
          {/* Public Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes (Harus Login) */}
          <Route path="/" element={<PrivateRoute><InputData /></PrivateRoute>} />
          <Route path="/rekapan" element={<PrivateRoute><Rekapan /></PrivateRoute>} />
          <Route path="/budget" element={<PrivateRoute><Budgeting /></PrivateRoute>} />
          <Route path="/wallets" element={<PrivateRoute><Wallets /></PrivateRoute>} />
          <Route path="/categories" element={<PrivateRoute><Categories /></PrivateRoute>} />
        </Routes>
      </div>
    </AuthProvider>
  );
}

export default App;