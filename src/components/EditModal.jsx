import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export default function EditModal({ isOpen, onClose, transaction, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    transaction_date: '',
    category_id: '',
    description: '',
    payment_method: '',
    amount: ''
  });

  // 1. Ambil data Kategori & Isi Form saat Modal dibuka
  useEffect(() => {
    if (isOpen && transaction) {
      // Isi form dengan data lama
      setFormData({
        transaction_date: transaction.transaction_date,
        category_id: transaction.category_id,
        description: transaction.description || '',
        payment_method: transaction.payment_method || 'cash',
        amount: transaction.amount
      });

      // Fetch kategori untuk dropdown
      const fetchCats = async () => {
        const { data } = await supabase.from('categories').select('*');
        if (data) setCategories(data);
      };
      fetchCats();
    }
  }, [isOpen, transaction]);

  const handleChange = (e) => setFormData({...formData, [e.target.name]: e.target.value});

  // 2. Logika Update ke Supabase
  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
      .from('transactions')
      .update(formData) // Kirim data baru
      .eq('id', transaction.id); // Filter berdasarkan ID transaksi yang diedit

    setLoading(false);

    if (error) {
      toast.error('Gagal update: ' + error.message);
    } else {
      toast.success('Data berhasil diperbarui!');
      onSuccess(); // Refresh data di halaman induk
      onClose();   // Tutup modal
    }
  };

  // Style Input
  const inputClass = "mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm p-2.5 border";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          {/* Animasi Modal */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
          >
            <div className="bg-orange-500 p-4 flex justify-between items-center">
              <h3 className="text-white font-bold text-lg">Edit Transaksi</h3>
              <button onClick={onClose} className="text-white hover:bg-orange-600 rounded-full p-1">
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Tanggal</label>
                <input type="date" name="transaction_date" required className={inputClass} value={formData.transaction_date} onChange={handleChange} />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Kategori</label>
                <select name="category_id" required className={inputClass} value={formData.category_id} onChange={handleChange}>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Deskripsi</label>
                <input type="text" name="description" className={inputClass} value={formData.description} onChange={handleChange} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Metode</label>
                  <select name="payment_method" className={inputClass} value={formData.payment_method} onChange={handleChange}>
                    <option value="cash">cash</option>
                    <option value="Tf mandiri">Tf mandiri</option>
                    <option value="Tf blu bca">Tf blu bca</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Nominal</label>
                  <input type="number" name="amount" required className={inputClass} value={formData.amount} onChange={handleChange} />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-xl text-gray-700 font-bold hover:bg-gray-50">
                  Batal
                </button>
                <button type="submit" disabled={loading} className="flex-1 py-2 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 shadow-lg">
                  {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}