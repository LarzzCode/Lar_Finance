import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

export default function InputData() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState('expense'); 

  // Ref untuk memicu date picker browser secara manual
  const dateInputRef = useRef(null);

  const [formData, setFormData] = useState({
    transaction_date: new Date().toISOString().split('T')[0],
    category_id: '',
    description: '',
    payment_method: 'Cash',
    amount: ''
  });

  useEffect(() => {
    const fetchCats = async () => {
      const { data } = await supabase.from('categories').select('*');
      if (data) setCategories(data);
    };
    fetchCats();
  }, []);

  const filteredCategories = categories.filter(c => c.type === type);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from('transactions').insert([formData]);
    setLoading(false);
    
    if (error) {
      toast.error('Gagal: ' + error.message);
    } else {
      confetti({
        particleCount: 80, // Dikurangi biar ga heboh banget
        spread: 60,
        origin: { y: 0.6 },
        colors: type === 'income' ? ['#10B981', '#34D399'] : ['#EF4444', '#F87171']
      });

      toast.success(type === 'income' ? 'Pemasukan Tersimpan!' : 'Pengeluaran Tercatat!', {
        icon: type === 'income' ? '💰' : '💸',
        style: { borderRadius: '10px', background: '#333', color: '#fff' },
      });

      setFormData({ ...formData, amount: '', description: '', category_id: '' });
    }
  };

  const handleChange = (e) => setFormData({...formData, [e.target.name]: e.target.value});
  
  // Style Input Konsisten
  const inputClass = "mt-1 block w-full rounded-xl border-gray-300 shadow-sm focus:ring-opacity-50 sm:text-sm p-3 border transition-all duration-200 outline-none font-medium text-gray-700";
  const focusClass = type === 'income' ? 'focus:border-green-500 focus:ring-green-500' : 'focus:border-red-500 focus:ring-red-500';

  // Config Animasi (Lebih Kalem / Subtle)
  const subtleBounce = { scale: 1.01 }; // Cuma membesar 1% (sebelumnya 2-5%)
  const subtleTap = { scale: 0.99 };

  return (
    <div className={`min-h-[90vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-500 ${type === 'income' ? 'bg-green-50' : 'bg-red-50'}`}>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }} // Y dikurangi biar ga terlalu jauh naiknya
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-md w-full space-y-8 bg-white p-8 rounded-3xl shadow-xl border border-white/50 relative overflow-hidden"
      >
        {/* Dekorasi Background Blob (Opacity dikurangi biar lebih elegan) */}
        <div className={`absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-10 blur-3xl transition-colors duration-500 ${type === 'income' ? 'bg-green-400' : 'bg-red-400'}`}></div>
        <div className={`absolute -bottom-10 -left-10 w-40 h-40 rounded-full opacity-10 blur-3xl transition-colors duration-500 ${type === 'income' ? 'bg-emerald-400' : 'bg-orange-400'}`}></div>

        <div className="text-center relative z-10">
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">
            {type === 'income' ? 'Input Pemasukan' : 'Input Pengeluaran'}
          </h2>
          
          {/* SLIDING TOGGLE (Physics diketatin biar ga goyang banget) */}
          <div className="flex justify-center mt-6 bg-gray-100 p-1 rounded-xl w-full max-w-[300px] mx-auto relative cursor-pointer">
            <motion.div
              layoutId="active-pill"
              className="absolute top-1 bottom-1 rounded-lg bg-white shadow-sm z-0"
              initial={false}
              transition={{ type: "spring", stiffness: 400, damping: 40 }} // Damping dinaikkan = kurangi bounce
              style={{
                width: '48%',
                left: type === 'income' ? '1.5%' : '50.5%'
              }}
            />

            <button 
              type="button" onClick={() => { setType('income'); setFormData({...formData, category_id: ''}); }}
              className={`flex-1 py-2 rounded-lg text-sm font-bold z-10 transition-colors duration-200 relative ${type === 'income' ? 'text-green-600' : 'text-gray-500'}`}
            >
              Pemasukan
            </button>
            <button 
              type="button" onClick={() => { setType('expense'); setFormData({...formData, category_id: ''}); }}
              className={`flex-1 py-2 rounded-lg text-sm font-bold z-10 transition-colors duration-200 relative ${type === 'expense' ? 'text-red-600' : 'text-gray-500'}`}
            >
              Pengeluaran
            </button>
          </div>
        </div>
        
        <form className="mt-8 space-y-5 relative z-10" onSubmit={handleSubmit}>
          
          {/* CUSTOM DATE INPUT (Modern Look) */}
          <motion.div whileHover={subtleBounce} whileTap={subtleTap} className="relative cursor-pointer">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 ml-1">Tanggal</label>
            
            {/* Wrapper agar ikon bisa ditaruh di dalam */}
            <div 
              className="relative"
              onClick={() => dateInputRef.current.showPicker()} // Klik dimanapun di kotak ini akan buka kalender
            >
              <input 
                ref={dateInputRef}
                name="transaction_date" 
                type="date" 
                required 
                className={`${inputClass} ${focusClass} pl-10 cursor-pointer`} // Padding kiri untuk ikon
                value={formData.transaction_date} 
                onChange={handleChange} 
              />
              {/* Custom Calendar Icon (SVG) */}
              <div className={`absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors duration-300 ${type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </motion.div>

          {/* Kategori */}
          <motion.div whileHover={subtleBounce} whileTap={subtleTap}>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 ml-1">Kategori</label>
            <div className="relative">
              <select name="category_id" required className={`${inputClass} ${focusClass} appearance-none bg-white`} value={formData.category_id} onChange={handleChange}>
                <option value="">-- Pilih Kategori --</option>
                {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
              </div>
            </div>
          </motion.div>

          {/* Deskripsi */}
          <motion.div whileHover={subtleBounce} whileTap={subtleTap}>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 ml-1">Deskripsi</label>
            <input name="description" type="text" placeholder="Keterangan..." className={`${inputClass} ${focusClass}`} value={formData.description} onChange={handleChange} />
          </motion.div>
          
          <div className="grid grid-cols-2 gap-4">
             {/* Metode Bayar */}
            <motion.div whileHover={subtleBounce} whileTap={subtleTap}>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 ml-1">Metode</label>
              <select name="payment_method" className={`${inputClass} ${focusClass} bg-white`} value={formData.payment_method} onChange={handleChange}>
                <option value="Cash">Cash</option>
                <option value="Transfer_Mandiri">Transfer Mandiri</option>
                <option value="Transfer_Blu">Transfer Blu BCA</option>
              </select>
            </motion.div>

            {/* Nominal */}
            <motion.div whileHover={subtleBounce} whileTap={subtleTap}>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 ml-1">Nominal</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className={`font-bold sm:text-sm ${type === 'income' ? 'text-green-600' : 'text-red-600'}`}>Rp</span>
                </div>
                <input name="amount" type="number" required placeholder="0" className={`${inputClass} pl-10 font-bold ${focusClass}`} value={formData.amount} onChange={handleChange} />
              </div>
            </motion.div>
          </div>

          <motion.button 
            type="submit" 
            disabled={loading}
            whileHover={{ scale: 1.02 }} // Bounce button dikurangi drastis
            whileTap={{ scale: 0.98 }}
            className={`w-full flex justify-center py-4 px-4 border border-transparent text-sm font-bold rounded-xl text-white shadow-lg transition-all 
              ${type === 'income' 
                ? 'bg-gradient-to-r from-green-600 to-emerald-700 hover:shadow-green-500/20' 
                : 'bg-gradient-to-r from-red-600 to-orange-700 hover:shadow-red-500/20'
              }`}
          >
            {loading ? 'Menyimpan...' : 'SIMPAN DATA'}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}