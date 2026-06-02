import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import * as icons from 'lucide-react';

// --- KOMPONEN PENAFSIR IKON DINAMIS ---
const DynamicIcon = ({ name, size = 20, className = "" }) => {
  const LucideIcon = icons[name] || icons['HelpCircle'];
  if (!LucideIcon) return null;
  return <LucideIcon size={size} className={className} />;
};

export default function InputData() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedWallet, setSelectedWallet] = useState('');

  const [categories, setCategories] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [categoryFrequencies, setCategoryFrequencies] = useState({});
  
  // State untuk Modal "Lihat Lebih Banyak"
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchCategories();
      fetchWalletsAndCalculate();
    }
  }, [user, type]);

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('type', type)
      .order('name');
    setCategories(data || []);
    setSelectedCategory('');
  };

  const fetchWalletsAndCalculate = async () => {
    const now = new Date();
    const startDate = format(startOfMonth(now), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(now), 'yyyy-MM-dd');

    const { data: walletData } = await supabase.from('wallets').select('*').order('created_at');
    
    const { data: txData } = await supabase
        .from('transactions')
        .select('amount, wallet_id, category_id, categories(type)')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate);

    if (walletData && txData) {
        // --- HITUNG FREKUENSI KATEGORI ---
        const freq = {};
        txData.forEach(tx => {
            if (tx.category_id) {
                freq[tx.category_id] = (freq[tx.category_id] || 0) + 1;
            }
        });
        setCategoryFrequencies(freq);

        // --- HITUNG SALDO REALTIME ---
        const calculatedWallets = walletData.map(w => {
            const myTxs = txData.filter(t => String(t.wallet_id) === String(w.id));
            const totalIncome = myTxs.filter(t => t.categories?.type === 'income').reduce((acc, curr) => acc + Number(curr.amount), 0);
            const totalExpense = myTxs.filter(t => t.categories?.type === 'expense').reduce((acc, curr) => acc + Number(curr.amount), 0);
            const realBalance = (Number(w.saldo_awal) || 0) + totalIncome - totalExpense;
            return { ...w, balance: realBalance };
        });

        setWallets(calculatedWallets);
        if (calculatedWallets.length > 0 && !selectedWallet) setSelectedWallet(calculatedWallets[0].id);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || !selectedCategory || !selectedWallet) {
      toast.error('Mohon lengkapi data (Kategori & Sumber Dana)');
      return;
    }

    setLoading(true);
    try {
      const walletData = wallets.find(w => w.id === selectedWallet);
      const walletName = walletData ? walletData.name : 'Manual';

      const { error } = await supabase.from('transactions').insert([
        {
          user_id: user.id,
          amount: parseFloat(amount),
          transaction_date: date,
          description: description || (type === 'expense' ? 'Pengeluaran' : 'Pemasukan'),
          category_id: selectedCategory,
          wallet_id: selectedWallet,
          payment_method: walletName
        }
      ]);

      if (error) throw error;
      toast.success('Disimpan! 💾');
      navigate('/'); 
    } catch (error) { toast.error('Gagal: ' + error.message); } 
    finally { setLoading(false); }
  };

  const rupiahFormatter = (value) => {
    if (!value) return '';
    return new Intl.NumberFormat('id-ID').format(value);
  };

  const handleAmountChange = (e) => {
    const val = e.target.value.replace(/\D/g, '');
    setAmount(val);
  };

  // --- LOGIKA URUTAN KATEGORI (4 TERATAS) ---
  const sortedCategories = [...categories].sort((a, b) => {
      const freqA = categoryFrequencies[a.id] || 0;
      const freqB = categoryFrequencies[b.id] || 0;
      return freqB - freqA; 
  });

  // Ambil 4 teratas
  const topCategories = sortedCategories.slice(0, 4);
  const selectedCatData = categories.find(c => c.id === selectedCategory);
  
  // Jika user memilih dari modal yang bukan bagian Top 4, ganti slot ke-4 agar tetap tampil di depan
  const isOutsideTop4 = selectedCatData && !topCategories.some(c => c.id === selectedCategory);
  const displayCategories = isOutsideTop4 ? [...topCategories.slice(0, 3), selectedCatData] : topCategories;

  return (
    <div className={`min-h-screen w-full max-w-lg mx-auto pb-24 pt-0 md:pt-28 relative font-sans text-gray-800 transition-colors duration-500 ${type === 'income' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
      
      {/* HEADER */}
      <div className="bg-white/80 backdrop-blur-xl sticky top-0 z-20 px-6 pt-8 pb-6 shadow-[0_4px_30px_rgba(0,0,0,0.03)] border-b border-gray-100/50 rounded-b-[2rem]">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black text-gray-900 tracking-tight">Catat Transaksi</h2>
            <button onClick={() => navigate('/')} className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors font-bold">✕</button>
        </div>
        <div className="bg-gray-100/80 p-1.5 rounded-2xl flex relative">
            {['expense', 'income'].map((tab) => (
                <button
                    key={tab}
                    onClick={() => setType(tab)}
                    className={`flex-1 relative z-10 py-3 text-xs font-bold text-center uppercase tracking-wider transition-colors duration-200 ${
                        type === tab ? (tab === 'expense' ? 'text-rose-600' : 'text-emerald-600') : 'text-gray-400'
                    }`}
                >
                    {type === tab && (
                        <motion.div layoutId="active-pill" className="absolute inset-0 bg-white rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.05)] -z-10" transition={{ type: "spring", stiffness: 500, damping: 30 }} />
                    )}
                    {tab === 'expense' ? 'Pengeluaran' : 'Pemasukan'}
                </button>
            ))}
        </div>
      </div>

      {/* FORM */}
      <form onSubmit={handleSubmit} className="px-6 py-8 space-y-6">
        
        {/* Input Nominal */}
        <div className="bg-white p-8 rounded-[2rem] shadow-[0_8px_30px_rgba(0,0,0,0.02)] border border-gray-100 text-center transition-all duration-300">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-3">Nominal (Rp)</label>
            <input 
                type="text" 
                inputMode="numeric"
                placeholder="0"
                autoFocus
                value={rupiahFormatter(amount)}
                onChange={handleAmountChange}
                className={`w-full text-4xl md:text-5xl font-black text-center outline-none bg-transparent placeholder-gray-200 transition-colors duration-300 ${type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}
            />
        </div>

        {/* Details */}
        <div className="bg-white p-7 rounded-[2rem] shadow-[0_8px_30px_rgba(0,0,0,0.02)] border border-gray-100 space-y-7 transition-all duration-300">
            
            {/* Tanggal */}
            <div className="flex flex-col gap-2 border-b border-gray-50 pb-5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tanggal</label>
                <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full font-bold text-gray-900 bg-transparent outline-none text-sm" />
            </div>

            {/* Sumber Dana */}
            <div className="flex flex-col gap-2 border-b border-gray-50 pb-5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sumber Dana</label>
                <select 
                    value={selectedWallet || ''} 
                    onChange={(e) => setSelectedWallet(e.target.value)}
                    className="w-full font-bold text-gray-900 bg-transparent outline-none text-sm appearance-none py-1"
                >
                    {wallets.map(w => (
                        <option key={w.id} value={w.id}>
                            {w.name} ({new Intl.NumberFormat('id-ID').format(w.balance)})
                        </option>
                    ))}
                </select>
                <p className="text-[9px] text-gray-400 font-medium">*Saldo yang tampil adalah sisa dana bulan ini.</p>
            </div>

            {/* Kategori - QUICK SELECT GRID 4 KOTAK */}
            <div className="flex flex-col gap-3 border-b border-gray-50 pb-5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Kategori</label>
                
                {/* Responsive Grid: 2 kolom di HP (2x2), 4 kolom di layar agak besar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {displayCategories.map(c => (
                        <button
                            key={c.id}
                            type="button"
                            onClick={() => setSelectedCategory(c.id)}
                            className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl border transition-all duration-200 ${
                                selectedCategory === c.id 
                                ? (type === 'income' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' : 'bg-rose-50 border-rose-200 text-rose-700 shadow-sm')
                                : 'bg-gray-50/50 border-transparent text-gray-600 hover:bg-gray-100 hover:border-gray-200'
                            }`}
                        >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner ${
                                selectedCategory === c.id 
                                ? (type === 'income' ? 'bg-emerald-200/50 text-emerald-600' : 'bg-rose-200/50 text-rose-600')
                                : 'bg-white text-gray-400 shadow-sm'
                            }`}>
                                <DynamicIcon name={c.icon} size={20} />
                            </div>
                            <span className="text-[10px] font-bold truncate w-full text-center px-1">{c.name}</span>
                        </button>
                    ))}
                </div>

                {/* Teks "Lainnya" Estetik di pojok kanan bawah */}
                <div className="flex justify-end mt-1">
                    <button
                        type="button"
                        onClick={() => setIsCategoryModalOpen(true)}
                        className="text-[10px] font-bold text-gray-400 hover:text-gray-700 transition-colors flex items-center gap-1 group"
                    >
                        <span className="underline underline-offset-4 decoration-gray-300 group-hover:decoration-gray-500 uppercase tracking-widest">
                            Lainnya
                        </span>
                        <DynamicIcon name="ChevronRight" size={14} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>

            {/* Catatan */}
            <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Catatan</label>
                <textarea 
                    rows="3"
                    placeholder="Tulis catatan opsional..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-medium text-gray-800 text-sm outline-none placeholder-gray-300 resize-none focus:bg-white focus:border-gray-200 transition-colors"
                />
            </div>
        </div>

        {/* Submit */}
        <button 
            type="submit" 
            disabled={loading}
            className={`w-full py-4 rounded-2xl font-black text-white shadow-xl uppercase tracking-widest text-xs transition-all duration-300 active:scale-95 ${
                type === 'income' 
                ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200' 
                : 'bg-rose-500 hover:bg-rose-600 shadow-rose-200'
            }`}
        >
            {loading ? 'Menyimpan...' : 'Simpan Transaksi'}
        </button>
      </form>

      {/* --- MODAL BOTTOM SHEET: SEMUA KATEGORI --- */}
      <AnimatePresence>
        {isCategoryModalOpen && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-gray-900/40 backdrop-blur-sm p-0 sm:p-4">
                <motion.div 
                    initial={{ y: "100%" }} 
                    animate={{ y: 0 }} 
                    exit={{ y: "100%" }} 
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="w-full max-w-lg bg-white rounded-t-[2rem] sm:rounded-[2rem] p-6 pb-12 sm:pb-6 shadow-2xl max-h-[85vh] flex flex-col"
                >
                    {/* Handlebar untuk Mobile */}
                    <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6 sm:hidden"></div>
                    
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-black text-gray-900">Pilih Kategori</h3>
                        <button type="button" onClick={() => setIsCategoryModalOpen(false)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 font-bold hover:bg-gray-200 transition-colors">✕</button>
                    </div>

                    <div className="overflow-y-auto custom-scrollbar pr-2 grid grid-cols-3 sm:grid-cols-4 gap-3">
                        {categories.map(c => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                    setSelectedCategory(c.id);
                                    setIsCategoryModalOpen(false);
                                }}
                                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all ${
                                    selectedCategory === c.id 
                                    ? (type === 'income' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700')
                                    : 'bg-white border-gray-100 text-gray-600 hover:bg-gray-50 hover:border-gray-200 shadow-sm'
                                }`}
                            >
                                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                                    selectedCategory === c.id 
                                    ? (type === 'income' ? 'bg-emerald-200/50 text-emerald-600' : 'bg-rose-200/50 text-rose-600')
                                    : 'bg-gray-50 text-gray-400'
                                }`}>
                                    <DynamicIcon name={c.icon} size={22} />
                                </div>
                                <span className="text-[10px] font-bold text-center w-full truncate leading-tight px-1">{c.name}</span>
                            </button>
                        ))}
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

    </div>
  );
}