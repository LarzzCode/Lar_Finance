import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

export default function Dompet() {
  const { user } = useAuth();
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState(null); 
  const [formData, setFormData] = useState({ name: '', saldo_awal: '' }); // Removed icon field

  useEffect(() => { fetchWallets(); }, [user]);
  const fetchWallets = async () => { setLoading(true); const { data } = await supabase.from('wallets').select('*').order('created_at'); setWallets(data || []); setLoading(false); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
        const payload = { name: formData.name, saldo_awal: formData.saldo_awal, user_id: user.id };
        if (editData) { await supabase.from('wallets').update(payload).eq('id', editData.id); toast.success('Diperbarui'); } 
        else { await supabase.from('wallets').insert([payload]); toast.success('Ditambahkan'); }
        setIsModalOpen(false); setEditData(null); setFormData({ name: '', saldo_awal: '' }); fetchWallets();
    } catch (error) { toast.error(error.message); }
  };
  const handleDelete = async (id) => { if(!confirm("Hapus dompet ini?")) return; await supabase.from('wallets').delete().eq('id', id); fetchWallets(); toast.success('Dihapus'); };
  const rupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

  return (
    <div className="min-h-screen w-full max-w-5xl mx-auto px-4 md:px-8 pb-24 pt-0 md:pt-28 font-sans text-gray-800">
      <div className="flex justify-between items-end mb-8 pt-8 md:pt-0">
         <div>
            <h1 className="text-3xl font-black text-gray-800">Dompet Saya</h1>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Kelola sumber dana</p>
         </div>
         <button onClick={() => { setEditData(null); setFormData({name:'', saldo_awal:''}); setIsModalOpen(true); }} className="bg-gray-900 text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg hover:bg-black transition-colors">
            + Tambah
         </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {wallets.map((wallet) => (
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} key={wallet.id} className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-lg transition-all relative group">
                <div className="flex justify-between items-start mb-6">
                    {/* Clean Initial Icon */}
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-lg font-black uppercase">
                        {wallet.name.charAt(0)}
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditData(wallet); setFormData(wallet); setIsModalOpen(true); }} className="text-[10px] bg-gray-100 px-3 py-1 rounded-lg font-bold hover:bg-gray-200">EDIT</button>
                        <button onClick={() => handleDelete(wallet.id)} className="text-[10px] bg-rose-50 text-rose-500 px-3 py-1 rounded-lg font-bold hover:bg-rose-100">HAPUS</button>
                    </div>
                </div>
                <h3 className="text-lg font-bold text-gray-600">{wallet.name}</h3>
                <p className="text-2xl font-black text-gray-900 mt-1">{rupiah(wallet.saldo_awal)}</p>
            </motion.div>
        ))}
      </div>

      {isModalOpen && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white p-8 rounded-[2rem] w-full max-w-sm shadow-2xl">
                  <h2 className="text-xl font-black mb-6 text-gray-800">{editData ? 'Edit Dompet' : 'Dompet Baru'}</h2>
                  <form onSubmit={handleSubmit} className="space-y-5">
                      <div><label className="text-[10px] font-bold text-gray-400 uppercase">Nama Dompet</label><input type="text" required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full mt-1 p-4 bg-gray-50 rounded-2xl font-bold outline-none" placeholder="Contoh: BCA" /></div>
                      <div><label className="text-[10px] font-bold text-gray-400 uppercase">Saldo Awal</label><input type="number" required value={formData.saldo_awal} onChange={e=>setFormData({...formData, saldo_awal: e.target.value})} className="w-full mt-1 p-4 bg-gray-50 rounded-2xl font-bold outline-none" placeholder="0" /></div>
                      <div className="flex gap-4 pt-2"><button type="button" onClick={()=>setIsModalOpen(false)} className="flex-1 py-4 bg-gray-100 font-bold text-gray-500 rounded-2xl">Batal</button><button type="submit" className="flex-1 py-4 bg-indigo-600 font-bold text-white rounded-2xl shadow-lg">Simpan</button></div>
                  </form>
              </motion.div>
          </div>
      )}
    </div>
  );
}