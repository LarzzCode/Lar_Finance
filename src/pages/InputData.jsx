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
  const [type, setType] = useState('expense');
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
    // Auto-select wallet pertama
    if (data && data.length > 0 && !selectedWallet) {
        setSelectedWallet(data[0].id);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || !selectedCategory || !selectedWallet) {
      toast.error('Mohon lengkapi data');
      return;
    }

    setLoading(true);
    try {
      // 1. CARI NAMA DOMPET BERDASARKAN ID
      // Agar yang tersimpan di 'payment_method' adalah nama dompetnya (misal: 'Mandiri')
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
          payment_method: walletName // <--- PERBAIKAN DISINI (Dulu hardcode 'Manual')
        }
      ]);

      if (error) throw error;
      toast.success('Disimpan! 💾');
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
    <div className={`min-h-screen w-full max-w-lg mx-auto pb-24 pt-0 md:pt-28 relative font-sans text-gray-800 transition-colors duration-500 ${type === 'income' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
      
      {/* HEADER */}
      <div className="bg-white sticky top-0 z-20 px-6 pt-8 pb-6 shadow-sm border-b border-gray-100 rounded-b-[2rem]">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black text-gray-800">Catat Transaksi</h2>
            <button onClick={() => navigate('/')} className="w-8 h-8 flex items-center justify-center bg-gray-50 rounded-full text-gray-400 hover:bg-gray-100 font-bold">✕</button>
        </div>
        <div className="bg-gray-50 p-1.5 rounded-2xl flex relative">
            {['expense', 'income'].map((tab) => (
                <button
                    key={tab}
                    onClick={() => setType(tab)}
                    className={`flex-1 relative z-10 py-3 text-xs font-bold text-center uppercase tracking-wider transition-colors duration-200 ${
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

      {/* FORM */}
      <form onSubmit={handleSubmit} className="px-6 py-8 space-y-6">
        
        {/* Input Nominal */}
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 text-center transition-all duration-300">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-3">Nominal (Rp)</label>
            <input 
                type="text" 
                inputMode="numeric"
                placeholder="0"
                autoFocus
                value={rupiahFormatter(amount)}
                onChange={handleAmountChange}
                className={`w-full text-4xl md:text-5xl font-black text-center outline-none bg-transparent placeholder-gray-200 transition-colors duration-300 ${type === 'income' ? 'text-emerald-600' : 'text-rose-500'}`}
            />
        </div>

        {/* Details */}
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 space-y-6 transition-all duration-300">
            {/* Tanggal */}
            <div className="flex flex-col gap-2 border-b border-gray-50 pb-4">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Tanggal</label>
                <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full font-bold text-gray-800 bg-transparent outline-none text-sm" />
            </div>

            {/* Dompet */}
            <div className="flex flex-col gap-2 border-b border-gray-50 pb-4">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Sumber Dana</label>
                <select 
                    value={selectedWallet || ''} 
                    onChange={(e) => setSelectedWallet(e.target.value)}
                    className="w-full font-bold text-gray-800 bg-transparent outline-none text-sm appearance-none py-1"
                >
                    {wallets.map(w => (
                        <option key={w.id} value={w.id}>{w.name} ({new Intl.NumberFormat('id-ID').format(w.saldo_awal)})</option>
                    ))}
                </select>
            </div>

            {/* Kategori */}
            <div className="flex flex-col gap-2 border-b border-gray-50 pb-4">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Kategori</label>
                <select 
                    value={selectedCategory} 
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full font-bold text-gray-800 bg-transparent outline-none text-sm appearance-none py-1"
                >
                    <option value="" disabled>Pilih Kategori...</option>
                    {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            </div>

            {/* Catatan */}
            <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Catatan</label>
                <textarea 
                    rows="3"
                    placeholder="Tulis catatan..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-4 bg-gray-50 rounded-2xl font-bold text-gray-800 text-sm outline-none placeholder-gray-300 resize-none focus:bg-gray-100 transition-colors"
                />
            </div>
        </div>

        {/* Submit */}
        <button 
            type="submit" 
            disabled={loading}
            className={`w-full py-4 rounded-2xl font-bold text-white shadow-xl uppercase tracking-widest text-xs transition-all duration-300 active:scale-95 ${
                type === 'income' 
                ? 'bg-emerald-600 shadow-emerald-200' 
                : 'bg-rose-600 shadow-rose-200'
            }`}
        >
            {loading ? 'Menyimpan...' : 'Simpan Transaksi'}
        </button>

      </form>
    </div>
  );
}