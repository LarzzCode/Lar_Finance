import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function Home() {
  const { user } = useAuth();
  const [username, setUsername] = useState('Boss');
  const [summary, setSummary] = useState({ 
    balanceMonth: 0,   // Sisa Uang Bulan Ini
    incomeMonth: 0,    // Masuk Bulan Ini
    expenseMonth: 0    // Keluar Bulan Ini
  });
  const [recentTx, setRecentTx] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchDashboardData();
    }
  }, [user]);

  const fetchProfile = async () => {
    const { data } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
    if (data?.full_name) setUsername(data.full_name.split(' ')[0]); 
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Ambil Transaksi
      const { data: allTx, error } = await supabase
        .from('transactions')
        .select('amount, transaction_date, categories(type)')
        .range(0, 9999);

      if (error) throw error;

      let monthInc = 0;
      let monthExp = 0;
      
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      allTx?.forEach(t => {
        const amount = Number(t.amount) || 0;
        const isIncome = t.categories && t.categories.type === 'income';

        // Filter Hanya Bulan Ini
        const tDate = new Date(t.transaction_date);
        if (tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) {
            if (isIncome) monthInc += amount;
            else monthExp += amount;
        }
      });

      setSummary({
        balanceMonth: monthInc - monthExp,
        incomeMonth: monthInc,
        expenseMonth: monthExp
      });

      // Transaksi Terakhir
      const { data: recent } = await supabase
        .from('transactions')
        .select('*, categories(name, type)')
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentTx(recent || []);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const rupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    return hour < 11 ? 'Selamat Pagi ☀️' : hour < 15 ? 'Selamat Siang 🌤️' : hour < 19 ? 'Selamat Sore 🌇' : 'Selamat Malam 🌙';
  };

  const menuItems = [
    { label: 'Catat', path: '/input', icon: '💸' },
    { label: 'Dompet', path: '/wallet', icon: '💳' },
    { label: 'Laporan', path: '/rekap', icon: '📊' },
    { label: 'Budget', path: '/budget', icon: '📉' },
    { label: 'Langganan', path: '/subscription', icon: '📅' },
    { label: 'Kategori', path: '/categories', icon: '🏷️' }
  ];

  return (
    <div className="min-h-screen w-full max-w-7xl mx-auto px-4 md:px-8 pt-24 pb-28 font-sans text-gray-800 overflow-x-hidden">
      
      {/* 1. Header Clean */}
      <div className="mb-6 px-1">
        <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">{getGreeting()}</p>
        <h1 className="text-3xl md:text-4xl font-black text-gray-800 truncate">Hi, {username}! 👋</h1>
      </div>

      {/* 2. Main Card (Clean & Focused) */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="bg-gray-900 text-white p-6 rounded-[2rem] shadow-xl shadow-gray-900/20 mb-8 relative overflow-hidden"
      >
        {/* Background Effects */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-500/30 rounded-full blur-3xl"></div>

        <div className="relative z-10">
            <p className="text-gray-400 text-xs font-medium mb-1">Sisa Uang (Bulan Ini)</p>
            
            {/* ANGKA UTAMA */}
            <h2 className={`text-3xl md:text-5xl font-black tracking-tight mb-8 truncate ${summary.balanceMonth < 0 ? 'text-rose-400' : 'text-white'}`}>
                {loading ? '...' : rupiah(summary.balanceMonth)}
            </h2>

            {/* Grid Income/Expense */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/10">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        <p className="text-[10px] text-gray-300">Masuk</p>
                    </div>
                    <p className="font-bold text-sm md:text-lg truncate">{loading ? '...' : rupiah(summary.incomeMonth)}</p>
                </div>
                <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/10">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                        <p className="text-[10px] text-gray-300">Keluar</p>
                    </div>
                    <p className="font-bold text-sm md:text-lg truncate">{loading ? '...' : rupiah(summary.expenseMonth)}</p>
                </div>
            </div>
        </div>
      </motion.div>

      {/* 3. Shortcuts */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-8">
        {menuItems.map((item, idx) => (
            <Link to={item.path} key={idx} className="flex flex-col items-center gap-2 group p-2 rounded-2xl active:bg-gray-50 transition-colors">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-white border border-gray-100 rounded-2xl md:rounded-3xl flex items-center justify-center text-xl md:text-2xl shadow-sm group-hover:scale-105 transition-transform">
                    {item.icon}
                </div>
                <span className="text-[10px] md:text-xs font-bold text-gray-600 text-center">{item.label}</span>
            </Link>
        ))}
      </div>

      {/* 4. Recent Transactions */}
      <div>
        <div className="flex justify-between items-end mb-4 px-1">
            <h3 className="text-lg font-black text-gray-800">Transaksi Terakhir</h3>
            <Link to="/rekap" className="text-xs font-bold text-indigo-600 hover:underline">Lihat Semua</Link>
        </div>

        <div className="space-y-3">
            {recentTx.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-4 bg-white rounded-3xl border border-gray-50 shadow-sm">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${tx.categories?.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                            {tx.categories?.type === 'income' ? '💰' : '🛍️'}
                        </div>
                        <div className="min-w-0">
                            <p className="font-bold text-gray-800 text-xs truncate max-w-[150px]">{tx.description || (tx.categories?.name || 'Lainnya')}</p>
                            <p className="text-[10px] text-gray-400 font-medium uppercase mt-0.5 truncate">
                                {tx.categories?.name || 'Tanpa Kategori'} • {tx.payment_method}
                            </p>
                        </div>
                    </div>
                    <p className={`font-black text-xs whitespace-nowrap ml-2 ${tx.categories?.type === 'income' ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {tx.categories?.type === 'income' ? '+' : '-'} {rupiah(tx.amount)}
                    </p>
                </div>
            ))}
        </div>
      </div>

    </div>
  );
}