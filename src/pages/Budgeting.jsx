import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { startOfMonth, endOfMonth, format } from 'date-fns';

export default function Budgeting() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State untuk Modal Edit Budget
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [inputAmount, setInputAmount] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const start = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const end = format(endOfMonth(new Date()), 'yyyy-MM-dd');

    // 1. Ambil semua kategori pengeluaran
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name')
      .eq('type', 'expense');

    // 2. Ambil data Budget yang sudah diset
    const { data: budgets } = await supabase.from('budgets').select('*');

    // 3. Ambil total pengeluaran BULAN INI per kategori
    const { data: transactions } = await supabase
      .from('transactions')
      .select('category_id, amount')
      .gte('transaction_date', start)
      .lte('transaction_date', end);

    // 4. GABUNGKAN DATA (Mapping Logic)
    const mergedData = categories.map(cat => {
      // Cari budget untuk kategori ini
      const budgetObj = budgets.find(b => b.category_id === cat.id);
      const limit = budgetObj ? Number(budgetObj.amount) : 0; // Kalau belum set, anggap 0

      // Hitung pengeluaran aktual bulan ini
      const spent = transactions
        .filter(t => t.category_id === cat.id)
        .reduce((sum, t) => sum + Number(t.amount), 0);

      // Hitung Persentase
      let percentage = 0;
      if (limit > 0) percentage = (spent / limit) * 100;
      
      return {
        ...cat,
        limit,
        spent,
        percentage
      };
    });

    setItems(mergedData);
    setLoading(false);
  };

  const handleEditClick = (item) => {
    setSelectedCategory(item);
    setInputAmount(item.limit || ''); // Isi form dengan limit lama
    setIsModalOpen(true);
  };

  const handleSaveBudget = async (e) => {
    e.preventDefault();
    if (!selectedCategory) return;

    // Cek apakah budget sudah ada? Update. Kalau belum? Insert.
    const { data: existing } = await supabase
      .from('budgets')
      .select('id')
      .eq('category_id', selectedCategory.id)
      .single();

    let error;
    if (existing) {
      // Update
      const { error: err } = await supabase
        .from('budgets')
        .update({ amount: inputAmount })
        .eq('id', existing.id);
      error = err;
    } else {
      // Insert Baru
      const { error: err } = await supabase
        .from('budgets')
        .insert([{ category_id: selectedCategory.id, amount: inputAmount }]);
      error = err;
    }

    if (error) {
      toast.error('Gagal simpan: ' + error.message);
    } else {
      toast.success(`Budget ${selectedCategory.name} diupdate!`);
      setIsModalOpen(false);
      fetchData(); // Refresh data
    }
  };

  const rupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

  // Helper Warna Progress Bar
  const getProgressColor = (percent) => {
    if (percent >= 100) return 'bg-red-600'; // Bahaya
    if (percent >= 80) return 'bg-yellow-500'; // Hati-hati
    return 'bg-green-500'; // Aman
  };

  return (
    <div className="min-h-screen w-full max-w-4xl mx-auto px-4 pt-20 pb-24 md:pt-24 md:pb-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Budgeting Bulanan</h2>
        <p className="text-sm text-gray-500">Atur batas pengeluaranmu agar tidak boncos.</p>
      </div>

      <div className="grid gap-6">
        {loading ? <p className="text-center">Loading data...</p> : items.map((item) => (
          <div key={item.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
            
            <div className="flex justify-between items-end mb-2">
              <div>
                <h3 className="font-bold text-gray-800 text-lg">{item.name}</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Terpakai: <span className="font-semibold text-gray-700">{rupiah(item.spent)}</span>
                  {' / '}
                  Target: <span className="font-semibold text-gray-700">{item.limit > 0 ? rupiah(item.limit) : 'Belum diset'}</span>
                </p>
              </div>
              <button 
                onClick={() => handleEditClick(item)}
                className="text-sm text-orange-600 font-bold hover:bg-orange-50 px-3 py-1 rounded-lg transition-colors"
              >
                Set Budget
              </button>
            </div>

            {/* PROGRESS BAR */}
            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(item.percentage, 100)}%` }} // Max width 100% biar ga luber
                transition={{ duration: 1, ease: "easeOut" }}
                className={`h-4 rounded-full ${getProgressColor(item.percentage)} relative`}
              >
                {/* Efek Kilau/Shine (Opsional) */}
                <div className="absolute top-0 left-0 bottom-0 right-0 bg-white/20"></div>
              </motion.div>
            </div>
            
            {/* Indikator Persen */}
            <p className={`text-xs text-right mt-1 font-bold ${item.percentage >= 100 ? 'text-red-600' : 'text-gray-500'}`}>
              {item.limit > 0 ? `${item.percentage.toFixed(1)}%` : '0%'}
            </p>

            {/* Peringatan Over Budget */}
            {item.percentage >= 100 && (
              <div className="mt-2 bg-red-50 text-red-700 text-xs px-3 py-2 rounded-lg font-medium flex items-center gap-2">
                ⚠️ Hati-hati! Kamu sudah melebihi budget {item.name}.
              </div>
            )}
          </div>
        ))}
      </div>

      {/* MODAL EDIT BUDGET */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl"
            >
              <h3 className="text-lg font-bold mb-4">Set Budget: {selectedCategory?.name}</h3>
              <form onSubmit={handleSaveBudget}>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Batas Maksimal (Rp)</label>
                <input 
                  type="number" 
                  autoFocus
                  required
                  className="w-full p-3 border border-gray-300 rounded-xl font-bold text-lg mb-6 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  value={inputAmount}
                  onChange={(e) => setInputAmount(e.target.value)}
                  placeholder="0"
                />
                <div className="flex gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-gray-600 font-bold bg-gray-100 rounded-xl hover:bg-gray-200">
                    Batal
                  </button>
                  <button type="submit" className="flex-1 py-3 text-white font-bold bg-orange-500 rounded-xl hover:bg-orange-600 shadow-lg">
                    Simpan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}