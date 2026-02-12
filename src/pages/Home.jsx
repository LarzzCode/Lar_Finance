import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function Home() {
  const { user } = useAuth();
  const [username, setUsername] = useState('Boss');
  const [avatarUrl, setAvatarUrl] = useState(null); // State untuk Foto Profil
  const [summary, setSummary] = useState({ balanceMonth: 0, incomeMonth: 0, expenseMonth: 0 });
  const [recentTx, setRecentTx] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hideBalance, setHideBalance] = useState(false);

  useEffect(() => {
    if (user) { fetchProfile(); fetchDashboardData(); }
  }, [user]);

  const fetchProfile = async () => {
    // Ambil full_name DAN avatar_url
    const { data } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .single();
      
    if (data) {
        if(data.full_name) setUsername(data.full_name.split(' ')[0]); 
        if(data.avatar_url) setAvatarUrl(data.avatar_url);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const { data: allTx, error } = await supabase.from('transactions').select('amount, transaction_date, categories(type)').range(0, 9999);
      if (error) throw error;

      let monthInc = 0; let monthExp = 0;
      const now = new Date(); const currentMonth = now.getMonth(); const currentYear = now.getFullYear();

      allTx?.forEach(t => {
        const amount = Number(t.amount) || 0;
        const isIncome = t.categories && t.categories.type === 'income';
        const tDate = new Date(t.transaction_date);
        if (tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) {
            if (isIncome) monthInc += amount; else monthExp += amount;
        }
      });
      setSummary({ balanceMonth: monthInc - monthExp, incomeMonth: monthInc, expenseMonth: monthExp });

      const { data: recent } = await supabase.from('transactions').select('*, categories(name, type)').order('transaction_date', { ascending: false }).order('created_at', { ascending: false }).limit(5);
      setRecentTx(recent || []);
    } catch (error) { console.error("Error:", error); } finally { setLoading(false); }
  };

  const rupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
  
  const getGreeting = () => { 
    const h = new Date().getHours(); 
    return h < 11 ? 'Selamat Pagi' : h < 15 ? 'Selamat Siang' : h < 19 ? 'Selamat Sore' : 'Selamat Malam'; 
  };

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

  // MENU ICON SVG (Outline Modern)
  const menuItems = [
    { label: 'Catat', path: '/input', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /> },
    { label: 'Dompet', path: '/wallet', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" /> },
    { label: 'Laporan', path: '/rekap', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" /> },
    { label: 'Budget', path: '/budget', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" /> },
    { label: 'Kategori', path: '/categories', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /> },
    { label: 'Akun', path: '/profile', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /> }
  ];

  return (
    <motion.div 
      initial="hidden" animate="show" variants={containerVariants}
      className="min-h-screen w-full max-w-7xl mx-auto px-4 md:px-8 pb-28 pt-0 md:pt-28 font-sans text-gray-800 overflow-x-hidden"
    >
      
      {/* Header Greeting & Profile */}
      <motion.div variants={itemVariants} className="mb-6 px-1 pt-8 md:pt-0 flex justify-between items-end">
        <div>
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">{getGreeting()}</p>
          <h1 className="text-3xl md:text-4xl font-black text-gray-800 truncate">Hi, {username}</h1>
        </div>
        
        {/* FOTO PROFILE REAL */}
        <Link to="/profile" className="w-11 h-11 rounded-full bg-gray-100 border-2 border-white shadow-sm overflow-hidden relative group">
             <img 
                src={avatarUrl || `https://ui-avatars.com/api/?name=${username}&background=0D9488&color=fff`} 
                alt="Profile" 
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
             />
        </Link>
      </motion.div>

      {/* Main Card */}
      <motion.div 
        variants={itemVariants}
        className="bg-gray-900 text-white p-8 rounded-[2.5rem] shadow-2xl shadow-gray-900/30 mb-10 relative overflow-hidden group"
      >
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-gray-800 via-gray-900 to-black z-0"></div>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute -top-24 -right-24 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl z-0" />
        <motion.div animate={{ rotate: -360 }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }} className="absolute -bottom-24 -left-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl z-0" />

        <div className="relative z-10">
            <div className="flex justify-between items-center mb-2">
                <p className="text-gray-400 text-xs font-medium uppercase tracking-widest">Cashflow Bulan Ini</p>
                <button onClick={() => setHideBalance(!hideBalance)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors backdrop-blur-md">
                    {hideBalance ? ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-300"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg> ) : ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-300"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> )}
                </button>
            </div>
            
            <div className="h-16 flex items-center mb-6">
                <AnimatePresence mode="wait">
                    {hideBalance ? ( <motion.h2 key="hidden" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-4xl md:text-5xl font-black text-gray-500 tracking-widest">•••••••</motion.h2> ) : ( <motion.h2 key="visible" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className={`text-3xl md:text-5xl font-black tracking-tight truncate ${summary.balanceMonth < 0 ? 'text-rose-400' : 'text-white'}`}>{loading ? '...' : rupiah(summary.balanceMonth)}</motion.h2> )}
                </AnimatePresence>
            </div>

            <div className="grid grid-cols-2 gap-6 relative z-10">
                <div className="p-3 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/5 hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                        <p className="text-[10px] text-gray-300 uppercase tracking-wider">Pemasukan</p>
                    </div>
                    <p className="font-bold text-sm md:text-lg truncate">{hideBalance ? '••••' : (loading ? '...' : rupiah(summary.incomeMonth))}</p>
                </div>
                <div className="p-3 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/5 hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-400"></div>
                        <p className="text-[10px] text-gray-300 uppercase tracking-wider">Pengeluaran</p>
                    </div>
                    <p className="font-bold text-sm md:text-lg truncate">{hideBalance ? '••••' : (loading ? '...' : rupiah(summary.expenseMonth))}</p>
                </div>
            </div>
        </div>
      </motion.div>

      {/* Menu Shortcuts */}
      <motion.div variants={itemVariants} className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-10">
        {menuItems.map((item, idx) => (
            <Link to={item.path} key={idx}>
                <motion.div whileHover={{ scale: 1.05, y: -5 }} whileTap={{ scale: 0.95 }} className="flex flex-col items-center justify-center p-5 gap-3 bg-white rounded-[1.5rem] border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 transition-all cursor-pointer aspect-square relative overflow-hidden">
                    <div className="w-12 h-12 flex items-center justify-center text-gray-500 bg-gray-50 rounded-2xl group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-6 h-6">{item.icon}</svg>
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{item.label}</span>
                </motion.div>
            </Link>
        ))}
      </motion.div>

      {/* Recent Transactions */}
      <motion.div variants={itemVariants}>
        <div className="flex justify-between items-end mb-6 px-1">
            <h3 className="text-lg font-black text-gray-800">Transaksi Terakhir</h3>
            <Link to="/rekap" className="text-xs font-bold text-indigo-600 hover:underline">Lihat Semua</Link>
        </div>
        <div className="space-y-4">
            {recentTx.map((tx, i) => (
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} key={tx.id} className="flex items-center justify-between p-5 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black transition-transform group-hover:scale-110 ${tx.categories?.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                            {tx.categories?.name ? tx.categories.name.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div className="min-w-0">
                            <p className="font-bold text-gray-800 text-sm truncate max-w-[150px]">{tx.description || (tx.categories?.name || 'Lainnya')}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase mt-1 tracking-wide">{tx.categories?.name || 'Tanpa Kategori'} • {tx.payment_method}</p>
                        </div>
                    </div>
                    <p className={`font-black text-sm whitespace-nowrap ${tx.categories?.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {hideBalance ? '••••' : (tx.categories?.type === 'income' ? '+' : '-') + ' ' + rupiah(tx.amount)}
                    </p>
                </motion.div>
            ))}
        </div>
      </motion.div>
    </motion.div>
  );
}