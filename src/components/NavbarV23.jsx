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

export default function NavbarV23() {
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
      <div className="hidden md:flex fixed top-5 left-1/2 -translate-x-1/2 z-50 w-[min(94vw,1030px)] justify-center pointer-events-none">
        <nav className="pointer-events-auto w-full bg-white/90 backdrop-blur-2xl border border-white/70 shadow-[0_14px_50px_rgba(15,23,42,0.12)] rounded-full px-2 py-2 flex items-center gap-1">
          <Link to="/" className="px-5 py-2.5 font-black tracking-tight text-slate-900 border-r border-slate-100 mr-1">LF.</Link>
          <div className="flex items-center flex-1 gap-1">
            {desktopLinks.map(({ path, label, icon: Icon }) => {
              const active = isPathActive(location.pathname, path);
              return (
                <Link key={path} to={path} className={`relative px-4 lg:px-5 py-2.5 rounded-full text-sm font-bold transition-colors ${active ? 'text-slate-950' : 'text-slate-500 hover:text-slate-800'}`}>
                  {active && <motion.span layoutId="finance-nav-active-v23" className="absolute inset-0 rounded-full bg-white shadow-sm border border-slate-100" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                  <span className="relative z-10 flex items-center gap-2"><Icon size={16} strokeWidth={2} /><span>{label}</span></span>
                </Link>
              );
            })}
          </div>
          <Link to="/input" className="inline-flex items-center gap-2 rounded-full bg-slate-950 text-white px-5 py-2.5 text-sm font-bold shadow-lg shadow-slate-900/15 hover:bg-black transition-colors"><CirclePlus size={17} /> Catat</Link>
          <button onClick={toggleTheme} title={isDark ? 'Gunakan mode terang' : 'Gunakan mode gelap'} className="ml-1 w-10 h-10 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 inline-flex items-center justify-center transition-colors" aria-label={isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}>{isDark ? <Sun size={17} /> : <Moon size={17} />}</button>
          <button onClick={handleLogout} className="ml-1 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-rose-500 hover:bg-rose-50 transition-colors"><LogOut size={17} /><span className="hidden lg:inline">Keluar</span></button>
        </nav>
      </div>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-2xl border-t border-slate-200 shadow-[0_-12px_35px_rgba(15,23,42,0.08)] px-3 pt-2 pb-[calc(0.65rem+env(safe-area-inset-bottom))]">
        <button onClick={toggleTheme} className="absolute right-4 -top-12 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-lg text-slate-600 flex items-center justify-center" aria-label={isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}>{isDark ? <Sun size={17} /> : <Moon size={17} />}</button>
        <div className="grid grid-cols-5 items-end">
          {mobileLinks.map(({ path, label, icon: Icon, isFab }) => {
            const active = isPathActive(location.pathname, path);
            if (isFab) {
              return <Link key={path} to={path} className="flex flex-col items-center justify-end gap-1 relative -top-4"><motion.span whileTap={{ scale: 0.92 }} className="w-14 h-14 rounded-full bg-slate-950 text-white flex items-center justify-center ring-4 ring-white shadow-lg shadow-slate-900/20"><Icon size={27} /></motion.span><span className="text-[10px] font-bold text-slate-900">{label}</span></Link>;
            }
            return <Link key={path} to={path} className={`flex flex-col items-center justify-end gap-1 py-1.5 ${active ? 'text-slate-950' : 'text-slate-400'}`}><span className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-colors ${active ? 'bg-slate-100' : ''}`}><Icon size={20} strokeWidth={active ? 2.4 : 2} /></span><span className="text-[10px] font-bold">{label}</span></Link>;
          })}
        </div>
      </nav>
    </>
  );
}
