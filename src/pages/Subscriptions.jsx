import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format, startOfMonth, endOfMonth, getDate } from 'date-fns'; // getDate untuk ambil tanggal hari ini
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

export default function Subscriptions() {
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, unpaid, paid

  // State Form
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    category_id: '',
    payment_method: 'cash',
    due_date: '1'
  });

  // State Summary
  const [stats, setStats] = useState({ totalBill: 0, paid: 0, remaining: 0 });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const start = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const end = format(endOfMonth(new Date()), 'yyyy-MM-dd');

    // 1. Ambil Master Langganan
    const { data: subsData } = await supabase
      .from('subscriptions')
      .select('*, categories(name)')
      .order('due_date', { ascending: true });

    // 2. Ambil Transaksi Bulan Ini (Cek Status Bayar)
    const { data: transData } = await supabase
      .from('transactions')
      .select('description, amount')
      .gte('transaction_date', start)
      .lte('transaction_date', end);

    // 3. Ambil Kategori
    const { data: catData } = await supabase
      .from('categories')
      .select('*')
      .eq('type', 'expense');

    let total = 0;
    let alreadyPaid = 0;

    // 4. LOGIKA PENGGABUNGAN
    const mergedData = subsData?.map(sub => {
      // Cek apakah sudah dibayar (match nama)
      const isPaid = transData.some(t => t.description.toLowerCase() === sub.name.toLowerCase());
      
      total += Number(sub.amount);
      if (isPaid) alreadyPaid += Number(sub.amount);

      return { ...sub, isPaid };
    });

    setSubscriptions(mergedData || []);
    setCategories(catData || []);
    setStats({
      totalBill: total,
      paid: alreadyPaid,
      remaining: total - alreadyPaid
    });
    setLoading(false);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('subscriptions').insert([{...formData, user_id: user.id}]);
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Langganan disimpan!');
      setIsFormOpen(false);
      setFormData({ name: '', amount: '', category_id: '', payment_method: 'cash', due_date: '1' });
      fetchData();
    }
  };

  const handleDelete = async (id) => {
    if(!confirm('Hapus langganan ini?')) return;
    const { error } = await supabase.from('subscriptions').delete().eq('id', id);
    if (!error) {
      toast.success('Dihapus!');
      fetchData();
    }
  };

  const handlePayNow = async (sub) => {
    const today = new Date();
    const txDate = format(today, 'yyyy-MM-dd');

    const newTx = {
      amount: sub.amount,
      category_id: sub.category_id,
      description: sub.name, 
      payment_method: sub.payment_method,
      transaction_date: txDate,
      user_id: user.id
    };

    const { error } = await supabase.from('transactions').insert([newTx]);

    if (error) {
      toast.error('Gagal bayar: ' + error.message);
    } else {
      // Efek Confetti saat lunas
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      toast.success(`Tagihan ${sub.name} Lunas!`);
      fetchData(); 
    }
  };

  const rupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

  // Helper: Hitung sisa hari
  const getDaysStatus = (due_date, isPaid) => {
    if (isPaid) return { text: 'Lunas', color: 'text-green-600 bg-green-100' };
    
    const today = getDate(new Date()); // Tanggal hari ini (1-31)
    const diff = due_date - today;

    if (diff === 0) return { text: 'Hari Ini!', color: 'text-red-600 bg-red-100 animate-pulse' };
    if (diff < 0) return { text: `Telat ${Math.abs(diff)} hari`, color: 'text-red-700 bg-red-200' };
    if (diff <= 3) return { text: `${diff} hari lagi`, color: 'text-orange-600 bg-orange-100' };
    return { text: `H-${diff}`, color: 'text-blue-600 bg-blue-100' };
  };

  // Filter List
  const filteredSubs = subscriptions.filter(sub => {
    if (filter === 'paid') return sub.isPaid;
    if (filter === 'unpaid') return !sub.isPaid;
    return true;
  });

  return (
    <div className="min-h-screen w-full max-w-4xl mx-auto px-4 pt-20 pb-24 md:pt-24 md:pb-8">
      
      {/* HEADER & ADD BUTTON */}
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-black text-gray-800">Langganan Rutin</h2>
          <p className="text-sm text-gray-500">Kelola tagihan bulananmu.</p>
        </div>
        <button 
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg hover:bg-indigo-700 transition-transform active:scale-95"
        >
          {isFormOpen ? 'Tutup' : '+ Tambah'}
        </button>
      </div>

      {/* SUMMARY STATS (Interaktif) */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm text-center">
          <p className="text-xs text-indigo-400 font-bold uppercase mb-1">Total Tagihan</p>
          <p className="text-sm sm:text-lg font-black text-gray-800">{rupiah(stats.totalBill)}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-green-100 shadow-sm text-center">
          <p className="text-xs text-green-500 font-bold uppercase mb-1">Sudah Bayar</p>
          <p className="text-sm sm:text-lg font-black text-green-600">{rupiah(stats.paid)}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-red-100 shadow-sm text-center">
          <p className="text-xs text-red-500 font-bold uppercase mb-1">Sisa Beban</p>
          <p className="text-sm sm:text-lg font-black text-red-600">{rupiah(stats.remaining)}</p>
        </div>
      </div>

      {/* FORM INPUT (Slide Down Animation) */}
      <AnimatePresence>
        {isFormOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-8"
          >
            <form onSubmit={handleAdd} className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Tagihan</label>
                <input type="text" placeholder="Netflix, Listrik..." className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" required
                  value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nominal (Rp)</label>
                <input type="number" placeholder="0" className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" required
                  value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Kategori</label>
                <select className="w-full p-3 border rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-none" required
                  value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})}>
                  <option value="">-- Pilih --</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Metode Bayar</label>
                <select className="w-full p-3 border rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-none" 
                  value={formData.payment_method} onChange={e => setFormData({...formData, payment_method: e.target.value})}>
                  <option value="cash">cash</option>
                  <option value="Tf mandiri">Tf mandiri</option>
                  <option value="Tf blu bca">Tf blu bca</option>
                </select>
              </div>
              <div className="md:col-span-2 flex gap-4 items-end">
                <div className="w-1/3">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tgl Jatuh Tempo</label>
                  <input type="number" min="1" max="31" className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" required
                    value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} />
                </div>
                <button type="submit" className="w-2/3 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-md">
                  Simpan Langganan
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FILTER TABS */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {['all', 'unpaid', 'paid'].map(t => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-all whitespace-nowrap ${
              filter === t ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {t === 'all' ? 'Semua' : (t === 'unpaid' ? 'Belum Bayar' : 'Lunas')}
          </button>
        ))}
      </div>

      {/* LIST SUBSCRIPTIONS (Staggered Animation) */}
      <div className="grid gap-4">
        <AnimatePresence mode='popLayout'>
          {loading ? <p className="text-center text-gray-400">Memuat data...</p> : filteredSubs.map((sub) => {
             const status = getDaysStatus(sub.due_date, sub.isPaid);
             
             return (
              <motion.div 
                key={sub.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`bg-white p-5 rounded-2xl shadow-sm border transition-all ${sub.isPaid ? 'border-green-200 opacity-80' : 'border-gray-100 hover:border-indigo-200'}`}
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  
                  {/* Left: Info */}
                  <div className="flex items-center gap-4">
                    {/* Date Badge */}
                    <div className="flex flex-col items-center justify-center w-14 h-14 bg-gray-50 rounded-2xl border border-gray-100 text-gray-700">
                      <span className="text-[10px] font-bold uppercase tracking-wider">TGL</span>
                      <span className="text-xl font-black">{sub.due_date}</span>
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        {sub.name}
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${status.color}`}>
                          {status.text}
                        </span>
                      </h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {sub.categories?.name} • <span className="capitalize">{sub.payment_method}</span>
                      </p>
                    </div>
                  </div>

                  {/* Right: Amount & Action */}
                  <div className="flex items-center justify-between w-full sm:w-auto gap-4 mt-2 sm:mt-0">
                    <div className="text-right">
                      <p className="text-lg font-black text-gray-800">{rupiah(sub.amount)}</p>
                    </div>

                    {sub.isPaid ? (
                      <div className="flex gap-2">
                        <span className="w-10 h-10 flex items-center justify-center bg-green-100 text-green-600 rounded-xl">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </span>
                        <button onClick={() => handleDelete(sub.id)} className="w-10 h-10 flex items-center justify-center bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-colors">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handlePayNow(sub)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95"
                        >
                          Bayar
                        </button>
                        <button onClick={() => handleDelete(sub.id)} className="w-10 h-10 flex items-center justify-center bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-colors">
                           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredSubs.length === 0 && !loading && (
          <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-3xl">
            <p className="text-gray-400 font-medium">Tidak ada tagihan di sini.</p>
          </div>
        )}
      </div>
    </div>
  );
}