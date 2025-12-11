import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export default function Budgeting() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  
  // State Form
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({ category_id: '', amount: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const start = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const end = format(endOfMonth(new Date()), 'yyyy-MM-dd');

    // 1. Ambil Data Budget User
    const { data: budgetData } = await supabase
      .from('budgets')
      .select('*, categories(name, type)')
      .order('amount', { ascending: false });

    // 2. PERBAIKAN DI SINI (Gunakan !inner untuk filter relasi)
    const { data: transData, error } = await supabase
      .from('transactions')
      // Tambahkan 'categories!inner(type)' agar bisa difilter
      .select('amount, category_id, categories!inner(type)') 
      .eq('categories.type', 'expense') 
      .gte('transaction_date', start)
      .lte('transaction_date', end);

    if (error) console.error("Error fetching transactions:", error);

    // 3. Ambil Kategori
    const { data: catData } = await supabase
      .from('categories')
      .select('*')
      .eq('type', 'expense');

    // 4. PERBAIKAN SAFETY (Tambahkan || [] agar tidak crash jika null)
    const validTransData = transData || []; 

    const processedBudgets = budgetData?.map(b => {
      const spent = validTransData
        .filter(t => t.category_id === b.category_id)
        .reduce((acc, curr) => acc + Number(curr.amount), 0);
      
      const percentage = Math.min((spent / b.amount) * 100, 100);
      
      return { ...b, spent, percentage };
    });

    setBudgets(processedBudgets || []);
    setCategories(catData || []);
    setLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.category_id || !formData.amount) return;

    // Cek apakah budget untuk kategori ini sudah ada?
    const existing = budgets.find(b => b.category_id === parseInt(formData.category_id));
    
    if (existing) {
      // Update jika sudah ada
      const { error } = await supabase
        .from('budgets')
        .update({ amount: formData.amount })
        .eq('id', existing.id);
      if (error) toast.error(error.message);
      else toast.success('Budget diperbarui!');
    } else {
      // Insert baru
      const { error } = await supabase.from('budgets').insert([formData]);
      if (error) toast.error(error.message);
      else toast.success('Budget baru dibuat!');
    }

    setIsFormOpen(false);
    setFormData({ category_id: '', amount: '' });
    fetchData();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus budget ini?')) return;
    const { error } = await supabase.from('budgets').delete().eq('id', id);
    if (!error) {
      toast.success('Budget dihapus');
      fetchData();
    }
  };

  const rupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

  // Helper Warna Progress Bar
  const getProgressColor = (percent) => {
    if (percent >= 100) return 'bg-red-500';
    if (percent >= 75) return 'bg-orange-400';
    return 'bg-green-500';
  };

  const getCardStatus = (percent) => {
    if (percent >= 100) return 'border-red-200 bg-red-50';
    if (percent >= 75) return 'border-orange-100 bg-white';
    return 'border-gray-100 bg-white';
  };

  return (
    <div className="min-h-screen w-full max-w-4xl mx-auto px-4 pt-20 pb-24 md:pt-24 md:pb-8">
      
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-2xl font-black text-gray-800">Budgeting Bulanan</h2>
          <p className="text-sm text-gray-500">Jaga pengeluaranmu agar tidak boncos.</p>
        </div>
        <button 
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="bg-gray-900 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg hover:bg-black transition-transform active:scale-95"
        >
          {isFormOpen ? 'Tutup' : '+ Atur Budget'}
        </button>
      </div>

      {/* FORM INPUT BUDGET (ANIMATED) */}
      <AnimatePresence>
        {isFormOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-8"
          >
            <form onSubmit={handleSave} className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 grid md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Kategori</label>
                <select 
                  className="w-full p-3 border rounded-xl bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-gray-200"
                  value={formData.category_id}
                  onChange={(e) => setFormData({...formData, category_id: e.target.value})}
                  required
                >
                  <option value="">-- Pilih --</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Batas Maksimal (Rp)</label>
                <input 
                  type="number" 
                  className="w-full p-3 border rounded-xl bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-gray-200"
                  placeholder="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  required
                />
              </div>
              <button type="submit" className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-md">
                Simpan Target
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LIST BUDGET CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? <p className="text-center col-span-2 text-gray-400">Menghitung...</p> : budgets.map(b => (
          <motion.div 
            key={b.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.02 }}
            className={`p-5 rounded-3xl border shadow-sm relative overflow-hidden transition-colors ${getCardStatus(b.percentage)}`}
          >
            {/* Header Card */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-lg shadow-sm border border-gray-100">
                  💸
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">{b.categories?.name}</h3>
                  <p className="text-xs text-gray-500">Limit: {rupiah(b.amount)}</p>
                </div>
              </div>
              <button onClick={() => handleDelete(b.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Progress Bar Container */}
            <div className="relative pt-1">
              <div className="flex mb-2 items-center justify-between">
                <div>
                  <span className={`text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full ${b.percentage >= 100 ? 'text-red-600 bg-red-200' : 'text-green-600 bg-green-200'}`}>
                    {b.percentage >= 100 ? 'Over Budget!' : 'Terpakai'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold inline-block text-gray-600">
                    {Math.round(b.percentage)}%
                  </span>
                </div>
              </div>
              
              {/* Bar Background */}
              <div className="overflow-hidden h-3 mb-4 text-xs flex rounded-full bg-gray-200">
                {/* Bar Fill (Animated) */}
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${b.percentage}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${getProgressColor(b.percentage)}`}
                />
              </div>
            </div>

            {/* Footer Info */}
            <div className="flex justify-between items-center pt-2 border-t border-gray-100/50">
              <div className="text-xs text-gray-500">
                Terpakai: <span className="font-bold text-gray-700">{rupiah(b.spent)}</span>
              </div>
              <div className="text-xs text-gray-500">
                Sisa: <span className={`font-bold ${b.amount - b.spent < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                  {rupiah(b.amount - b.spent)}
                </span>
              </div>
            </div>

          </motion.div>
        ))}

        {budgets.length === 0 && !loading && (
          <div className="col-span-1 md:col-span-2 text-center py-12 bg-white rounded-3xl border-2 border-dashed border-gray-200">
            <p className="text-gray-400 font-medium">Belum ada budget yang diatur.</p>
            <p className="text-sm text-gray-400 mt-1">Klik "+ Atur Budget" untuk mulai berhemat.</p>
          </div>
        )}
      </div>
    </div>
  );
}