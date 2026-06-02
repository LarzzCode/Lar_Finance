import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import * as icons from 'lucide-react';

// --- KOMPONEN PENAFSIR IKON DINAMIS ---
const DynamicIcon = ({ name, size = 20, className = "" }) => {
  const LucideIcon = icons[name] || icons['HelpCircle'];
  if (!LucideIcon) return null;
  return <LucideIcon size={size} className={className} />;
};

export default function EditModal({ isOpen, onClose, transaction, onSuccess }) {
  const [formData, setFormData] = useState({
    amount: '',
    category_id: '',
    description: '',
    transaction_date: '',
    wallet_id: '',
    payment_method: ''
  });
  
  const [categories, setCategories] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load data saat modal dibuka
  useEffect(() => {
    if (isOpen && transaction) {
      setFormData({
        amount: transaction.amount,
        category_id: transaction.category_id,
        description: transaction.description || '',
        transaction_date: transaction.transaction_date,
        wallet_id: transaction.wallet_id || '', // Update: Menggunakan wallet_id
        payment_method: transaction.payment_method || ''
      });
      fetchCategories(transaction.categories?.type || 'expense');
      fetchWallets();
    }
  }, [isOpen, transaction]);

  const fetchCategories = async (type) => {
    const { data } = await supabase.from('categories').select('*').eq('type', type).order('name');
    if (data) setCategories(data);
  };

  const fetchWallets = async () => {
    const { data } = await supabase.from('wallets').select('*').order('name');
    if (data) setWallets(data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Cari nama dompet berdasarkan wallet_id yang dipilih
    const selectedWalletData = wallets.find(w => w.id === formData.wallet_id);
    const paymentMethodName = selectedWalletData ? selectedWalletData.name : formData.payment_method;

    const { error } = await supabase
      .from('transactions')
      .update({
        amount: formData.amount,
        category_id: formData.category_id,
        description: formData.description,
        transaction_date: formData.transaction_date,
        wallet_id: formData.wallet_id, // Simpan ID agar hitungan realtime jalan
        payment_method: paymentMethodName // Simpan Nama untuk fallback
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

  // Ambil data kategori yang sedang dipilih untuk render ikon
  const selectedCategoryData = categories.find(c => c.id === formData.category_id);
  const isIncome = transaction?.categories?.type === 'income';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-gray-900/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="bg-white rounded-t-[2rem] sm:rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
          >
            {/* Handlebar untuk Mobile */}
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-6 mb-2 sm:hidden"></div>

            <div className="px-6 pt-2 pb-5 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-black text-gray-900 tracking-tight">Edit Transaksi</h3>
              <button type="button" onClick={onClose} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 font-bold hover:bg-gray-200 transition-colors">✕</button>
            </div>

            <div className="overflow-y-auto custom-scrollbar">
              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                
                {/* Nominal */}
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Nominal (Rp)</label>
                  <input 
                    type="number"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    className={`w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-black text-2xl outline-none focus:bg-white focus:border-gray-300 transition-colors ${isIncome ? 'text-emerald-500' : 'text-rose-500'}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Tanggal */}
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Tanggal</label>
                    <input 
                      type="date"
                      required
                      value={formData.transaction_date}
                      onChange={(e) => setFormData({...formData, transaction_date: e.target.value})}
                      className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-xl font-bold text-gray-800 outline-none focus:bg-white focus:border-gray-300 transition-colors text-sm"
                    />
                  </div>

                  {/* Sumber Dana (Dompet) */}
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Sumber Dana</label>
                    <div className="relative">
                        <select 
                          required
                          value={formData.wallet_id || ''}
                          onChange={(e) => setFormData({...formData, wallet_id: e.target.value})}
                          className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-xl font-bold text-gray-800 outline-none focus:bg-white focus:border-gray-300 transition-colors appearance-none cursor-pointer text-sm"
                        >
                        {wallets.length > 0 ? (
                            wallets.map(w => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                            ))
                        ) : (
                            <option value={formData.wallet_id}>Memuat...</option>
                        )}
                        </select>
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                            <DynamicIcon name="ChevronDown" size={16} />
                        </span>
                    </div>
                  </div>
                </div>

                {/* Kategori dengan Tampilan Icon Dinamis */}
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Kategori</label>
                  <div className="flex gap-3">
                      {/* Box Ikon Kategori */}
                      <div className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center border shadow-sm ${
                          isIncome 
                          ? 'bg-emerald-50 border-emerald-100 text-emerald-500' 
                          : 'bg-rose-50 border-rose-100 text-rose-500'
                      }`}>
                          <DynamicIcon name={selectedCategoryData?.icon || 'LayoutGrid'} size={24} />
                      </div>
                      
                      {/* Select Dropdown */}
                      <div className="relative flex-1">
                          <select 
                            required
                            value={formData.category_id}
                            onChange={(e) => setFormData({...formData, category_id: e.target.value})}
                            className="w-full h-full p-3.5 bg-gray-50 border border-gray-100 rounded-xl font-bold text-gray-800 outline-none focus:bg-white focus:border-gray-300 transition-colors appearance-none cursor-pointer text-sm"
                          >
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                              <DynamicIcon name="ChevronDown" size={16} />
                          </span>
                      </div>
                  </div>
                </div>

                {/* Deskripsi */}
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Catatan</label>
                  <textarea 
                    rows="2"
                    placeholder="Tulis catatan opsional..."
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl font-medium text-gray-800 outline-none focus:bg-white focus:border-gray-300 transition-colors resize-none text-sm placeholder-gray-300"
                  />
                </div>

                <div className="pt-4 flex gap-4">
                  <button type="button" onClick={onClose} className="flex-1 py-4 bg-gray-50 border border-gray-200 font-bold text-gray-500 rounded-2xl hover:bg-gray-100 transition-colors">
                      Batal
                  </button>
                  <button type="submit" disabled={loading} className="flex-1 py-4 bg-gray-900 font-bold text-white rounded-2xl shadow-lg hover:bg-black transition-colors disabled:opacity-50 tracking-wide">
                      {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}