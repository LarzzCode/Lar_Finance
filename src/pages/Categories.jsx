import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext'; // <--- 1. Import Auth

export default function Categories() {
  const { user } = useAuth(); // <--- 2. Ambil User Login
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('expense');
  const [newCat, setNewCat] = useState('');

  useEffect(() => {
    if (user) fetchCategories();
  }, [type, user]);

  const fetchCategories = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('type', type)
      .order('name');
      
    if (error) {
      console.error('Error fetch:', error);
    } else {
      setCategories(data || []);
    }
    setLoading(false);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newCat.trim()) return;

    // Icon default sederhana
    const icon = type === 'income' ? '💰' : '🛒'; 

    const { data, error } = await supabase
      .from('categories')
      .insert([{ 
        name: newCat, 
        type, 
        icon,
        user_id: user.id // <--- 3. PERBAIKAN UTAMA: Masukkan user_id
      }]) 
      .select();

    if (error) {
      console.error(error); // Cek console browser jika masih error
      toast.error('Gagal tambah kategori: ' + error.message);
    } else {
      setCategories([...categories, ...data]);
      setNewCat('');
      toast.success('Kategori ditambahkan!');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus kategori ini?')) return;
    
    const { error } = await supabase.from('categories').delete().eq('id', id);
    
    if (!error) {
      setCategories(categories.filter(c => c.id !== id));
      toast.success('Dihapus');
    } else {
      toast.error('Gagal hapus (Mungkin sedang dipakai di transaksi)');
    }
  };

  return (
    <div className="min-h-screen w-full max-w-2xl mx-auto px-4 pt-24 pb-24 font-sans text-gray-800">
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 mb-6">
        <h1 className="text-2xl font-black text-gray-800">Atur Kategori 🏷️</h1>
        <p className="text-sm text-gray-400">Tambah atau hapus label transaksi.</p>
      </div>

      {/* Switcher */}
      <div className="flex bg-gray-100 p-1.5 rounded-2xl mb-6">
        {['expense', 'income'].map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
              type === t ? 'bg-white text-gray-900 shadow-md' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {t === 'expense' ? 'Pengeluaran' : 'Pemasukan'}
          </button>
        ))}
      </div>

      {/* Form Tambah */}
      <form onSubmit={handleAdd} className="flex gap-3 mb-8">
        <input 
          type="text" 
          placeholder={`Nama Kategori Baru...`}
          className="flex-1 p-4 bg-white border border-gray-200 rounded-2xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-100 placeholder:font-normal"
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
        />
        <button className="bg-gray-900 text-white px-6 rounded-2xl font-bold shadow-lg hover:bg-black transition-transform active:scale-95">
          +
        </button>
      </form>

      {/* List Categories */}
      <div className="grid gap-3">
        <AnimatePresence>
          {loading ? (
            <p className="text-center text-gray-400 py-10">Memuat...</p>
          ) : categories.length === 0 ? (
            <p className="text-center text-gray-400 py-10">Belum ada kategori.</p>
          ) : (
            categories.map((cat) => (
              <motion.div 
                key={cat.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white p-4 rounded-2xl border border-gray-50 shadow-sm flex justify-between items-center group hover:border-indigo-100 transition-colors"
              >
                <span className="font-bold text-gray-700 flex items-center gap-4">
                  <span className="bg-gray-50 w-12 h-12 flex items-center justify-center rounded-xl text-xl">
                    {cat.icon || '#'}
                  </span>
                  {cat.name}
                </span>
                <button 
                  onClick={() => handleDelete(cat.id)}
                  className="w-10 h-10 flex items-center justify-center text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}