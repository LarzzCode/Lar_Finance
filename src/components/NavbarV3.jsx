import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart3,
  CirclePlus,
  Home,
  LogOut,
  Moon,
  PiggyBank,
  Sun,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';

const desktopLinks = [
  { path: '/', label: 'Dashboard', icon: Home },
  { path: '/rekap', label: 'Laporan', icon: BarChart3 },
  { path: '/wallet', label: 'Dompet', icon: WalletCards },
  { path: '/planning', label: 'Planning', icon: PiggyBank },
  { path: '/profile', label: 'Profil', icon: UserRound },
];

const mobileLinks = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/rekap', label: 'Laporan', icon: BarChart3 },
  { path: '/input', label: 'Catat', icon: CirclePlus, isFab: true },
  { path: '/wallet', label: 'Dompet', icon: WalletCards },
  { path: '/planning', label: 'Planning', icon: PiggyBank },
];

const isPathActive = (pathname, path) => {
  if (path === '/') return pathname === '/';
  if (path === '/planning') return ['/planning', '/budget', '/subscription', '/savings', '/categories'].includes(pathname);
  return pathname === path;
};

export default function NavbarV3() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) return toast.error('Gagal logout');
    toast.success('Sampai jumpa 👋');
    navigate('/login');
  };

  return (
    <>
      <div className="hidden md:flex fixed top-5 left-1/2 -translate-x-1/2 z-50 w-[min(95vw,1060px)] pointer-events-none">
        <nav className="liquid-nav pointer-events-auto w-full rounded-[1.8rem] px-2.5 py-2.5 flex items-center gap-1.5">
          <Link to="/" className="w-12 h-11 rounded-2xl flex items-center justify-center text-[15px] font-semibold tracking-tight text-slate-900 dark:text-white border border-white/50 dark:border-white/10 bg-white/35 dark:bg-white/[0.04]">LF.</Link>

          <div className="flex items-center flex-1 gap-1 ml-1">
            {desktopLinks.map(({ path, label, icon: Icon }) => {
              const active = isPathActive(location.pathname, path);
              return (
                <Link key={path} to={path} className={`relative px-3.5 lg:px-4 py-2.5 rounded-2xl text-[13px] font-medium transition-colors ${active ? 'text-slate-950 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                  {active && (
                    <motion.span
                      layoutId="finance-nav-active-v3"
                      className="liquid-nav-pill absolute inset-0 rounded-2xl"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2"><Icon size={15} strokeWidth={1.9} /><span>{label}</span></span>
                </Link>
              );
            })}
          </div>

          <Link to="/input" className="liquid-primary inline-flex items-center gap-2 rounded-2xl text-white px-4 py-2.5 text-[13px] font-semibold transition-transform active:scale-[.98]"><CirclePlus size={16} strokeWidth={2} /> Catat</Link>
          <button onClick={toggleTheme} title={isDark ? 'Mode terang' : 'Mode gelap'} className="ml-0.5 w-10 h-10 rounded-2xl liquid-nav-pill text-slate-600 dark:text-slate-300 inline-flex items-center justify-center" aria-label={isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}>{isDark ? <Sun size={16} strokeWidth={1.9} /> : <Moon size={16} strokeWidth={1.9} />}</button>
          <button onClick={handleLogout} className="ml-0.5 inline-flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-[13px] font-medium text-rose-500 hover:bg-rose-50/70 dark:hover:bg-rose-950/20 transition-colors"><LogOut size={16} strokeWidth={1.9} /><span className="hidden xl:inline">Keluar</span></button>
        </nav>
      </div>

      <nav className="liquid-nav md:hidden fixed left-3 right-3 bottom-[calc(.75rem+env(safe-area-inset-bottom))] z-50 rounded-[1.8rem] px-2.5 pt-2 pb-2.5">
        <button onClick={toggleTheme} className="absolute right-1 -top-12 w-10 h-10 rounded-2xl liquid-nav-pill text-slate-600 dark:text-slate-300 flex items-center justify-center" aria-label={isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}>{isDark ? <Sun size={16} /> : <Moon size={16} />}</button>
        <div className="grid grid-cols-5 items-end">
          {mobileLinks.map(({ path, label, icon: Icon, isFab }) => {
            const active = isPathActive(location.pathname, path);
            if (isFab) {
              return (
                <Link key={path} to={path} className="flex flex-col items-center justify-end gap-1 relative -top-4">
                  <motion.span whileTap={{ scale: .93 }} className="liquid-primary w-14 h-14 rounded-[1.3rem] text-white flex items-center justify-center ring-4 ring-white/60 dark:ring-slate-900/70"><Icon size={24} strokeWidth={2} /></motion.span>
                  <span className="text-[9px] font-medium text-slate-700 dark:text-slate-300">{label}</span>
                </Link>
              );
            }
            return (
              <Link key={path} to={path} className={`flex flex-col items-center gap-1 py-1.5 ${active ? 'text-slate-950 dark:text-white' : 'text-slate-400'}`}>
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${active ? 'liquid-nav-pill' : ''}`}><Icon size={19} strokeWidth={active ? 2 : 1.8} /></span>
                <span className="text-[9px] font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
