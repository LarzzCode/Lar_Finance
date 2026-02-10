import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

export default function Dompet() {
  const { user } = useAuth();
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [name, setName] = useState('');
  const [saldoAwal, setSaldoAwal] = useState('');
  const [editingId, setEditingId] = useState(null); // ID dompet yang sedang diedit
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const { data: walletData, error: walletError } = await supabase
        .from('wallets')
        .select('*')
        .order('created_at', { ascending: true });

      if (walletError) throw walletError;

      const { data: transData, error: transError } = await supabase
        .from('transactions')
        .select('amount, payment_method, categories(type)');

      if (transError) throw transError;

      if (walletData.length === 0) {
        await createDefaultWallet();
      } else {
        const calculatedWallets = walletData.map(w => {
            const currentBalance = calculateBalance(w.name, w.saldo_awal || 0, transData);
            return { ...w, balance: currentBalance };
        });
        setWallets(calculatedWallets);
        setLoading(false);
      }
    } catch (error) {
      toast.error('Gagal memuat data');
      setLoading(false);
    }
  };

  const calculateBalance = (walletName, initialBalance, transactions) => {
    let total = Number(initialBalance);
    transactions.forEach(t => {
        if (t.payment_method === walletName) {
            const amount = Number(t.amount);
            if (t.categories?.type === 'income') total += amount;
            else total -= amount;
        }
    });
    return total;
  };

  const createDefaultWallet = async () => {
    const { data } = await supabase
        .from('wallets')
        .insert([{ user_id: user.id, name: 'Tunai', saldo_awal: 0 }])
        .select();
    if (data) {
        setWallets([{ ...data[0], balance: 0 }]);
        toast('Dompet "Tunai" otomatis dibuat! 🎁', { icon: '✨' });
    }
    setLoading(false);
  };

  // --- FUNGSI BARU: MODE EDIT ---
  const startEdit = (wallet) => {
    setEditingId(wallet.id);
    setName(wallet.name);
    setSaldoAwal(wallet.saldo_awal);
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll ke form di atas
    toast('Mode Edit Aktif: Silakan ubah data di form atas', { icon: '✏️' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName('');
    setSaldoAwal('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);

    try {
        if (editingId) {
            // --- LOGIKA UPDATE ---
            const { error } = await supabase
                .from('wallets')
                .update({ name: name, saldo_awal: saldoAwal ? Number(saldoAwal) : 0 })
                .eq('id', editingId);

            if (error) throw error;
            toast.success('Dompet berhasil diperbarui! 🔄');
        } else {
            // --- LOGIKA TAMBAH BARU ---
            const { error } = await supabase
                .from('wallets')
                .insert([{ user_id: user.id, name: name, saldo_awal: saldoAwal ? Number(saldoAwal) : 0 }]);

            if (error) throw error;
            toast.success('Dompet berhasil ditambahkan! ✅');
        }

        // Reset & Refresh
        setName('');
        setSaldoAwal('');
        setEditingId(null);
        fetchData(); // Refresh data untuk hitung ulang saldo

    } catch (error) {
        toast.error(error.message);
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Hapus dompet "${name}"?`)) {
        const { error } = await supabase.from('wallets').delete().eq('id', id);
        if (error) {
            toast.error('Gagal menghapus');
        } else {
            setWallets(wallets.filter(w => w.id !== id));
            toast.success('Dompet dihapus');
        }
    }
  };

  const rupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

  return (
    <div className="min-h-screen w-full max-w-7xl mx-auto px-4 pt-24 pb-24 font-sans text-gray-800">
      
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 mb-6">
        <h1 className="text-3xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Dompet & Saldo
        </h1>
        <p className="text-sm font-medium text-gray-400 mt-1">Kelola sumber dana dan saldo awal.</p>
      </div>

      {/* Form Tambah / Edit */}
      <div className={`p-6 rounded-[2rem] shadow-sm border border-gray-100 mb-8 transition-colors ${editingId ? 'bg-indigo-50 border-indigo-200' : 'bg-white'}`}>
        <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-700">
                {editingId ? `✏️ Edit Dompet` : `➕ Tambah Dompet Baru`}
            </h3>
            {editingId && (
                <button onClick={cancelEdit} className="text-xs text-rose-500 font-bold hover:underline">Batal Edit</button>
            )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-3">
            <input 
                type="text" 
                placeholder="Nama (BCA, GoPay)" 
                className="flex-1 p-4 bg-white rounded-2xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-100 border border-gray-200"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
            />
            <input 
                type="number" 
                placeholder="Saldo Awal (Rp)" 
                className="w-full md:w-48 p-4 bg-white rounded-2xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-100 border border-gray-200"
                value={saldoAwal}
                onChange={(e) => setSaldoAwal(e.target.value)}
            />
            <motion.button 
                whileTap={{ scale: 0.95 }}
                disabled={isSubmitting}
                className={`text-white px-8 py-4 rounded-2xl font-bold shadow-lg transition-colors disabled:opacity-50 ${editingId ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-900 hover:bg-black'}`}
            >
                {isSubmitting ? '...' : (editingId ? 'Update' : 'Tambah')}
            </motion.button>
        </form>
      </div>

      {/* List Wallets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
            {loading ? (
                <div className="col-span-full text-center py-10 text-gray-400 font-bold">Menghitung saldo...</div>
            ) : (
                wallets.map((wallet) => (
                    <motion.div 
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        key={wallet.id} 
                        className={`p-6 rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border flex justify-between items-start group relative overflow-hidden transition-all ${editingId === wallet.id ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-300' : 'bg-white border-gray-50 hover:border-indigo-100'}`}
                    >
                        <div className="flex flex-col gap-1 z-10">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">
                                    {wallet.name}
                                </span>
                            </div>
                            <p className="text-gray-400 text-xs font-medium">Sisa Saldo Saat Ini</p>
                            <h3 className={`text-2xl font-black ${wallet.balance < 0 ? 'text-rose-500' : 'text-gray-800'}`}>
                                {rupiah(wallet.balance)}
                            </h3>
                            <p className="text-[10px] text-gray-300 mt-1">Saldo Awal: {rupiah(wallet.saldo_awal)}</p>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2 absolute top-4 right-4">
                            {/* Tombol Edit */}
                            <button 
                                onClick={() => startEdit(wallet)}
                                className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center hover:bg-indigo-100 transition-colors shadow-sm"
                                title="Edit Saldo/Nama"
                            >
                                ✏️
                            </button>
                            {/* Tombol Hapus */}
                            <button 
                                onClick={() => handleDelete(wallet.id, wallet.name)}
                                className="w-8 h-8 rounded-full bg-rose-50 text-rose-400 flex items-center justify-center hover:bg-rose-100 hover:text-rose-600 transition-colors shadow-sm"
                                title="Hapus Dompet"
                            >
                                🗑️
                            </button>
                        </div>
                    </motion.div>
                ))
            )}
        </AnimatePresence>
      </div>
    </div>
  );
}