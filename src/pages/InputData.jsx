import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';

export default function InputData() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState('expense'); // 'income' or 'expense'
  const { user } = useAuth();
  
  // State khusus untuk tampilan angka (Rp 50.000)
  const [displayAmount, setDisplayAmount] = useState('');

  const [formData, setFormData] = useState({
    transaction_date: new Date().toISOString().split('T')[0],
    category_id: '',
    description: '',
    payment_method: 'cash', 
    amount: '' // Nilai murni (angka saja) untuk database
  });

  useEffect(() => {
    const fetchCats = async () => {
      const { data } = await supabase.from('categories').select('*').order('name');
      if (data) setCategories(data);
    };
    fetchCats();
  }, []);

  const filteredCategories = categories.filter(c => c.type === type);

  // --- LOGIKA AUTO FORMAT RUPIAH ---
  const handleAmountChange = (e) => {
    // 1. Ambil input user, buang semua karakter selain angka
    const rawValue = e.target.value.replace(/[^0-9]/g, '');
    
    // 2. Simpan nilai murni ke formData
    setFormData({ ...formData, amount: rawValue });

    // 3. Format tampilan ke Rupiah (Rp 10.000)
    if (rawValue) {
      const formatted = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
      }).format(rawValue);
      setDisplayAmount(formatted);
    } else {
      setDisplayAmount('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amount || !formData.category_id) {
      toast.error("Nominal dan Kategori wajib diisi!");
      return;
    }
    
    setLoading(true);

    // HAPTIC FEEDBACK (Getar di HP)
    if (navigator.vibrate) navigator.vibrate(50);

    const payload = {
      ...formData,
      user_id: user?.id
    };

    const { error } = await supabase.from('transactions').insert([payload]);
    setLoading(false);
    
    if (error) {
      toast.error('Gagal: ' + error.message);
    } else {
      // Confetti Effect
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.8 }, // Confetti muncul dari bawah dekat tombol
        colors: type === 'income' ? ['#10B981', '#34D399'] : ['#EF4444', '#F87171']
      });

      toast.success(type === 'income' ? 'Pemasukan Tersimpan!' : 'Pengeluaran Tersimpan!', {
        icon: type === 'income' ? '💰' : '💸',
        style: { borderRadius: '12px', background: '#1F2937', color: '#fff' },
      });

      // Reset Form
      setFormData({ ...formData, amount: '', description: '', category_id: '', payment_method: 'cash' });
      setDisplayAmount('');
    }
  };

  const handleChange = (e) => setFormData({...formData, [e.target.name]: e.target.value});

  // Style Variables
  const theme = type === 'income' 
    ? { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'focus:border-emerald-500', ring: 'focus:ring-emerald-200', btn: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/30' }
    : { bg: 'bg-red-50', text: 'text-red-600', border: 'focus:border-red-500', ring: 'focus:ring-red-200', btn: 'bg-red-600 hover:bg-red-700 shadow-red-500/30' };

  return (
    <div className={`min-h-screen w-full flex flex-col items-center pt-20 pb-24 px-4 transition-colors duration-500 ${theme.bg}`}>
      
      {/* 1. SWITCHER (INCOME / EXPENSE) */}
      <div className="w-full max-w-xs bg-white/50 p-1 rounded-2xl flex relative mb-8 backdrop-blur-sm border border-white/40 shadow-sm">
        <motion.div
          layoutId="active-pill"
          className="absolute top-1 bottom-1 rounded-xl bg-white shadow-sm z-0"
          initial={false}
          animate={{
            width: '48%',
            left: type === 'income' ? '1.5%' : '50.5%'
          }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
        <button 
          onClick={() => { setType('income'); setFormData({...formData, category_id: ''}); }}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold z-10 relative transition-colors ${type === 'income' ? 'text-emerald-600' : 'text-gray-500'}`}
        >
          Pemasukan
        </button>
        <button 
          onClick={() => { setType('expense'); setFormData({...formData, category_id: ''}); }}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold z-10 relative transition-colors ${type === 'expense' ? 'text-red-600' : 'text-gray-500'}`}
        >
          Pengeluaran
        </button>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-md flex flex-col flex-grow">
        
        {/* 2. HERO INPUT (BIG MONEY DISPLAY) */}
        <div className="flex flex-col items-center justify-center mb-8">
          <label className={`text-xs font-bold uppercase tracking-widest mb-2 ${theme.text} opacity-70`}>
            Masukkan Nominal
          </label>
          <div className="relative w-full">
            <input
              type="text"
              inputMode="numeric" // Memunculkan keyboard angka di HP
              placeholder="Rp 0"
              value={displayAmount}
              onChange={handleAmountChange}
              className={`w-full text-center bg-transparent text-4xl sm:text-5xl font-black placeholder-gray-300 border-none focus:ring-0 outline-none transition-colors duration-300 ${theme.text}`}
              autoFocus
            />
          </div>
        </div>

        {/* 3. DETAILS CARD (GLASSMORPHISM) */}
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-xl space-y-5 flex-grow"
        >
          {/* Row 1: Date & Category */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase ml-1">Tanggal</label>
              <input 
                type="date" 
                name="transaction_date"
                required
                className={`w-full px-4 py-3 rounded-2xl bg-white border-none shadow-sm text-sm font-bold text-gray-700 outline-none focus:ring-2 transition-all ${theme.ring}`}
                value={formData.transaction_date}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase ml-1">Kategori</label>
              <select 
                name="category_id" 
                required
                className={`w-full px-4 py-3 rounded-2xl bg-white border-none shadow-sm text-sm font-bold text-gray-700 outline-none focus:ring-2 transition-all ${theme.ring}`}
                value={formData.category_id}
                onChange={handleChange}
              >
                <option value="">-- Pilih --</option>
                {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Row 2: Payment Method */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400 uppercase ml-1">Dompet / Akun</label>
            <div className="grid grid-cols-3 gap-2">
              {['cash', 'Tf mandiri', 'Tf blu bca'].map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setFormData({...formData, payment_method: method})}
                  className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all ${
                    formData.payment_method === method 
                      ? `bg-white border-transparent shadow-md ${theme.text} ring-2 ring-opacity-50 ${type === 'income' ? 'ring-emerald-400' : 'ring-red-400'}`
                      : 'bg-white/50 border-transparent text-gray-400 hover:bg-white'
                  }`}
                >
                  {method === 'cash' ? 'Tunai' : method.replace('Tf ', '')}
                </button>
              ))}
            </div>
          </div>

          {/* Row 3: Description */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400 uppercase ml-1">Catatan (Opsional)</label>
            <textarea 
              name="description"
              rows="2"
              placeholder="Beli makan siang, bayar parkir..."
              className={`w-full px-4 py-3 rounded-2xl bg-white border-none shadow-sm text-sm font-medium text-gray-700 outline-none focus:ring-2 transition-all resize-none ${theme.ring}`}
              value={formData.description}
              onChange={handleChange}
            />
          </div>

          {/* SUBMIT BUTTON (FLOATING FEEL) */}
          <div className="pt-2">
            <motion.button 
              type="submit" 
              disabled={loading}
              whileTap={{ scale: 0.95 }}
              className={`w-full py-4 rounded-2xl text-white font-bold text-lg shadow-lg transition-all flex justify-center items-center gap-2 ${theme.btn}`}
            >
              {loading ? (
                <span className="animate-pulse">Menyimpan...</span>
              ) : (
                <>
                  <span>Simpan Transaksi</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </>
              )}
            </motion.button>
          </div>

        </motion.div>
      </form>
    </div>
  );
}