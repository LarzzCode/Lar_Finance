import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';

export default function InputData() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState('expense'); 
  const { user } = useAuth();
  
  const [displayAmount, setDisplayAmount] = useState('');

  const [formData, setFormData] = useState({
    transaction_date: new Date().toISOString().split('T')[0],
    category_id: '',
    description: '',
    payment_method: 'cash', 
    amount: ''
  });

  useEffect(() => {
    const fetchCats = async () => {
      const { data } = await supabase.from('categories').select('*').order('name');
      if (data) setCategories(data);
    };
    fetchCats();
  }, []);

  const filteredCategories = categories.filter(c => c.type === type);

  const handleAmountChange = (e) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, '');
    setFormData({ ...formData, amount: rawValue });
    if (rawValue) {
      const formatted = new Intl.NumberFormat('id-ID', {
        style: 'currency', currency: 'IDR', minimumFractionDigits: 0
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
    if (navigator.vibrate) navigator.vibrate(50);

    const payload = { ...formData, user_id: user?.id };
    const { error } = await supabase.from('transactions').insert([payload]);
    setLoading(false);
    
    if (error) {
      toast.error('Gagal: ' + error.message);
    } else {
      confetti({
        particleCount: 80, spread: 70, origin: { y: 0.8 },
        colors: type === 'income' ? ['#10B981', '#34D399'] : ['#EF4444', '#F87171']
      });

      toast.success(type === 'income' ? 'Pemasukan Tersimpan!' : 'Pengeluaran Tersimpan!', {
        icon: type === 'income' ? '💰' : '💸',
        style: { borderRadius: '12px', background: '#1F2937', color: '#fff' },
      });

      setFormData({ ...formData, amount: '', description: '', category_id: '', payment_method: 'cash' });
      setDisplayAmount('');
    }
  };

  const handleChange = (e) => setFormData({...formData, [e.target.name]: e.target.value});

  // THEME CONFIGURATION
  const theme = type === 'income' 
    ? { 
        text: 'text-emerald-700', 
        // Gradient Hijau Lembut
        bgGradient: 'from-emerald-100/80 via-emerald-50/50 to-white', 
        ring: 'focus:ring-emerald-200', 
        btn: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' 
      }
    : { 
        text: 'text-rose-700', 
        // Gradient Merah Lembut
        bgGradient: 'from-rose-100/80 via-rose-50/50 to-white', 
        ring: 'focus:ring-rose-200', 
        btn: 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20' 
      };

  return (
    <div className="min-h-screen w-full flex flex-col items-center pt-20 pb-24 px-4 relative overflow-hidden bg-white">
      
      {/* --- LAYER 0: BACKGROUND COMPLEX --- */}
      <div className="absolute inset-0 w-full h-full z-0">
        
        {/* 1. Base Gradient (Warna Cahaya dari Atas) */}
        <div className={`absolute inset-0 w-full h-[70%] bg-gradient-to-b transition-colors duration-700 ease-in-out ${theme.bgGradient}`} />
        
        {/* 2. Grid Pattern Overlay (Efek Kotak-kotak Halus) */}
        {/* Menggunakan CSS gradient untuk membuat garis tipis */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
      </div>

      {/* --- LAYER 1: KONTEN UTAMA --- */}
      <div className="w-full max-w-md flex flex-col items-center flex-grow z-10">

        {/* SWITCHER */}
        <div className="w-full max-w-xs bg-white/60 p-1 rounded-2xl flex relative mb-6 border border-white/60 shadow-sm backdrop-blur-sm">
          <motion.div
            layoutId="active-pill"
            className="absolute top-1 bottom-1 rounded-xl bg-white border border-gray-100 shadow-sm z-0"
            initial={false}
            animate={{
              width: '48%',
              left: type === 'income' ? '1.5%' : '50.5%'
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
          <button 
            onClick={() => { setType('income'); setFormData({...formData, category_id: ''}); }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold z-10 relative transition-colors ${type === 'income' ? 'text-emerald-700' : 'text-gray-500'}`}
          >
            Pemasukan
          </button>
          <button 
            onClick={() => { setType('expense'); setFormData({...formData, category_id: ''}); }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold z-10 relative transition-colors ${type === 'expense' ? 'text-rose-700' : 'text-gray-500'}`}
          >
            Pengeluaran
          </button>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col flex-grow">
          
          {/* HERO INPUT */}
          <div className="flex flex-col items-center justify-center mb-8">
            <label className="text-[10px] font-bold uppercase tracking-widest mb-1 text-gray-500/80">
              Total Nominal
            </label>
            <div className="relative w-full">
              <input
                type="text"
                inputMode="numeric" 
                placeholder="Rp 0"
                value={displayAmount}
                onChange={handleAmountChange}
                className={`w-full text-center bg-transparent text-5xl font-black placeholder-gray-400/30 border-none focus:ring-0 outline-none transition-colors duration-300 drop-shadow-sm ${theme.text}`}
                autoFocus
              />
            </div>
          </div>

          {/* DETAILS CARD */}
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white/90 backdrop-blur-xl border border-white/60 rounded-[2rem] p-6 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] space-y-5 flex-grow"
          >
            {/* Row 1: Date & Category */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase ml-3">Tanggal</label>
                <input 
                  type="date" 
                  name="transaction_date" required
                  className={`w-full px-4 py-3.5 rounded-2xl bg-gray-50 border-transparent focus:bg-white shadow-sm text-sm font-bold text-gray-700 outline-none focus:ring-2 transition-all ${theme.ring}`}
                  value={formData.transaction_date}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase ml-3">Kategori</label>
                <select 
                  name="category_id" required
                  className={`w-full px-4 py-3.5 rounded-2xl bg-gray-50 border-transparent focus:bg-white shadow-sm text-sm font-bold text-gray-700 outline-none focus:ring-2 transition-all ${theme.ring}`}
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
              <label className="text-[10px] font-bold text-gray-500 uppercase ml-3">Sumber Dana</label>
              <div className="grid grid-cols-3 gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
                {['cash', 'Tf mandiri', 'Tf blu bca'].map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setFormData({...formData, payment_method: method})}
                    className={`py-2 px-1 rounded-xl text-xs font-bold transition-all ${
                      formData.payment_method === method 
                        ? `bg-white shadow-sm text-gray-800 ring-1 ${type === 'income' ? 'ring-emerald-200' : 'ring-rose-200'}`
                        : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'
                    }`}
                  >
                    {method === 'cash' ? 'Tunai' : method.replace('Tf ', '')}
                  </button>
                ))}
              </div>
            </div>

            {/* Row 3: Description */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase ml-3">Catatan</label>
              <textarea 
                name="description" rows="2"
                placeholder="Tulis keterangan..."
                className={`w-full px-5 py-3.5 rounded-2xl bg-gray-50 border-transparent focus:bg-white shadow-sm text-sm font-medium text-gray-700 outline-none focus:ring-2 transition-all resize-none ${theme.ring}`}
                value={formData.description}
                onChange={handleChange}
              />
            </div>

            {/* SUBMIT BUTTON */}
            <div className="pt-2">
              <motion.button 
                type="submit" disabled={loading}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className={`w-full py-4 rounded-2xl text-white font-bold text-lg transition-all flex justify-center items-center gap-2 ${theme.btn}`}
              >
                {loading ? (
                  <span className="animate-pulse">Menyimpan...</span>
                ) : (
                  <>
                    <span>Simpan</span>
                    
                  </>
                )}
              </motion.button>
            </div>

          </motion.div>
        </form>
      </div>
    </div>
  );
}