import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

export default function Dompet() {
  const { user } = useAuth();
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState(null); // Jika null berarti Mode Tambah
  const [formData, setFormData] = useState({ name: '', saldo_awal: '', icon: '💳' });

  useEffect(() => {
    fetchWallets();
  }, [user]);

  const fetchWallets = async () => {
    setLoading(true);
    const { data } = await supabase.from('wallets').select('*').order('created_at');
    setWallets(data || []);
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
        if (editData) {
            // Update
            const { error } = await supabase.from('wallets').update({ name: formData.name, saldo_awal: formData.saldo_awal, icon: formData.icon }).eq('id', editData.id);
            if(error) throw error;
            toast.success('Dompet diperbarui');
        } else {
            // Tambah
            const { error } = await supabase.from('wallets').insert([{ ...formData, user_id: user.id }]);
            if(error) throw error;
            toast.success('Dompet ditambahkan');
        }
        setIsModalOpen(false);
        setEditData(null);
        setFormData({ name: '', saldo_awal: '', icon: '💳' });
        fetchWallets();
    } catch (error) {
        toast.error('Gagal: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    if(!confirm("Hapus dompet ini? Transaksi terkait akan kehilangan info dompet.")) return;
    await supabase.from('wallets').delete().eq('id', id);
    fetchWallets();
    toast.success('Dompet dihapus');
  };

  const rupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

  return (
    // UPDATED: pt-0 mobile, md:pt-28 desktop
    <div className="min-h-screen w-full max-w-5xl mx-auto px-4 md:px-8 pb-24 pt-0 md:pt-28 font-sans text-gray-800">
      
      <div className="flex justify-between items-end mb-6 pt-6 md:pt-0">
         <div>
            <h1 className="text-3xl font-black text-gray-800">Dompet 💳</h1>
            <p className="text-sm text-gray-400 font-medium">Kelola sumber danamu.</p>
         </div>
         <button onClick={() => { setEditData(null); setFormData({name:'', saldo_awal:'', icon:'💳'}); setIsModalOpen(true); }} className="bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-black transition-colors">
            + Tambah
         </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {wallets.map((wallet) => (
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} key={wallet.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative group">
                <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-2xl">{wallet.icon}</div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditData(wallet); setFormData(wallet); setIsModalOpen(true); }} className="text-xs bg-gray-100 p-2 rounded-lg hover:bg-gray-200">✎</button>
                        <button onClick={() => handleDelete(wallet.id)} className="text-xs bg-rose-50 text-rose-500 p-2 rounded-lg hover:bg-rose-100">✕</button>
                    </div>
                </div>
                <h3 className="text-lg font-bold text-gray-700">{wallet.name}</h3>
                <p className="text-2xl font-black text-gray-900 mt-1">{rupiah(wallet.saldo_awal)}</p>
                <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase tracking-wider">Saldo Awal</p>
            </motion.div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl">
                  <h2 className="text-xl font-black mb-4">{editData ? 'Edit Dompet' : 'Dompet Baru'}</h2>
                  <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                          <label className="text-xs font-bold text-gray-400 uppercase">Nama Dompet</label>
                          <input type="text" required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full mt-1 p-3 bg-gray-50 rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-100" placeholder="Contoh: BCA, Cash" />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-gray-400 uppercase">Saldo Awal</label>
                          <input type="number" required value={formData.saldo_awal} onChange={e=>setFormData({...formData, saldo_awal: e.target.value})} className="w-full mt-1 p-3 bg-gray-50 rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-100" placeholder="0" />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-gray-400 uppercase">Icon</label>
                          <input type="text" value={formData.icon} onChange={e=>setFormData({...formData, icon: e.target.value})} className="w-full mt-1 p-3 bg-gray-50 rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-100" placeholder="💳" />
                      </div>
                      <div className="flex gap-2 pt-2">
                          <button type="button" onClick={()=>setIsModalOpen(false)} className="flex-1 py-3 bg-gray-100 font-bold text-gray-500 rounded-xl">Batal</button>
                          <button type="submit" className="flex-1 py-3 bg-indigo-600 font-bold text-white rounded-xl shadow-lg">Simpan</button>
                      </div>
                  </form>
              </motion.div>
          </div>
      )}
    </div>
  );
}