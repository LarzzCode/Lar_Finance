import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase'; // Import Supabase

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  
  const { signOut, user } = useAuth(); 
  
  // STATE BARU: Untuk menyimpan data profil (foto & nama)
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [displayName, setDisplayName] = useState(user?.email?.split('@')[0] || 'User');

  // FETCH PROFIL SAAT LOAD
  useEffect(() => {
    const getProfile = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .single();
      
      if (data) {
        if (data.full_name) setDisplayName(data.full_name);
        if (data.avatar_url) setAvatarUrl(data.avatar_url);
      }
    };
    getProfile();
  }, [user, location]); // Refresh saat pindah halaman (biar update real-time setelah edit profil)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { path: '/', label: 'Input' },
    { path: '/rekapan', label: 'Rekapan' },
    { path: '/budget', label: 'Budget' },
    { path: '/subscriptions', label: 'Langganan' },
    { path: '/categories', label: 'Kategori' },
  ];

  const handleLogout = async () => {
    try {
      setIsOpen(false);
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error("Gagal logout:", error);
    }
  };

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled || isOpen ? 'bg-white/90 backdrop-blur-md shadow-sm border-b border-gray-200/50' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            
            {/* LOGO */}
            <div className="flex-shrink-0 flex items-center">
              <Link to="/" className="flex items-center gap-2 group">
                <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-orange-500/30 group-hover:scale-105 transition-transform">
                  G
                </div>
                <span className="text-2xl font-black bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent tracking-tight">
                  LarFinance
                </span>
              </Link>
            </div>

            {/* DESKTOP MENU */}
            <div className="hidden md:flex space-x-1 items-center">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.path;
                return (
                  <Link key={link.path} to={link.path} className={`relative px-4 py-2 rounded-full text-sm font-bold transition-colors ${isActive ? 'text-orange-600' : 'text-gray-600 hover:text-gray-900'}`}>
                    {isActive && <motion.div layoutId="desktop-navbar" className="absolute inset-0 bg-orange-50 rounded-full -z-10" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />}
                    {link.label}
                  </Link>
                );
              })}

              {/* USER & LOGOUT */}
              <div className="flex items-center gap-3 pl-4 ml-2 border-l border-gray-300">
                {/* KLIK BADGE UNTUK KE PROFILE */}
                <Link to="/profile" className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-2 py-1.5 pr-3 rounded-full transition-colors">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="User" className="w-6 h-6 rounded-full object-cover border border-white shadow-sm" />
                  ) : (
                    <div className="w-6 h-6 bg-orange-200 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-orange-700" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                    </div>
                  )}
                  <span className="text-xs font-bold text-gray-700 max-w-[100px] truncate">{displayName}</span>
                </Link>

                <button onClick={handleLogout} className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors" title="Logout">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>

            {/* MOBILE BURGER */}
            <div className="flex md:hidden">
              <button onClick={() => setIsOpen(!isOpen)} className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 focus:outline-none transition-colors">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isOpen ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* MOBILE MENU */}
        <AnimatePresence>
          {isOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="md:hidden overflow-hidden bg-white/95 backdrop-blur-xl border-t border-gray-100 shadow-xl">
              <div className="px-4 pt-4 pb-6 space-y-2">
                
                {/* USER INFO MOBILE */}
                <Link to="/profile" onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-4 py-3 mb-4 bg-orange-50 rounded-xl border border-orange-100 active:scale-95 transition-transform">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="User" className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-md" />
                  ) : (
                    <div className="w-10 h-10 bg-orange-200 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-orange-700" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                    </div>
                  )}
                  <div className="overflow-hidden">
                    <p className="text-xs text-orange-600 font-semibold uppercase tracking-wider">Halo,</p>
                    <p className="text-sm font-bold text-gray-800 truncate">{displayName}</p>
                    <p className="text-xs text-gray-400">Klik untuk edit profil</p>
                  </div>
                </Link>

                {navLinks.map((link) => (
                  <Link key={link.path} to={link.path} onClick={() => setIsOpen(false)} className="block px-4 py-3 rounded-xl text-base font-bold text-gray-600 hover:bg-gray-50">{link.label}</Link>
                ))}
                
                <div className="pt-2 mt-2">
                  <button onClick={handleLogout} className="w-full text-left block px-4 py-3 rounded-xl text-base font-bold text-red-600 hover:bg-red-50 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    Keluar Akun
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
      <div className="h-16" />
    </>
  );
}