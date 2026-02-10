import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const activePath = location.pathname;

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Gagal logout');
    } else {
      toast.success('Sampai jumpa! 👋');
      navigate('/login');
    }
  };

  const navLinks = [
    { 
      path: '/', 
      label: 'Home', 
      icon: (active) => (
        <svg xmlns="http://www.w3.org/2000/svg" className={`w-6 h-6 transition-all ${active ? 'fill-gray-900' : 'fill-none stroke-gray-400'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    { 
      path: '/rekap', 
      label: 'Laporan', 
      icon: (active) => (
        <svg xmlns="http://www.w3.org/2000/svg" className={`w-6 h-6 transition-all ${active ? 'fill-gray-900' : 'fill-none stroke-gray-400'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    { 
      path: '/input', 
      label: 'Input', 
      isFab: true, 
      icon: () => (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      )
    },
    { 
      path: '/wallet', 
      label: 'Dompet', 
      icon: (active) => (
        <svg xmlns="http://www.w3.org/2000/svg" className={`w-6 h-6 transition-all ${active ? 'fill-gray-900' : 'fill-none stroke-gray-400'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      )
    },
    { 
        path: '/profile', 
        label: 'Profil', 
        icon: (active) => (
          <svg xmlns="http://www.w3.org/2000/svg" className={`w-6 h-6 transition-all ${active ? 'fill-gray-900' : 'fill-none stroke-gray-400'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        )
    },
    // LOGOUT HANYA UNTUK DESKTOP (isButton & desktopOnly)
    {
      label: 'Keluar',
      isButton: true, 
      desktopOnly: true, // Flag baru
      action: handleLogout,
      icon: (active) => (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 stroke-rose-500 hover:stroke-rose-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      )
    }
  ];

  return (
    <>
      {/* MOBILE NAVBAR (Bottom) */}
      <div className="md:hidden fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-xl border-t border-gray-100 pb-safe pt-2 px-4 z-50 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)]">
        <div className="flex justify-between items-end pb-3">
          {navLinks.map((link, idx) => {
            // SKIP RENDERING JIKA BUTTON INI KHUSUS DESKTOP (LOGOUT)
            if (link.desktopOnly) return null;

            const isActive = activePath === link.path;
            
            if (link.isFab) {
              return (
                <Link to={link.path} key={idx} className="relative -top-5 group">
                  <motion.div whileTap={{ scale: 0.9 }} className="w-14 h-14 bg-gray-900 rounded-full flex items-center justify-center shadow-lg shadow-gray-900/30 ring-4 ring-white">
                    {link.icon(true)}
                  </motion.div>
                </Link>
              );
            }

            return (
              <Link to={link.path} key={idx} className="flex flex-col items-center gap-1 w-12 relative">
                <div className="relative">
                    {link.icon(isActive)}
                    {isActive && <motion.div layoutId="nav-pill-mobile" className="absolute -top-3 left-1/2 -translate-x-1/2 w-1 h-1 bg-gray-900 rounded-full" />}
                </div>
                <span className={`text-[10px] font-bold ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* DESKTOP NAVBAR (Floating Top) - LOGOUT MUNCUL DISINI */}
      <div className="hidden md:flex fixed top-6 left-1/2 -translate-x-1/2 z-50">
        <nav className="bg-white/80 backdrop-blur-2xl border border-white/50 px-2 py-2 rounded-full shadow-lg flex items-center gap-1">
            <div className="pl-6 pr-4 border-r border-gray-100 mr-1">
                <span className="text-lg font-black bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">LF.</span>
            </div>
            
            {navLinks.map((link, idx) => {
                const isActive = activePath === link.path;

                if (link.isFab) {
                    return (
                        <Link to={link.path} key={idx} className="ml-2">
                            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="bg-gray-900 text-white px-6 py-2.5 rounded-full font-bold text-sm shadow-lg hover:bg-black transition-colors flex items-center gap-2">
                                <span>+</span> Input
                            </motion.button>
                        </Link>
                    )
                }

                if (link.isButton) {
                  return (
                    <button key={idx} onClick={link.action} className="relative px-5 py-2.5 rounded-full text-sm font-bold transition-all text-rose-500 hover:bg-rose-50 flex items-center gap-2">
                        <span className="scale-90">{link.icon(false)}</span>
                        {link.label}
                    </button>
                  )
                }

                return (
                    <Link to={link.path} key={idx} className={`relative px-5 py-2.5 rounded-full text-sm font-bold transition-all ${isActive ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                        {isActive && <motion.div layoutId="nav-pill-desktop" className="absolute inset-0 bg-white shadow-sm border border-gray-100 rounded-full z-0" />}
                        <span className="relative z-10 flex items-center gap-2">
                            <span className="scale-75 opacity-70">{link.icon(isActive)}</span>
                            {link.label}
                        </span>
                    </Link>
                );
            })}
        </nav>
      </div>
    </>
  );
}