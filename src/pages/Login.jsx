import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false); 
  const navigate = useNavigate();

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (isRegister && password !== confirmPassword) {
      toast.error('Password tidak sama!');
      setLoading(false);
      return;
    }

    let result;
    if (isRegister) {
      result = await supabase.auth.signUp({ email, password });
    } else {
      result = await supabase.auth.signInWithPassword({ email, password });
    }

    const { error } = result;

    if (error) {
      toast.error(error.message);
    } else {
      if (isRegister) {
        toast.success('Akun berhasil dibuat! Silakan Login.');
        setIsRegister(false);
        setEmail(''); setPassword(''); setConfirmPassword('');
      } else {
        toast.success('Login Berhasil! 🚀');
        navigate('/'); 
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gray-100 font-sans">
      
      {/* --- BACKGROUND DYNAMIC ORBS (Bola-bola Warna) --- */}
      <div className="absolute inset-0 w-full h-full">
        {/* Bola 1 (Kiri Atas) */}
        <motion.div
          animate={{
            x: [0, 50, 0],
            y: [0, 30, 0],
            scale: [1, 1.1, 1],
            backgroundColor: isRegister ? '#60A5FA' : '#F97316' // Biru vs Oranye
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-20 -left-20 w-96 h-96 rounded-full mix-blend-multiply filter blur-[100px] opacity-70"
        />
        
        {/* Bola 2 (Kanan Tengah) */}
        <motion.div
          animate={{
            x: [0, -30, 0],
            y: [0, 50, 0],
            scale: [1, 1.2, 1],
            backgroundColor: isRegister ? '#818CF8' : '#EF4444' // Indigo vs Merah
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute top-1/4 -right-20 w-[30rem] h-[30rem] rounded-full mix-blend-multiply filter blur-[100px] opacity-70"
        />

        {/* Bola 3 (Bawah Kiri) */}
        <motion.div
          animate={{
            x: [0, 40, 0],
            y: [0, -40, 0],
            backgroundColor: isRegister ? '#2DD4BF' : '#FDBA74' // Teal vs Kuning
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 4 }}
          className="absolute -bottom-32 left-10 w-[25rem] h-[25rem] rounded-full mix-blend-multiply filter blur-[100px] opacity-70"
        />
      </div>

      {/* --- GLASS CARD CONTAINER --- */}
      <motion.div 
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        // KUNCI GLASSMORPHISM: bg-white/30 + backdrop-blur-xl + border-white/40
        className="relative z-10 w-full max-w-md p-8 m-4 bg-white/30 backdrop-blur-2xl border border-white/40 rounded-[2rem] shadow-2xl shadow-black/5"
      >
        {/* Header Icon */}
        <div className="text-center mb-8">
          <motion.div 
            key={isRegister ? 'reg' : 'log'}
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className={`w-20 h-20 mx-auto mb-4 rounded-3xl flex items-center justify-center text-4xl shadow-xl bg-gradient-to-br ${isRegister ? 'from-blue-500 to-indigo-600 shadow-blue-500/30' : 'from-orange-500 to-red-600 shadow-orange-500/30'}`}
          >
            <span className="text-white font-black drop-shadow-md">
              {isRegister ? 'G' : 'G'}
            </span>
          </motion.div>
          
          <h1 className="text-3xl font-black text-gray-800 tracking-tight mb-2">
            {isRegister ? 'Mulai Perjalanan' : 'Selamat Datang'}
          </h1>
          <p className="text-gray-600 font-medium">
            {isRegister ? 'Buat akun dalam hitungan detik.' : 'Lanjutkan pengelolaan uangmu.'}
          </p>
        </div>

        {/* Form Inputs */}
        <form onSubmit={handleAuth} className="space-y-5">
          <div className="space-y-4">
            <div className="relative group">
              <input 
                type="email" required placeholder="Email Address"
                className="w-full px-5 py-4 rounded-2xl bg-white/50 border border-white/50 text-gray-800 placeholder-gray-500 focus:bg-white focus:outline-none focus:ring-4 transition-all duration-300 shadow-sm group-hover:bg-white/70"
                style={{ 
                  boxShadow: isRegister ? '0 0 0 0 transparent' : '0 0 0 0 transparent' // Reset default
                }}
                // Conditional Ring Color via Template Literal not ideal inside className string due to complexity, using tailwind classes below
                className={`w-full px-5 py-4 rounded-2xl bg-white/50 border border-white/50 text-gray-800 placeholder-gray-500 focus:bg-white focus:outline-none focus:ring-4 transition-all duration-300 shadow-sm ${isRegister ? 'focus:ring-blue-200 focus:border-blue-300' : 'focus:ring-orange-200 focus:border-orange-300'}`}
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            <div className="relative">
              <input 
                type="password" required minLength={6} placeholder="Password"
                className={`w-full px-5 py-4 rounded-2xl bg-white/50 border border-white/50 text-gray-800 placeholder-gray-500 focus:bg-white focus:outline-none focus:ring-4 transition-all duration-300 shadow-sm ${isRegister ? 'focus:ring-blue-200 focus:border-blue-300' : 'focus:ring-orange-200 focus:border-orange-300'}`}
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <AnimatePresence>
              {isRegister && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <input 
                    type="password" required={isRegister} placeholder="Konfirmasi Password"
                    className="w-full mt-4 px-5 py-4 rounded-2xl bg-white/50 border border-white/50 text-gray-800 placeholder-gray-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-300 transition-all duration-300 shadow-sm"
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.button 
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            type="submit" disabled={loading}
            className={`w-full py-4 px-6 text-white font-bold text-lg rounded-2xl shadow-xl transition-all duration-300 bg-gradient-to-r ${
              isRegister 
                ? 'from-blue-600 to-indigo-600 shadow-blue-500/40 hover:shadow-blue-500/60' 
                : 'from-orange-500 to-red-600 shadow-orange-500/40 hover:shadow-orange-500/60'
            } disabled:opacity-70 disabled:cursor-not-allowed`}
          >
            {loading ? 'Memproses...' : (isRegister ? 'Daftar Sekarang' : 'Masuk')}
          </motion.button>
        </form>

        {/* Footer Toggle */}
        <div className="mt-8 text-center">
          <button 
            onClick={() => { setIsRegister(!isRegister); setConfirmPassword(''); }}
            className={`text-sm font-bold bg-white/40 px-6 py-2 rounded-full backdrop-blur-md border border-white/50 transition-colors ${
              isRegister ? 'text-blue-700 hover:bg-white/60' : 'text-orange-700 hover:bg-white/60'
            }`}
          >
            {isRegister ? '← Kembali ke Login' : 'Belum punya akun? Daftar →'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}