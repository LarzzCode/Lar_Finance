import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function InputData() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [type, setType] = useState('expense'); // 'expense' | 'income'
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedWallet, setSelectedWallet] = useState('');

  const [categories, setCategories] = useState([]);
  const [wallets, setWallets] = useState([]);

  useEffect(() => {
    if (user) {
      fetchCategories();
      fetchWallets();
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

  const fetchWallets = async () => {
    const { data } = await supabase.from('wallets').select('*').order('created_at');
    setWallets(data || []);
    if (data && data.length > 0 && !selectedWallet) setSelectedWallet(data[0].id);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || !selectedCategory || !selectedWallet) {
      toast.error('Mohon lengkapi Nominal, Kategori, dan Dompet');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('transactions').insert([{
          user_id: user.id,
          amount: parseFloat(amount),
          transaction_date: date,
          description: description || (type === 'expense' ? 'Pengeluaran' : 'Pemasukan'),
          category_id: selectedCategory,
          wallet_id: selectedWallet,
          payment_method: 'Manual'
      }]);
      if (error) throw error;
      toast.success('Transaksi Disimpan! 💾');
      navigate('/'); 
    } catch (error) {
      toast.error('Gagal: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const rupiahFormatter = (value) => {
    if (!value) return '';
    return new Intl.NumberFormat('id-ID').format(value);
  };

  const handleAmountChange = (e) => {
    const val = e.target.value.replace(/\D/g, '');
    setAmount(val);
  };

  return (
    // FIX BACKGROUND DINAMIS:
    // Jika Income -> bg-emerald-50
    // Jika Expense -> bg-rose-50
    // transisi smooth (duration-500)
    <div 
        className={`min-h-screen w-full max-w-lg mx-auto pb-24 pt-0 md:pt-28 relative font-sans text-gray-800 transition-colors duration-500 ${
            type === 'income' ? 'bg-emerald-50' : 'bg-rose-50'
        }`}
    >
      
      {/* HEADER */}
      <div className="bg-white sticky top-0 z-20 px-6 pt-6 pb-4 shadow-sm border-b border-gray-100 rounded-b-[2rem]">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black text-gray-800">Catat Transaksi ✍️</h2>
            <button onClick={() => navigate('/')} className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200">✕</button>
        </div>

        {/* Tab Switcher */}
        <div className="bg-gray-100 p-1.5 rounded-2xl flex relative">
            {['expense', 'income'].map((tab) => (
                <button
                    key={tab}
                    onClick={() => setType(tab)}
                    className={`flex-1 relative z-10 py-3 text-sm font-bold text-center transition-colors duration-200 ${
                        type === tab 
                        ? (tab === 'expense' ? 'text-rose-600' : 'text-emerald-600') 
                        : 'text-gray-400'
                    }`}
                >
                    {type === tab && (
                        <motion.div
                            layoutId="active-pill"
                            className="absolute inset-0 bg-white rounded-xl shadow-sm -z-10"
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                    )}
                    {tab === 'expense' ? 'Pengeluaran' : 'Pemasukan'}
                </button>
            ))}
        </div>
      </div>

      {/* FORM BODY */}
      <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6">
        
        {/* Input Nominal */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 text-center transition-all duration-300 hover:shadow-md">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Nominal (Rp)</label>
            <input 
                type="text" inputMode="numeric" placeholder="0" autoFocus
                value={rupiahFormatter(amount)} onChange={handleAmountChange}
                className={`w-full text-4xl md:text-5xl font-black text-center outline-none bg-transparent placeholder-gray-200 transition-colors duration-300 ${type === 'income' ? 'text-emerald-600' : 'text-rose-500'}`}
            />
        </div>

        {/* Detail Inputs */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-5 transition-all duration-300 hover:shadow-md">
            {/* Tanggal */}
            <div className="flex items-center gap-3 border-b border-gray-50 pb-3">
                <span className="text-xl">📅</span>
                <div className="flex-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Tanggal</label>
                    <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full font-bold text-gray-700 bg-transparent outline-none text-sm" />
                </div>
            </div>

            {/* Dompet */}
            <div className="flex items-center gap-3 border-b border-gray-50 pb-3">
                <span className="text-xl">💳</span>
                <div className="flex-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Dompet Sumber</label>
                    <select value={selectedWallet || ''} onChange={(e) => setSelectedWallet(e.target.value)} className="w-full font-bold text-gray-700 bg-transparent outline-none text-sm appearance-none py-1">
                        {wallets.map(w => (
                            <option key={w.id} value={w.id}>{w.name} ({new Intl.NumberFormat('id-ID').format(w.saldo_awal)})</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Kategori */}
            <div className="flex items-center gap-3 border-b border-gray-50 pb-3">
                <span className="text-xl">🏷️</span>
                <div className="flex-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Kategori</label>
                    <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full font-bold text-gray-700 bg-transparent outline-none text-sm appearance-none py-1">
                        <option value="" disabled>Pilih Kategori...</option>
                        {categories.map(c => ( <option key={c.id} value={c.id}>{c.icon} {c.name}</option> ))}
                    </select>
                </div>
            </div>

            {/* Catatan */}
            <div className="pt-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-2 ml-1">Catatan Transaksi</label>
                <textarea rows="3" placeholder="Contoh: Makan siang..." value={description} onChange={(e) => setDescription(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl font-bold text-gray-700 text-sm outline-none placeholder-gray-300 resize-none focus:bg-gray-100 transition-colors" />
            </div>
        </div>

        {/* Submit Button */}
        <button 
            type="submit" 
            disabled={loading} 
            className={`w-full py-4 rounded-2xl font-black text-white shadow-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 ${
                type === 'income' 
                ? 'bg-emerald-500 shadow-emerald-200 hover:bg-emerald-600' 
                : 'bg-rose-500 shadow-rose-200 hover:bg-rose-600'
            }`}
        >
            {loading ? 'Menyimpan...' : ( <> <span>Simpan</span> <span>{type === 'income' ? '📥' : '📤'}</span> </> )}
        </button>
      </form>
    </div>
  );
}