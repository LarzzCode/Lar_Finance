import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import * as icons from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const AVAILABLE_ICONS = [
  'Utensils', 'HeartPulse', 'GraduationCap', 'Wifi', 'Users',
  'HeartHandshake', 'ShoppingCart', 'Sparkles', 'Car', 'LayoutGrid',
  'Briefcase', 'Gift', 'Wallet', 'Coffee', 'Dumbbell', 'Gamepad2',
  'Home', 'Music', 'Plane', 'Smartphone', 'Scissors', 'Baby',
];

const DynamicIcon = ({ name, size = 20 }) => {
  const Icon = icons[name] || icons.HelpCircle;
  return <Icon size={size} />;
};

export default function CategoriesSecure() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('expense');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: '', icon: 'LayoutGrid' });

  useEffect(() => {
    if (user) loadCategories();
  }, [user, activeTab]);

  const loadCategories = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', activeTab)
      .order('name');
    if (error) toast.error(`Gagal memuat kategori: ${error.message}`);
    setCategories(data || []);
    setLoading(false);
  };

  const filteredCategories = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return categories;
    return categories.filter((category) => (category.name || '').toLowerCase().includes(search));
  }, [categories, query]);

  const openCreate = () => {
    setEditData(null);
    setFormData({ name: '', icon: 'LayoutGrid' });
    setIsModalOpen(true);
  };

  const openEdit = (category) => {
    setEditData(category);
    setFormData({ name: category.name || '', icon: category.icon || 'LayoutGrid' });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditData(null);
    setFormData({ name: '', icon: 'LayoutGrid' });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user) return;
    const name = formData.name.trim();
    if (!name) return toast.error('Nama kategori wajib diisi');
    if (name.length > 50) return toast.error('Nama kategori maksimal 50 karakter');

    const duplicate = categories.some(
      (category) => category.id !== editData?.id && (category.name || '').trim().toLowerCase() === name.toLowerCase(),
    );
    if (duplicate) return toast.error('Kategori dengan nama yang sama sudah ada');

    setSaving(true);
    let result;
    if (editData) {
      result = await supabase
        .from('categories')
        .update({ name, icon: formData.icon })
        .eq('id', editData.id)
        .eq('user_id', user.id);
    } else {
      result = await supabase.from('categories').insert([{
        name,
        type: activeTab,
        user_id: user.id,
        icon: formData.icon,
      }]);
    }
    setSaving(false);

    if (result.error) return toast.error(result.error.message);
    toast.success(editData ? 'Kategori diperbarui' : 'Kategori ditambahkan');
    closeModal();
    loadCategories();
  };

  const handleDelete = async (category) => {
    if (!user) return;

    const [txRes, budgetRes, subRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('category_id', category.id),
      supabase
        .from('budgets')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('category_id', category.id),
      supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('category_id', category.id),
    ]);

    const auditError = txRes.error || budgetRes.error || subRes.error;
    if (auditError) return toast.error(`Tidak bisa memeriksa kategori: ${auditError.message}`);

    const references = (txRes.count || 0) + (budgetRes.count || 0) + (subRes.count || 0);
    if (references > 0) {
      toast.error(`Kategori "${category.name}" masih dipakai ${references} data. Edit namanya jika perlu, jangan dihapus.`);
      return;
    }

    if (!window.confirm(`Hapus kategori "${category.name}"? Kategori ini tidak memiliki data terkait.`)) return;
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', category.id)
      .eq('user_id', user.id);
    if (error) return toast.error(error.message);
    toast.success('Kategori dihapus');
    loadCategories();
  };

  const tone = activeTab === 'expense'
    ? {
        soft: 'bg-rose-50 text-rose-500',
        selected: 'bg-rose-50 border-rose-200 ring-2 ring-rose-100',
      }
    : {
        soft: 'bg-emerald-50 text-emerald-600',
        selected: 'bg-emerald-50 border-emerald-200 ring-2 ring-emerald-100',
      };

  return (
    <main className="min-h-screen bg-[#F6F7F9] pb-32 md:pb-16 md:pt-28 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 md:pt-6">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mb-7">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 mb-1">Master data</p>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">Kategori transaksi.</h1>
            <p className="text-sm text-slate-500 mt-2">Kategori milik akun lain tidak pernah dimuat, dan kategori yang masih dipakai data akan dilindungi dari penghapusan.</p>
          </div>
          <button onClick={openCreate} className="inline-flex items-center justify-center gap-2 bg-slate-950 hover:bg-black text-white rounded-2xl px-5 py-3.5 text-xs font-black shadow-lg shadow-slate-300"><icons.Plus size={16} /> Kategori baru</button>
        </header>

        <section className="bg-white border border-slate-200/70 rounded-[2rem] p-4 md:p-5 shadow-sm mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl md:w-80">
              {[
                ['expense', 'Pengeluaran', icons.ArrowUpRight],
                ['income', 'Pemasukan', icons.ArrowDownLeft],
              ].map(([key, label, Icon]) => (
                <button key={key} onClick={() => setActiveTab(key)} className={`py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${activeTab === key ? key === 'expense' ? 'bg-white text-rose-500 shadow-sm' : 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                  <Icon size={15} /> {label}
                </button>
              ))}
            </div>

            <label className="relative flex-1">
              <icons.Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari kategori..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-bold outline-none focus:bg-white focus:ring-4 focus:ring-slate-100" />
            </label>
            <div className="text-xs font-bold text-slate-400 md:px-3">{filteredCategories.length} kategori</div>
          </div>
        </section>

        {loading ? (
          <div className="py-20 text-center text-xs font-black uppercase tracking-widest text-slate-400">Memuat kategori...</div>
        ) : filteredCategories.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-[2rem] py-16 text-center"><icons.Tags size={28} className="mx-auto text-slate-300 mb-4" /><p className="font-black">Kategori tidak ditemukan.</p><p className="text-sm text-slate-400 mt-1">Coba kata pencarian lain atau buat kategori baru.</p></div>
        ) : (
          <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredCategories.map((category, index) => (
              <motion.article key={category.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.025 }} className="bg-white border border-slate-200/70 rounded-[1.75rem] p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${tone.soft}`}><DynamicIcon name={category.icon} size={22} /></div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(category)} aria-label={`Edit ${category.name}`} className="w-8 h-8 rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100 flex items-center justify-center"><icons.Pencil size={14} /></button>
                    <button onClick={() => handleDelete(category)} aria-label={`Hapus ${category.name}`} className="w-8 h-8 rounded-xl bg-rose-50 text-rose-400 hover:text-rose-600 flex items-center justify-center"><icons.Trash2 size={14} /></button>
                  </div>
                </div>
                <p className="font-black text-sm mt-5 truncate" title={category.name}>{category.name}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">{activeTab === 'expense' ? 'Pengeluaran' : 'Pemasukan'}</p>
              </motion.article>
            ))}
          </section>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[90] bg-slate-950/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div initial={{ opacity: 0, y: 32, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 32, scale: 0.98 }} className="bg-white w-full max-w-lg rounded-t-[2rem] sm:rounded-[2rem] p-6 md:p-7 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6"><div><p className="text-lg font-black">{editData ? 'Edit kategori' : 'Kategori baru'}</p><p className="text-xs text-slate-400 mt-1">{activeTab === 'expense' ? 'Pengeluaran' : 'Pemasukan'}</p></div><button onClick={closeModal} className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"><icons.X size={17} /></button></div>
              <form onSubmit={handleSubmit} className="space-y-5">
                <label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nama kategori</span><input autoFocus required maxLength={50} value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} placeholder="Contoh: Food & Drink" className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 font-bold outline-none focus:bg-white focus:ring-4 focus:ring-slate-100" /></label>
                <div><span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">Pilih ikon</span><div className="grid grid-cols-6 sm:grid-cols-8 gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-3 max-h-52 overflow-y-auto">{AVAILABLE_ICONS.map((iconName) => <button key={iconName} type="button" onClick={() => setFormData({ ...formData, icon: iconName })} className={`aspect-square rounded-xl flex items-center justify-center transition-all ${formData.icon === iconName ? tone.selected : 'text-slate-400 hover:bg-white hover:text-slate-600'}`}><DynamicIcon name={iconName} size={19} /></button>)}</div></div>
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200"><div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${tone.soft}`}><DynamicIcon name={formData.icon} size={21} /></div><div><p className="font-black text-sm">{formData.name || 'Preview kategori'}</p><p className="text-[10px] text-slate-400 mt-1">Preview tampilan</p></div></div>
                <div className="grid grid-cols-2 gap-3 pt-2"><button type="button" onClick={closeModal} className="py-4 rounded-2xl bg-slate-100 text-slate-600 font-black text-sm">Batal</button><button type="submit" disabled={saving} className="py-4 rounded-2xl bg-slate-950 text-white font-black text-sm shadow-lg disabled:opacity-60">{saving ? 'Menyimpan...' : 'Simpan'}</button></div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
