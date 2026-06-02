import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import * as icons from 'lucide-react';

// --- 1. KOMPONEN PENAFSIR IKON DINAMIS ---
const DynamicIcon = ({ name, size = 20, className = "" }) => {
  const LucideIcon = icons[name] || icons['HelpCircle'];
  return <LucideIcon size={size} className={className} />;
};

// --- 2. DAFTAR IKON YANG BISA DIPILIH (ICON LIBRARY) ---
const AVAILABLE_ICONS = [
  'Utensils', 'HeartPulse', 'GraduationCap', 'Wifi', 'Users', 
  'HeartHandshake', 'ShoppingCart', 'Sparkles', 'Car', 'LayoutGrid', 
  'Briefcase', 'Gift', 'Wallet', 'Coffee', 'Dumbbell', 'Gamepad2', 
  'Home', 'Music', 'Plane', 'Smartphone', 'Scissors', 'Baby'
];

export default function Categories() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('expense'); // 'expense' | 'income'
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  // Default icon saat tambah kategori baru adalah 'LayoutGrid'
  const [formData, setFormData] = useState({ name: '', icon: 'LayoutGrid' }); 

  useEffect(() => {
    if(user) fetchCategories();
  }, [user, activeTab]);

  const fetchCategories = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('type', activeTab)
      .order('name');
    setCategories(data || []);
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
        // Menyertakan icon dari formData ke payload database
        const payload = { name: formData.name, type: activeTab, user_id: user.id, icon: formData.icon };
        
        if (editData) {
            await supabase.from('categories').update({ name: formData.name, icon: formData.icon }).eq('id', editData.id);
            toast.success('Kategori diperbarui');
        } else {
            await supabase.from('categories').insert([payload]);
            toast.success('Kategori ditambahkan');
        }
        setIsModalOpen(false);
        setEditData(null);
        setFormData({ name: '', icon: 'LayoutGrid' });
        fetchCategories();
    } catch (error) {
        toast.error('Gagal: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
      if(!confirm("Hapus kategori ini? Transaksi terkait akan kehilangan kategori.")) return;
      try {
        await supabase.from('categories').delete().eq('id', id);
        fetchCategories();
        toast.success('Dihapus');
      } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="min-h-screen w-full max-w-5xl mx-auto px-4 md:px-8 pb-24 pt-0 md:pt-28 font-sans text-gray-800">
      
      {/* Header */}
      <div className="flex justify-between items-end mb-8 pt-8 md:pt-0">
         <div>
            <h1 className="text-3xl font-black text-gray-800">Kategori</h1>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Atur pos keuanganmu</p>
         </div>
         <button onClick={() => { setEditData(null); setFormData({name:'', icon: 'LayoutGrid'}); setIsModalOpen(true); }} className="bg-gray-900 text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg hover:bg-black transition-colors">
            + Baru
         </button>
      </div>

      {/* Tab Switcher */}
      <div className="bg-gray-200 p-1.5 rounded-2xl flex relative mb-8 max-w-sm">
        {['expense', 'income'].map((tab) => (
            <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 relative z-10 py-2.5 text-xs font-bold text-center uppercase tracking-wider transition-colors duration-200 ${activeTab === tab ? (tab === 'expense' ? 'text-rose-600' : 'text-emerald-600') : 'text-gray-500'}`}
            >
                {activeTab === tab && (
                    <motion.div layoutId="active-cat-tab" className="absolute inset-0 bg-white rounded-xl shadow-sm -z-10" transition={{ type: "spring", stiffness: 500, damping: 30 }} />
                )}
                {tab === 'expense' ? 'Pengeluaran' : 'Pemasukan'}
            </button>
        ))}
      </div>

      {/* Grid Kategori */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {categories.map((cat) => (
            <div key={cat.id} className="group bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center gap-3 relative overflow-hidden">
                
                {/* --- 3. IMPLEMENTASI DYNAMIC ICON DI DAFTAR KATEGORI --- */}
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${activeTab === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                    <DynamicIcon name={cat.icon} size={28} />
                </div>

                <p className="text-sm font-bold text-gray-700 text-center truncate w-full">{cat.name}</p>
                
                {/* Action Buttons (Hover Only) */}
                <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Saat edit, form diisi oleh data kategori beserta ikon lamanya */}
                    <button onClick={() => { setEditData(cat); setFormData({ name: cat.name, icon: cat.icon || 'LayoutGrid' }); setIsModalOpen(true); }} className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs">✎</button>
                    <button onClick={() => handleDelete(cat.id)} className="w-8 h-8 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center text-xs">✕</button>
                </div>
            </div>
        ))}
        {/* Empty State */}
        {categories.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-400 text-xs font-bold uppercase tracking-widest">
                Belum ada kategori
            </div>
        )}
      </div>

      {/* Modal Form */}
      <AnimatePresence>
        {isModalOpen && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white p-8 rounded-[2rem] w-full max-w-sm shadow-2xl">
                    <h2 className="text-xl font-black mb-6 text-gray-800">{editData ? 'Edit Kategori' : 'Kategori Baru'}</h2>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nama Kategori</label>
                            <input 
                                type="text" required autoFocus
                                value={formData.name} 
                                onChange={e=>setFormData({...formData, name: e.target.value})} 
                                className="w-full mt-2 p-4 bg-gray-50 rounded-2xl font-bold outline-none focus:bg-white focus:ring-2 focus:ring-gray-100 transition-all placeholder-gray-300" 
                                placeholder="Contoh: Belanja, Gaji" 
                            />
                        </div>
                        
                        {/* --- 4. ICON PICKER GRID DI DALAM MODAL --- */}
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Pilih Ikon</label>
                            <div className="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto p-3 bg-gray-50 rounded-2xl border border-gray-100 custom-scrollbar">
                                {AVAILABLE_ICONS.map((iconName) => (
                                    <button
                                        key={iconName}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, icon: iconName })}
                                        className={`p-2 rounded-xl flex items-center justify-center transition-all ${
                                            formData.icon === iconName
                                                ? (activeTab === 'income' ? 'bg-emerald-100 text-emerald-600 shadow-sm' : 'bg-rose-100 text-rose-500 shadow-sm')
                                                : 'text-gray-400 hover:bg-gray-200 hover:text-gray-600'
                                        }`}
                                    >
                                        <DynamicIcon name={iconName} size={20} />
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        {/* Info Visual Preview */}
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black ${activeTab === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-500'}`}>
                                <DynamicIcon name={formData.icon} size={20} />
                            </div>
                            <p className="text-xs text-gray-400 font-medium">Preview Tampilan</p>
                        </div>

                        <div className="flex gap-4 pt-4">
                            <button type="button" onClick={()=>setIsModalOpen(false)} className="flex-1 py-4 bg-gray-100 font-bold text-gray-500 rounded-2xl hover:bg-gray-200">Batal</button>
                            <button type="submit" className="flex-1 py-4 bg-gray-900 font-bold text-white rounded-2xl shadow-lg hover:bg-black">Simpan</button>
                        </div>
                    </form>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
}