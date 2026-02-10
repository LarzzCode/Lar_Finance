import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export default function EditModal({ isOpen, onClose, transaction, onSuccess }) {
  const [formData, setFormData] = useState({
    amount: '',
    category_id: '',
    description: '',
    transaction_date: '',
    payment_method: ''
  });
  
  const [categories, setCategories] = useState([]);
  const [wallets, setWallets] = useState([]); // List Dompet
  const [loading, setLoading] = useState(false);

  // Load data saat modal dibuka
  useEffect(() => {
    if (isOpen && transaction) {
      setFormData({
        amount: transaction.amount,
        category_id: transaction.category_id,
        description: transaction.description || '',
        transaction_date: transaction.transaction_date,
        payment_method: transaction.payment_method || ''
      });
      fetchCategories(transaction.categories?.type || 'expense');
      fetchWallets();
    }
  }, [isOpen, transaction]);

  const fetchCategories = async (type) => {
    const { data } = await supabase.from('categories').select('*').eq('type', type);
    if (data) setCategories(data);
  };

  const fetchWallets = async () => {
    const { data } = await supabase.from('wallets').select('*').order('created_at');
    if (data) setWallets(data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
      .from('transactions')
      .update({
        amount: formData.amount,
        category_id: formData.category_id,
        description: formData.description,
        transaction_date: formData.transaction_date,
        payment_method: formData.payment_method
      })
      .eq('id', transaction.id);

    setLoading(false);

    if (error) {
      toast.error('Gagal update data');
    } else {
      toast.success('Data berhasil diperbarui!');
      onSuccess(); // Refresh data di halaman induk
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
          >
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-black text-gray-800">Edit Transaksi</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Tanggal */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase">Tanggal</label>
                <input 
                  type="date"
                  value={formData.transaction_date}
                  onChange={(e) => setFormData({...formData, transaction_date: e.target.value})}
                  className="w-full mt-1 p-3 bg-gray-50 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              {/* Nominal */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase">Nominal (Rp)</label>
                <input 
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  className="w-full mt-1 p-3 bg-gray-50 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              {/* Kategori */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase">Kategori</label>
                <div className="relative mt-1">
                    <select 
                    value={formData.category_id}
                    onChange={(e) => setFormData({...formData, category_id: e.target.value})}
                    className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-100 appearance-none cursor-pointer"
                    >
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">▼</span>
                </div>
              </div>

              {/* Sumber Dana (Dompet) - DINAMIS */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase">Sumber Dana</label>
                <div className="relative mt-1">
                    <select 
                    value={formData.payment_method}
                    onChange={(e) => setFormData({...formData, payment_method: e.target.value})}
                    className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-100 appearance-none cursor-pointer"
                    >
                    {/* Tampilkan opsi dompet yang tersedia */}
                    {wallets.length > 0 ? (
                        wallets.map(w => (
                            <option key={w.id} value={w.name}>{w.name}</option>
                        ))
                    ) : (
                        // Fallback jika wallet kosong atau loading
                        <option value={formData.payment_method}>{formData.payment_method}</option>
                    )}
                    
                    {/* Jaga-jaga jika dompet lama dihapus tapi masih ada di transaksi, tampilkan opsi custom */}
                    {!wallets.find(w => w.name === formData.payment_method) && formData.payment_method && (
                        <option value={formData.payment_method}>{formData.payment_method} (Terhapus)</option>
                    )}
                    </select>
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">▼</span>
                </div>
              </div>

              {/* Deskripsi */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase">Deskripsi</label>
                <textarea 
                  rows="2"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full mt-1 p-3 bg-gray-50 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-100 resize-none"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors">
                    Batal
                </button>
                <button type="submit" disabled={loading} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
                    {loading ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}