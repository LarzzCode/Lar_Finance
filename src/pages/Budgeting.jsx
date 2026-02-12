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
  
  // STATE: Keuangan Global
  const [totalIncome, setTotalIncome] = useState(0); 
  const [totalBudgeted, setTotalBudgeted] = useState(0); 
  
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

    // 1. Ambil Total PEMASUKAN (Gaji)
    const { data: incomeData } = await supabase
      .from('transactions')
      .select('amount, categories!inner(type)')
      .eq('categories.type', 'income')
      .gte('transaction_date', start)
      .lte('transaction_date', end);

    const currentIncome = incomeData?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;
    setTotalIncome(currentIncome);

    // 2. Ambil Data Budget User
    const { data: budgetData } = await supabase
      .from('budgets')
      .select('*, categories(name, type)')
      .order('amount', { ascending: false });

    // Hitung Total yang sudah di-budget-kan
    const currentTotalBudget = budgetData?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;
    setTotalBudgeted(currentTotalBudget);

    // 3. Ambil Realisasi Pengeluaran
    const { data: transData } = await supabase
      .from('transactions')
      .select('amount, category_id, categories!inner(type)')
      .eq('categories.type', 'expense')
      .gte('transaction_date', start)
      .lte('transaction_date', end);

    const validTransData = transData || []; 

    // 4. Ambil List Kategori
    const { data: catData } = await supabase
      .from('categories')
      .select('*')
      .eq('type', 'expense')
      .order('name');

    // 5. Gabungkan Data
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

    const newAmount = Number(formData.amount);
    const categoryId = parseInt(formData.category_id); 

    // LOGIKA PENJAGA GAJI
    const existingBudget = budgets.find(b => b.category_id === categoryId);
    const oldAmount = existingBudget ? Number(existingBudget.amount) : 0;
    const projectedTotal = (totalBudgeted - oldAmount) + newAmount;

    if (projectedTotal > totalIncome) {
      toast.error(`GAGAL! Budget melebihi Pemasukan.\nSisa uang: ${rupiah(totalIncome - (totalBudgeted - oldAmount))}`);
      return; 
    }

    const payload = { category_id: categoryId, amount: newAmount, user_id: user.id };
    if (existingBudget) payload.id = existingBudget.id;

    const { error } = await supabase.from('budgets').upsert(payload, { onConflict: 'user_id, category_id' });
        
    if (error) {
      toast.error('Error: ' + error.message);
    } else {
      toast.success(existingBudget ? 'Budget Diperbarui' : 'Budget Dibuat');
      setIsFormOpen(false);
      setFormData({ category_id: '', amount: '' });
      fetchData();
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus budget ini?')) return;
    const { error } = await supabase.from('budgets').delete().eq('id', id);
    if (!error) {
      toast.success('Budget Dihapus');
      fetchData();
    }
  };

  const rupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

  const getProgressColor = (percent) => {
    if (percent >= 100) return 'bg-rose-500';
    if (percent >= 75) return 'bg-amber-400';
    return 'bg-emerald-500';
  };

  const unbudgetedMoney = totalIncome - totalBudgeted;

  return (
    // LAYOUT: Mobile pt-0, Desktop pt-28
    <div className="min-h-screen w-full max-w-5xl mx-auto px-4 md:px-8 pb-24 pt-0 md:pt-28 font-sans text-gray-800">
      
      {/* HEADER */}
      <div className="flex justify-between items-end mb-8 pt-8 md:pt-0">
         <div>
            <h1 className="text-3xl font-black text-gray-800">Anggaran</h1>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Kontrol Pengeluaran</p>
         </div>
         <button 
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="bg-gray-900 text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg hover:bg-black transition-colors"
         >
            {isFormOpen ? 'Tutup' : '+ Atur Budget'}
         </button>
      </div>

      {/* SUMMARY CARD (Salary Guard) */}
      <div className="bg-gray-900 rounded-[2rem] p-8 text-white shadow-xl mb-10 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative z-10">
          <div>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Total Pemasukan (Bulan Ini)</p>
            <h2 className="text-3xl md:text-4xl font-black text-white">{rupiah(totalIncome)}</h2>
          </div>
          <div className="text-left md:text-right">
             <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Dana Belum Dianggarkan</p>
             <p className={`text-2xl font-bold ${unbudgetedMoney < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
               {rupiah(unbudgetedMoney)}
             </p>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="mt-8">
          <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            <span>Terpakai: {rupiah(totalBudgeted)}</span>
            <span>{Math.round((totalBudgeted / (totalIncome || 1)) * 100)}% dari Pemasukan</span>
          </div>
          <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((totalBudgeted / (totalIncome || 1)) * 100, 100)}%` }}
              className={`h-full ${totalBudgeted > totalIncome ? 'bg-rose-500' : 'bg-indigo-500'}`}
            />
          </div>
        </div>
      </div>

      {/* FORM INPUT (Collapsible) */}
      <AnimatePresence>
        {isFormOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-10"
          >
            <form onSubmit={handleSave} className="bg-white p-8 rounded-[2rem] shadow-xl border border-gray-100 grid md:grid-cols-3 gap-6 items-end">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Pilih Kategori</label>
                <select 
                  className="w-full p-4 border rounded-2xl bg-gray-50 font-bold text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-gray-100 transition-all appearance-none"
                  value={formData.category_id}
                  onChange={(e) => setFormData({...formData, category_id: e.target.value})}
                  required
                >
                  <option value="" disabled>-- Pilih Kategori --</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Batas Maksimal (Rp)</label>
                <input 
                  type="number" 
                  className="w-full p-4 border rounded-2xl bg-gray-50 font-bold text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-gray-100 transition-all"
                  placeholder="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  required
                />
              </div>
              <button type="submit" className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 shadow-lg uppercase tracking-widest text-xs">
                Simpan Target
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BUDGET CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? <p className="text-center col-span-2 text-gray-400 font-bold text-xs uppercase">Memuat data...</p> : budgets.map(b => (
          <motion.div 
            key={b.id}
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group"
          >
            {/* Header Card */}
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                {/* Inisial Kategori (No Emoji) */}
                <div className="w-12 h-12 rounded-2xl bg-gray-50 text-gray-600 flex items-center justify-center text-lg font-black uppercase">
                  {b.categories?.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">{b.categories?.name}</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Limit: {rupiah(b.amount)}</p>
                </div>
              </div>
              <button onClick={() => handleDelete(b.id)} className="w-8 h-8 rounded-full bg-gray-50 text-gray-400 hover:bg-rose-50 hover:text-rose-500 flex items-center justify-center transition-colors">
                ✕
              </button>
            </div>

            {/* Progress Section */}
            <div>
              <div className="flex justify-between items-end mb-2">
                <span className={`text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wide ${b.percentage >= 100 ? 'text-rose-600 bg-rose-50' : 'text-emerald-600 bg-emerald-50'}`}>
                  {b.percentage >= 100 ? 'Over' : 'Aman'}
                </span>
                <span className="text-xs font-black text-gray-700">{Math.round(b.percentage)}%</span>
              </div>
              
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${b.percentage}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className={`h-full rounded-full ${getProgressColor(b.percentage)}`}
                />
              </div>
            </div>

            {/* Footer Card */}
            <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-50">
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase">Terpakai</p>
                <p className="text-sm font-bold text-gray-700">{rupiah(b.spent)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-400 font-bold uppercase">Sisa</p>
                <p className={`text-sm font-bold ${b.amount - b.spent < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {rupiah(b.amount - b.spent)}
                </p>
              </div>
            </div>

          </motion.div>
        ))}

        {budgets.length === 0 && !loading && (
          <div className="col-span-1 md:col-span-2 text-center py-16 bg-white rounded-[2rem] border border-dashed border-gray-200">
            <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">Belum ada anggaran</p>
            <button onClick={() => setIsFormOpen(true)} className="mt-4 text-indigo-600 text-sm font-bold hover:underline">Buat Sekarang</button>
          </div>
        )}
      </div>
    </div>
  );
}