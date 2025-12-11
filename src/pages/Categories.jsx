import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import confetti from 'canvas-confetti';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State Input
  const [newCatName, setNewCatName] = useState('');
  const [activeTab, setActiveTab] = useState('expense'); // 'expense' or 'income'

  const { user } = useAuth();

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) console.error(error);
    else setCategories(data);
    setLoading(false);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    const { error } = await supabase
      .from('categories')
      .insert([{ name: newCatName, type: activeTab }]);

    if (error) {
      toast.error('Gagal tambah: ' + error.message);
    } else {
      // Efek Confetti kecil
      confetti({
        particleCount: 30,
        spread: 50,
        origin: { y: 0.7 },
        colors: activeTab === 'income' ? ['#10B981'] : ['#EF4444']
      });
      
      toast.success('Kategori berhasil dibuat!');
      setNewCatName('');
      fetchCategories();
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus kategori ini?')) return;

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) {
      if (error.code === '23503') {
        toast.error('Gagal! Kategori ini sedang dipakai di transaksi.', { icon: '🔒' });
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success('Kategori dihapus');
      fetchCategories();
    }
  };

  // Filter Data berdasarkan Tab Aktif
  const displayCats = categories.filter(c => c.type === activeTab);

  return (
    <div className="min-h-screen w-full max-w-4xl mx-auto px-4 pt-20 pb-24 md:pt-24 md:pb-8">
      
      {/* HEADER */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-black text-gray-800">Manajemen Kategori</h2>
        <p className="text-sm text-gray-500">Atur label pengeluaran dan pemasukanmu.</p>
      </div>

      {/* --- TAB SWITCHER (ANIMATED) --- */}
      <div className="flex justify-center mb-8">
        <div className="bg-gray-100 p-1 rounded-xl flex relative w-full max-w-xs">
          {/* Background Slider */}
          <motion.div
            layoutId="active-tab"
            className="absolute top-1 bottom-1 rounded-lg bg-white shadow-sm z-0"
            initial={false}
            animate={{
              width: '48%',
              left: activeTab === 'expense' ? '1.5%' : '50.5%'
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />

          <button
            onClick={() => setActiveTab('expense')}
            className={`flex-1 py-2 text-sm font-bold z-10 relative transition-colors ${activeTab === 'expense' ? 'text-red-600' : 'text-gray-500'}`}
          >
            Pengeluaran 💸
          </button>
          <button
            onClick={() => setActiveTab('income')}
            className={`flex-1 py-2 text-sm font-bold z-10 relative transition-colors ${activeTab === 'income' ? 'text-green-600' : 'text-gray-500'}`}
          >
            Pemasukan 💰
          </button>
        </div>
      </div>

      {/* --- FORM INPUT CARD (CLEAN) --- */}
      <motion.div 
        layout
        className={`p-6 rounded-3xl shadow-sm border transition-colors duration-500 mb-10 ${activeTab === 'income' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}
      >
        <form onSubmit={handleAdd}>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1">
            Nama Kategori Baru
          </label>

          <div className="flex gap-3">
            <input 
              type="text" 
              placeholder={activeTab === 'income' ? "Contoh: Gaji, Bonus..." : "Contoh: Bensin, Makan..."}
              className="w-full px-4 py-3 rounded-xl border-none shadow-sm focus:ring-2 focus:ring-opacity-50 outline-none transition-all focus:scale-[1.01]"
              style={{ 
                backgroundColor: 'white',
              }}
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              required
            />
            <button 
              type="submit" 
              className={`px-6 py-3 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-95 ${activeTab === 'income' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
            >
              Tambah
            </button>
          </div>
        </form>
      </motion.div>

      {/* --- GRID LIST CATEGORIES --- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <AnimatePresence mode='popLayout'>
          {loading ? <p className="col-span-full text-center text-gray-400">Loading...</p> : displayCats.map((cat, index) => (
            <motion.div
              key={cat.id}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center group hover:shadow-md transition-shadow"
            >
              <span className="font-bold text-gray-700 truncate pr-2">
                {cat.name}
              </span>

              {/* Tombol Hapus: Hanya muncul jika punya User (Bukan Default System) */}
              {cat.user_id === user?.id ? (
                <button 
                  onClick={() => handleDelete(cat.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              ) : (
                <span className="text-[10px] bg-gray-100 text-gray-400 px-2 py-1 rounded-md">
                  Default
                </span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {displayCats.length === 0 && !loading && (
          <div className="col-span-full text-center py-10 text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
            Belum ada kategori {activeTab === 'income' ? 'Pemasukan' : 'Pengeluaran'}.
          </div>
        )}
      </div>
    </div>
  );
}