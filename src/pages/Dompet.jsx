import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { id } from 'date-fns/locale';

export default function Dompet() {
  const { user } = useAuth();
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState(null); 
  const [formData, setFormData] = useState({ name: '', saldo_awal: '' });

  const [currentDate] = useState(new Date());

  useEffect(() => {
    if (user) fetchWalletsAndCalculate();
  }, [user]);

  const fetchWalletsAndCalculate = async () => {
    setLoading(true);
    
    // 1. Tentukan Tanggal Awal & Akhir Bulan Ini
    const startDate = format(startOfMonth(currentDate), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(currentDate), 'yyyy-MM-dd');

    // 2. Ambil Data Dompet
    const { data: walletData, error: errWallet } = await supabase
        .from('wallets')
        .select('*')
        .order('created_at');

    if (errWallet) { toast.error(errWallet.message); setLoading(false); return; }

    // 3. Ambil Transaksi (BULAN INI)
    // Kita select wallet_id dengan jelas
    const { data: txData, error: errTx } = await supabase
        .from('transactions')
        .select('amount, wallet_id, categories(type)')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate);

    if (errTx) { toast.error(errTx.message); setLoading(false); return; }

    // 4. HITUNG SALDO (Dengan Perbaikan Logika ID)
    const calculatedWallets = walletData.map(w => {
        // PERBAIKAN: Gunakan String() untuk memastikan ID sama persis
        const myTxs = txData.filter(t => String(t.wallet_id) === String(w.id));
        
        const totalIncome = myTxs
            .filter(t => t.categories?.type === 'income')
            .reduce((acc, curr) => acc + Number(curr.amount), 0);
            
        const totalExpense = myTxs
            .filter(t => t.categories?.type === 'expense')
            .reduce((acc, curr) => acc + Number(curr.amount), 0);

        // Rumus: Saldo Awal (Inputan User) + Masuk - Keluar
        const realBalance = (Number(w.saldo_awal) || 0) + totalIncome - totalExpense;

        return { 
            ...w, 
            balance: realBalance, 
            income: totalIncome, 
            expense: totalExpense 
        };
    });

    setWallets(calculatedWallets);
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
        const payload = { name: formData.name, saldo_awal: formData.saldo_awal, user_id: user.id };
        if (editData) { 
            await supabase.from('wallets').update(payload).eq('id', editData.id); 
            toast.success('Diperbarui'); 
        } else { 
            await supabase.from('wallets').insert([payload]); 
            toast.success('Ditambahkan'); 
        }
        setIsModalOpen(false); 
        setEditData(null); 
        setFormData({ name: '', saldo_awal: '' }); 
        fetchWalletsAndCalculate(); 
    } catch (error) { toast.error(error.message); }
  };

  const handleDelete = async (id) => {
    if(!confirm("Hapus dompet ini?")) return;
    await supabase.from('wallets').delete().eq('id', id);
    fetchWalletsAndCalculate();
    toast.success('Dihapus');
  };

  const rupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

  return (
    <div className="min-h-screen w-full max-w-5xl mx-auto px-4 md:px-8 pb-24 pt-0 md:pt-28 font-sans text-gray-800">
      
      {/* Header */}
      <div className="flex justify-between items-end mb-8 pt-8 md:pt-0">
         <div>
            <h1 className="text-3xl font-black text-gray-800">Dompet Saya</h1>
            <div className="flex items-center gap-2 mt-2">
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Periode</p>
                <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-lg uppercase border border-indigo-100">
                    {format(currentDate, 'MMMM yyyy', { locale: id })}
                </span>
            </div>
         </div>
         <button onClick={() => { setEditData(null); setFormData({name:'', saldo_awal:''}); setIsModalOpen(true); }} className="bg-gray-900 text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg hover:bg-black transition-colors">
            + Tambah
         </button>
      </div>

      {/* Grid Dompet */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? <p className="text-gray-400 font-bold text-xs uppercase col-span-full text-center py-20">Menghitung Aset...</p> : wallets.map((wallet) => (
            <motion.div 
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} 
                key={wallet.id} 
                className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-lg transition-all relative group"
            >
                <div className="flex justify-between items-start mb-6">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-lg font-black uppercase">
                        {wallet.name.charAt(0)}
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditData(wallet); setFormData(wallet); setIsModalOpen(true); }} className="text-[10px] bg-gray-100 px-3 py-1 rounded-lg font-bold hover:bg-gray-200">EDIT</button>
                        <button onClick={() => handleDelete(wallet.id)} className="text-[10px] bg-rose-50 text-rose-500 px-3 py-1 rounded-lg font-bold hover:bg-rose-100">HAPUS</button>
                    </div>
                </div>
                
                <h3 className="text-lg font-bold text-gray-600">{wallet.name}</h3>
                
                {/* SALDO REAL (BULAN INI) */}
                <p className={`text-2xl font-black mt-1 ${wallet.balance < 0 ? 'text-rose-500' : 'text-gray-900'}`}>
                    {rupiah(wallet.balance)}
                </p>
                
                {/* Detail Arus Kas */}
                <div className="flex gap-4 mt-6 pt-4 border-t border-gray-50">
                    <div>
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Masuk</p>
                        <p className="text-xs font-bold text-emerald-600 mt-0.5">+{rupiah(wallet.income)}</p>
                    </div>
                    <div>
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Keluar</p>
                        <p className="text-xs font-bold text-rose-500 mt-0.5">-{rupiah(wallet.expense)}</p>
                    </div>
                </div>
            </motion.div>
        ))}
      </div>

      {/* Modal Form */}
      <AnimatePresence>
        {isModalOpen && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="bg-white p-8 rounded-[2rem] w-full max-w-sm shadow-2xl">
                    <h2 className="text-xl font-black mb-6 text-gray-800">{editData ? 'Edit Dompet' : 'Dompet Baru'}</h2>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Nama Dompet</label>
                            <input type="text" required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full mt-1 p-4 bg-gray-50 rounded-2xl font-bold outline-none border-transparent focus:bg-gray-50 focus:ring-2 focus:ring-gray-100" placeholder="Contoh: BCA" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Saldo Awal Bulan Ini</label>
                            <input type="number" required value={formData.saldo_awal} onChange={e=>setFormData({...formData, saldo_awal: e.target.value})} className="w-full mt-1 p-4 bg-gray-50 rounded-2xl font-bold outline-none border-transparent focus:bg-gray-50 focus:ring-2 focus:ring-gray-100" placeholder="0" />
                            <p className="text-[9px] text-gray-400 mt-1 leading-relaxed">
                                *Sistem akan menghitung: Saldo Awal + Transaksi Bulan Ini.
                            </p>
                        </div>
                        <div className="flex gap-4 pt-2">
                            <button type="button" onClick={()=>setIsModalOpen(false)} className="flex-1 py-4 bg-gray-100 font-bold text-gray-500 rounded-2xl hover:bg-gray-200">Batal</button>
                            <button type="submit" className="flex-1 py-4 bg-indigo-600 font-bold text-white rounded-2xl shadow-lg hover:bg-indigo-700">Simpan</button>
                        </div>
                    </form>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
}