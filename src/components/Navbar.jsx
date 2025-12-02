import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  // Efek mendeteksi scroll agar navbar berubah style saat di-scroll
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Daftar Menu
  const navLinks = [
    { path: '/', label: 'Input' },
    { path: '/rekapan', label: 'Rekapan' },
    { path: '/wallets', label: 'Dompet' },
    { path: '/budget', label: 'Budget' },
  ];

  return (
    <>
      {/* Navbar Container: Glassmorphism Effect */}
      <nav 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled || isOpen 
            ? 'bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-200/50' 
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            
            {/* LOGO: Gradient Text */}
            <div className="flex-shrink-0 flex items-center">
              <Link to="/" className="flex items-center gap-2 group">
                {/* Icon Logo Sederhana */}
                <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-orange-500/30 group-hover:scale-105 transition-transform">
                  G
                </div>
                <span className="text-2xl font-black bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent tracking-tight">
                  LarFinance
                </span>
              </Link>
            </div>

            {/* DESKTOP MENU (Dengan Animasi Pill) */}
            <div className="hidden md:flex space-x-1">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.path;
                return (
                  <Link 
                    key={link.path} 
                    to={link.path}
                    className={`relative px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                      isActive ? 'text-orange-600' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="desktop-navbar"
                        className="absolute inset-0 bg-orange-50 rounded-full -z-10"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    {link.label}
                  </Link>
                );
              })}
            </div>

            {/* MOBILE BURGER BUTTON */}
            <div className="flex md:hidden">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 focus:outline-none transition-colors"
              >
                <motion.div
                  animate={isOpen ? "open" : "closed"}
                  className="w-6 h-6 flex flex-col justify-center items-center gap-1.5"
                >
                  <motion.span 
                    variants={{ closed: { rotate: 0, y: 0 }, open: { rotate: 45, y: 6 } }}
                    className="w-6 h-0.5 bg-gray-800 block rounded-full"
                  />
                  <motion.span 
                    variants={{ closed: { opacity: 1 }, open: { opacity: 0 } }}
                    className="w-6 h-0.5 bg-gray-800 block rounded-full"
                  />
                  <motion.span 
                    variants={{ closed: { rotate: 0, y: 0 }, open: { rotate: -45, y: -8 } }}
                    className="w-6 h-0.5 bg-gray-800 block rounded-full"
                  />
                </motion.div>
              </button>
            </div>
          </div>
        </div>

        {/* MOBILE MENU (Slide Down Animation) */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="md:hidden overflow-hidden bg-white/95 backdrop-blur-xl border-t border-gray-100"
            >
              <div className="px-4 pt-2 pb-6 space-y-2 shadow-inner">
                {navLinks.map((link) => {
                  const isActive = location.pathname === link.path;
                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      onClick={() => setIsOpen(false)}
                      className={`block px-4 py-3 rounded-xl text-base font-bold transition-all ${
                        isActive 
                          ? 'bg-orange-50 text-orange-600 pl-6 border-l-4 border-orange-500' 
                          : 'text-gray-600 hover:bg-gray-50 hover:pl-6'
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
      
      {/* Spacer agar konten tidak tertutup navbar fixed */}
      <div className="h-16" />
    </>
  );
}