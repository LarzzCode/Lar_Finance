import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export default function Wallets() {
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [inputBalance, setInputBalance] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    // 1. Ambil Data Wallet
    const { data: walletData } = await supabase.from('wallets').select('*').order('id');

    // 2. Ambil Transaksi
    const { data: transactions } = await supabase.from('transactions').select('amount, payment_method, categories(type)');

    // 3. Logika Hitung Saldo (DIPERBAIKI: CASE INSENSITIVE)
    const calculatedWallets = walletData.map(wallet => {
      
      // Filter transaksi: Samakan semua jadi huruf kecil & hapus spasi agar pasti cocok
      const walletTx = transactions.filter(t => {
        const txMethod = t.payment_method ? t.payment_method.toLowerCase().trim() : '';
        const walletName = wallet.name ? wallet.name.toLowerCase().trim() : '';
        return txMethod === walletName;
      });

      // Hitung Mutasi
      const totalMutation = walletTx.reduce((acc, curr) => {
        const amount = Number(curr.amount);
        // Pastikan membaca tipe kategori dengan aman
        const type = curr.categories?.type || 'expense'; // Default ke expense jika null

        if (type === 'income') {
          return acc + amount; // Tambah
        } else {
          return acc - amount; // Kurang
        }
      }, 0);

      return {
        ...wallet,
        currentBalance: Number(wallet.initial_balance) + totalMutation
      };
    });

    setWallets(calculatedWallets);
    setLoading(false);
  };

  const handleEditClick = (wallet) => {
    setSelectedWallet(wallet);
    setInputBalance(wallet.initial_balance);
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const { error } = await supabase
      .from('wallets')
      .update({ initial_balance: inputBalance })
      .eq('id', selectedWallet.id);

    if (error) {
      toast.error('Gagal update: ' + error.message);
    } else {
      toast.success('Saldo awal diperbarui!');
      setIsModalOpen(false);
      fetchData();
    }
  };

  const rupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

  const getCardStyle = (name) => {
    const n = name.toLowerCase();
    if (n.includes('mandiri')) return 'bg-gradient-to-r from-blue-600 to-indigo-700'; 
    if (n.includes('bca')) return 'bg-gradient-to-r from-purple-600 to-blue-500'; 
    if (n.includes('cash') || n.includes('tunai')) return 'bg-gradient-to-r from-green-500 to-emerald-700'; 
    return 'bg-gradient-to-r from-gray-500 to-gray-700';
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dompet Saya</h2>
          <p className="text-sm text-gray-500">Monitor saldo real-time di setiap akun.</p>
        </div>
        <div className="text-right bg-white p-3 rounded-xl shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 uppercase font-bold">Total Kekayaan</p>
          <p className="text-xl font-black text-gray-800">
            {rupiah(wallets.reduce((acc, w) => acc + w.currentBalance, 0))}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? <p className="text-center w-full">Menghitung saldo...</p> : wallets.map((w) => (
          <motion.div 
            key={w.id}
            whileHover={{ y: -5 }}
            className={`rounded-2xl p-6 shadow-xl text-white relative overflow-hidden ${getCardStyle(w.name)}`}
          >
            {/* Dekorasi */}
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-2xl"></div>
            
            <div className="flex justify-between items-start mb-8">
              <span className="bg-white/20 px-3 py-1 rounded-lg text-xs font-bold backdrop-blur-sm uppercase tracking-wider">
                {w.type}
              </span>
              <button onClick={() => handleEditClick(w)} className="opacity-70 hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-white/10">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </button>
            </div>

            <div>
              <p className="text-sm opacity-90 mb-1 capitalize font-medium">{w.name}</p>
              <h3 className="text-3xl font-bold tracking-tight">{rupiah(w.currentBalance)}</h3>
            </div>

            <div className="mt-6 pt-4 border-t border-white/20 flex justify-between text-xs opacity-80">
              <span>Saldo Awal: {rupiah(w.initial_balance)}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* MODAL EDIT */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl"
            >
              <h3 className="text-lg font-bold mb-2 capitalize">Atur Saldo Awal: {selectedWallet?.name}</h3>
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                Masukkan jumlah uang yang ada di rekening ini <b>sebelum</b> Anda mulai menggunakan aplikasi ini. Sistem akan menambah/menguranginya sesuai transaksi yang Anda input.
              </p>
              
              <form onSubmit={handleSave}>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Saldo Awal (Rp)</label>
                <input 
                  type="number" 
                  autoFocus
                  required
                  className="w-full p-3 border border-gray-300 rounded-xl font-bold text-lg mb-6 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  value={inputBalance}
                  onChange={(e) => setInputBalance(e.target.value)}
                  placeholder="0"
                />
                <div className="flex gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-gray-600 font-bold bg-gray-100 rounded-xl hover:bg-gray-200">
                    Batal
                  </button>
                  <button type="submit" className="flex-1 py-3 text-white font-bold bg-blue-600 rounded-xl hover:bg-blue-700 shadow-lg">
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