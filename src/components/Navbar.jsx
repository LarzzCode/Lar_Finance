import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  
  const { signOut, user } = useAuth(); 
  
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [displayName, setDisplayName] = useState(user?.email?.split('@')[0] || 'User');

  // FETCH PROFIL
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
  }, [user, location]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error("Gagal logout:", error);
    }
  };

  // DEFINISI MENU & ICON SVG
  const navLinks = [
    { 
      path: '/', 
      label: 'Input', 
      icon: (active) => (
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${active ? 'fill-current' : 'stroke-current fill-none'}`} viewBox="0 0 24 24" strokeWidth={active ? 0 : 2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    { 
      path: '/rekapan', 
      label: 'Rekap', 
      icon: (active) => (
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${active ? 'fill-current' : 'stroke-current fill-none'}`} viewBox="0 0 24 24" strokeWidth={active ? 0 : 2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    { 
      path: '/budget', 
      label: 'Budget', 
      icon: (active) => (
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${active ? 'fill-current' : 'stroke-current fill-none'}`} viewBox="0 0 24 24" strokeWidth={active ? 0 : 2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
      )
    },
    { 
      path: '/subscriptions', 
      label: 'Langganan', 
      icon: (active) => (
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${active ? 'fill-current' : 'stroke-current fill-none'}`} viewBox="0 0 24 24" strokeWidth={active ? 0 : 2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    { 
      path: '/categories', 
      label: 'Kategori', 
      icon: (active) => (
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${active ? 'fill-current' : 'stroke-current fill-none'}`} viewBox="0 0 24 24" strokeWidth={active ? 0 : 2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      )
    },
    { 
      path: '/profile', 
      label: 'Profil', 
      icon: (active) => (
        <div className={`w-6 h-6 rounded-full overflow-hidden border-2 ${active ? 'border-orange-500' : 'border-gray-400'}`}>
           {avatarUrl ? (
             <img src={avatarUrl} alt="User" className="w-full h-full object-cover" />
           ) : (
             <div className="w-full h-full bg-gray-200 flex items-center justify-center">
               <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
             </div>
           )}
        </div>
      )
    },
  ];

  return (
    <>
      {/* --- DESKTOP NAVBAR (Layout Lama) --- */}
      <nav className={`hidden md:block fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-md shadow-sm border-b border-gray-200/50' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo Desktop */}
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-orange-500/30">
                G
              </div>
              <span className="text-2xl font-black bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent tracking-tight">
                LarFinance
              </span>
            </Link>

            {/* Menu Desktop */}
            <div className="flex space-x-1 items-center">
              {navLinks.slice(0, 5).map((link) => { // Slice agar Profile tidak double di desktop menu teks
                const isActive = location.pathname === link.path;
                return (
                  <Link key={link.path} to={link.path} className={`relative px-4 py-2 rounded-full text-sm font-bold transition-colors ${isActive ? 'text-orange-600' : 'text-gray-600 hover:text-gray-900'}`}>
                    {isActive && <motion.div layoutId="desktop-navbar" className="absolute inset-0 bg-orange-50 rounded-full -z-10" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />}
                    {link.label}
                  </Link>
                );
              })}
              
              {/* Profile & Logout Desktop */}
              <div className="flex items-center gap-3 pl-4 ml-2 border-l border-gray-300">
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
          </div>
        </div>
      </nav>

      {/* --- MOBILE TOP BAR (Hanya Logo Tengah) --- */}
      <nav className={`md:hidden fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100 transition-all duration-300 h-16 flex items-center justify-center`}>
        <Link to="/" className="flex items-center gap-2">
           <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-orange-500/30">
             G
           </div>
           <span className="text-xl font-black bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent tracking-tight">
             LarFinance
           </span>
        </Link>
      </nav>

      {/* --- MOBILE BOTTOM NAVIGATION --- */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 pb-safe">
        <div className="flex justify-around items-center h-16 px-1">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link 
                key={link.path} 
                to={link.path} 
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive ? 'text-orange-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                {/* Render Icon Dinamis */}
                {link.icon(isActive)}
                
                <span className="text-[10px] font-bold">
                  {link.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Spacer agar konten tidak tertutup Top/Bottom Bar */}

    </>
  );
}