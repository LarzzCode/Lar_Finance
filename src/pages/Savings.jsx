import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import GoalCard from '../components/GoalCard';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

export default function Savings() {
  const { user } = useAuth();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  // State Modal (Untuk Tambah/Edit & Nabung)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNabungMode, setIsNabungMode] = useState(false);
  const [activeGoal, setActiveGoal] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '', target_amount: '', emoji: '🎯', color: 'blue', current_amount: 0
  });
  const [nabungAmount, setNabungAmount] = useState('');

  // 1. FETCH DATA
  useEffect(() => {
    fetchGoals();
  }, []);

  const fetchGoals = async () => {
    const { data } = await supabase.from('goals').select('*').order('created_at', { ascending: true });
    if (data) setGoals(data);
    setLoading(false);
  };

  // 2. HANDLE SUBMIT (CREATE / EDIT)
  const handleSubmitGoal = async (e) => {
    e.preventDefault();
    const payload = { 
        ...formData, 
        user_id: user.id,
        target_amount: Number(formData.target_amount.replace(/[^0-9]/g, '')), // Bersihkan format Rupiah
        current_amount: Number(formData.current_amount) 
    };

    let error;
    if (activeGoal && !isNabungMode) {
        // Mode Edit
        const { error: err } = await supabase.from('goals').update(payload).eq('id', activeGoal.id);
        error = err;
    } else {
        // Mode Baru
        const { error: err } = await supabase.from('goals').insert([payload]);
        error = err;
    }

    if (error) toast.error('Gagal: ' + error.message);
    else {
        toast.success(activeGoal ? 'Diupdate!' : 'Impian Dibuat!');
        closeModal();
        fetchGoals();
    }
  };

  // 3. HANDLE NABUNG (UPDATE UANG SAJA)
  const handleNabungSubmit = async (e) => {
    e.preventDefault();
    if (!nabungAmount) return;
    
    const nominal = Number(nabungAmount.replace(/[^0-9]/g, ''));
    const newTotal = Number(activeGoal.current_amount) + nominal;

    const { error } = await supabase.from('goals').update({ current_amount: newTotal }).eq('id', activeGoal.id);
    
    if (error) {
        toast.error('Gagal menabung');
    } else {
        // Efek Visual
        toast.success(`Berhasil nabung Rp ${nominal.toLocaleString('id-ID')}!`);
        if (newTotal >= activeGoal.target_amount) {
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } }); // KONFETI JIKA LUNAS!
            toast('SELAMAT! IMPIAN TERCAPAI! 🎉', { icon: '🏆', duration: 5000 });
        }
        closeModal();
        fetchGoals();
    }
  };

  // 4. HANDLE DELETE
  const handleDelete = async (id) => {
    if (confirm('Yakin ingin menghapus impian ini?')) {
        await supabase.from('goals').delete().eq('id', id);
        toast.success('Dihapus');
        fetchGoals();
    }
  };

  // Helpers Modal
  const openNewGoal = () => {
    setFormData({ name: '', target_amount: '', emoji: '🎯', color: 'blue', current_amount: 0 });
    setIsNabungMode(false); setActiveGoal(null); setIsModalOpen(true);
  };
  
  const openEditGoal = (goal) => {
    setFormData(goal);
    setIsNabungMode(false); setActiveGoal(goal); setIsModalOpen(true);
  };

  const openNabung = (goal) => {
    setNabungAmount('');
    setIsNabungMode(true); setActiveGoal(goal); setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  return (
    <div className="min-h-screen w-full max-w-7xl mx-auto px-4 pt-24 pb-24">
      
      {/* HEADER */}
      <div className="flex justify-between items-end mb-8">
        <div>
            <h1 className="text-3xl font-black text-gray-800">Tabungan Impian</h1>
            <p className="text-gray-500 text-sm mt-1">Wujudkan keinginanmu satu per satu.</p>
        </div>
        <button onClick={openNewGoal} className="bg-gray-900 text-white px-5 py-3 rounded-2xl font-bold shadow-lg hover:scale-105 transition-transform flex items-center gap-2">
            <span>+</span> <span className="hidden sm:inline">Buat Baru</span>
        </button>
      </div>

      {/* GRID KARTU */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {goals.map((goal) => (
            <GoalCard 
                key={goal.id} 
                goal={goal} 
                onNabung={openNabung} 
                onEdit={openEditGoal} 
                onDelete={handleDelete} 
            />
        ))}
        {/* State Kosong */}
        {!loading && goals.length === 0 && (
            <div className="col-span-full py-20 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-3xl">
                <p className="text-4xl mb-2">🌱</p>
                <p>Belum ada impian.</p>
                <button onClick={openNewGoal} className="text-indigo-600 font-bold text-sm mt-2 hover:underline">Buat sekarang yuk!</button>
            </div>
        )}
      </div>

      {/* MODAL (BISA UNTUK NABUNG / EDIT) */}
      <AnimatePresence>
        {isModalOpen && (
            <div className="fixed inset-0 z-[999] flex items-center justify-center px-4">
                <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={closeModal} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                <motion.div initial={{scale:0.9, opacity:0}} animate={{scale:1, opacity:1}} exit={{scale:0.9, opacity:0}} className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl relative z-10">
                    
                    {/* MODAL TITLE */}
                    <h2 className="text-xl font-black text-gray-800 mb-6 text-center">
                        {isNabungMode ? `Nabung buat ${activeGoal?.name}` : (activeGoal ? 'Edit Impian' : 'Impian Baru')}
                    </h2>

                    {/* FORM SESUAI MODE */}
                    {isNabungMode ? (
                        <form onSubmit={handleNabungSubmit} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase">Nominal Setor</label>
                                <input 
                                    autoFocus type="number" placeholder="Rp 0" 
                                    className="w-full text-3xl font-black text-center border-b-2 border-indigo-100 focus:border-indigo-500 outline-none py-2 text-indigo-600 placeholder-indigo-200"
                                    value={nabungAmount} onChange={e => setNabungAmount(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-2 pt-4">
                                <button type="button" onClick={closeModal} className="flex-1 py-3 font-bold text-gray-500 bg-gray-100 rounded-xl">Batal</button>
                                <button type="submit" className="flex-1 py-3 font-bold text-white bg-indigo-600 rounded-xl shadow-lg hover:bg-indigo-700">Setor 💸</button>
                            </div>
                        </form>
                    ) : (
                        <form onSubmit={handleSubmitGoal} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase">Nama Barang/Tujuan</label>
                                <input required type="text" className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-100" placeholder="Contoh: iPhone 16"
                                    value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase">Harga Target (Rp)</label>
                                <input required type="number" className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-100" placeholder="15000000"
                                    value={formData.target_amount} onChange={e => setFormData({...formData, target_amount: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase">Emoji</label>
                                    <input type="text" className="w-full p-3 bg-gray-50 rounded-xl font-bold text-center text-gray-700 outline-none focus:ring-2 focus:ring-indigo-100" placeholder="🎯"
                                        value={formData.emoji} onChange={e => setFormData({...formData, emoji: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase">Warna</label>
                                    <select className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-100"
                                        value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})}>
                                        <option value="blue">Biru</option>
                                        <option value="pink">Pink</option>
                                        <option value="green">Hijau</option>
                                        <option value="orange">Oranye</option>
                                        <option value="purple">Ungu</option>
                                    </select>
                                </div>
                            </div>
                             <div className="flex gap-2 pt-4">
                                <button type="button" onClick={closeModal} className="flex-1 py-3 font-bold text-gray-500 bg-gray-100 rounded-xl">Batal</button>
                                <button type="submit" className="flex-1 py-3 font-bold text-white bg-gray-900 rounded-xl shadow-lg">Simpan</button>
                            </div>
                        </form>
                    )}
                </motion.div>
            </div>
        )}
      </AnimatePresence>

    </div>
  );
}