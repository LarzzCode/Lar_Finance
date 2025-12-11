import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
// 1. Import useAuth untuk cek ID User
import { useAuth } from '../context/AuthContext';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState('expense');
  
  // 2. Ambil data user yang sedang login
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

    // Insert otomatis akan menyertakan user_id dari Auth Supabase (RLS)
    const { error } = await supabase
      .from('categories')
      .insert([{ name: newCatName, type: newCatType }]);

    if (error) {
      toast.error('Gagal tambah: ' + error.message);
    } else {
      toast.success('Kategori berhasil ditambahkan!');
      setNewCatName('');
      fetchCategories();
    }
  };

  const handleDelete = async (id) => {
    // Konfirmasi Dulu
    if (!window.confirm('Yakin hapus kategori ini?')) return;

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) {
      // Deteksi Error Foreign Key (Sedang dipakai transaksi)
      if (error.code === '23503') {
        toast.error('Tidak bisa dihapus! Kategori ini masih dipakai di riwayat transaksi.', {
          duration: 4000,
          icon: '🔒'
        });
      } else {
        toast.error('Gagal hapus: ' + error.message);
      }
    } else {
      toast.success('Kategori berhasil dihapus');
      fetchCategories();
    }
  };

  const incomeCats = categories.filter(c => c.type === 'income');
  const expenseCats = categories.filter(c => c.type === 'expense');

  return (
    <div className="min-h-screen w-full max-w-4xl mx-auto px-4 pt-20 pb-24 md:pt-24 md:pb-8">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900">Atur Kategori</h2>
        <p className="text-sm text-gray-500">Kelola kategori pengeluaran dan pemasukanmu.</p>
      </div>

      {/* FORM TAMBAH */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 mb-10 max-w-lg mx-auto">
        <form onSubmit={handleAdd} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Kategori Baru</label>
            <input 
              type="text" placeholder="Contoh: Pulsa, Parkir, Investasi..." 
              className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
              value={newCatName} onChange={(e) => setNewCatName(e.target.value)} required
            />
          </div>
          
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipe</label>
              <select 
                className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                value={newCatType} onChange={(e) => setNewCatType(e.target.value)}
              >
                <option value="expense">Pengeluaran 💸</option>
                <option value="income">Pemasukan 💰</option>
              </select>
            </div>
            <div className="flex items-end">
              <button type="submit" className="px-6 py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition-colors shadow-md h-[50px]">
                Tambah
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* LIST KATEGORI */}
      <div className="grid md:grid-cols-2 gap-8">
        
        {/* PEMASUKAN */}
        <div className="bg-green-50 p-6 rounded-2xl border border-green-100">
          <h3 className="text-lg font-bold text-green-800 mb-4 flex items-center gap-2"><span>💰</span> Pemasukan</h3>
          <div className="space-y-2">
            {incomeCats.map(cat => (
              <motion.div 
                key={cat.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-green-100 group"
              >
                <span className="font-medium text-gray-700 flex items-center gap-2">
                  {cat.name}
                  {/* Tanda jika kategori bawaan */}
                  {!cat.user_id && <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Default</span>}
                </span>
                
                {/* 3. LOGIKA: Tombol Hapus HANYA muncul jika kategori milik user ini */}
                {cat.user_id === user?.id && (
                  <button 
                    onClick={() => handleDelete(cat.id)}
                    className="text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                    title="Hapus"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* PENGELUARAN */}
        <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
          <h3 className="text-lg font-bold text-red-800 mb-4 flex items-center gap-2"><span>💸</span> Pengeluaran</h3>
          <div className="space-y-2">
            {expenseCats.map(cat => (
              <motion.div 
                key={cat.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-red-100 group"
              >
                <span className="font-medium text-gray-700 flex items-center gap-2">
                  {cat.name}
                  {!cat.user_id && <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Default</span>}
                </span>

                {/* 3. LOGIKA: Tombol Hapus HANYA muncul jika kategori milik user ini */}
                {cat.user_id === user?.id && (
                  <button 
                    onClick={() => handleDelete(cat.id)}
                    className="text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                    title="Hapus"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}