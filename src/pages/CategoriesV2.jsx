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

const DynamicIcon = ({ name, size = 20, className = '' }) => {
  const Icon = icons[name] || icons.HelpCircle;
  return <Icon size={size} className={className} />;
};

export default function CategoriesV2() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('expense');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [query, setQuery] = useState('');
  const [formData, setFormData] = useState({ name: '', icon: 'LayoutGrid' });

  useEffect(() => {
    if (user) fetchCategories();
  }, [user, activeTab]);

  const fetchCategories = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('type', activeTab)
      .order('name');

    if (error) toast.error('Gagal memuat kategori');
    setCategories(data || []);
    setLoading(false);
  };

  const filteredCategories = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return categories;
    return categories.filter((category) => category.name.toLowerCase().includes(search));
  }, [categories, query]);

  const openCreate = () => {
    setEditData(null);
    setFormData({ name: '', icon: 'LayoutGrid' });
    setIsModalOpen(true);
  };

  const openEdit = (category) => {
    setEditData(category);
    setFormData({ name: category.name, icon: category.icon || 'LayoutGrid' });
    setIsModalOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      if (editData) {
        const { error } = await supabase
          .from('categories')
          .update({ name: formData.name.trim(), icon: formData.icon })
          .eq('id', editData.id);
        if (error) throw error;
        toast.success('Kategori diperbarui');
      } else {
        const { error } = await supabase.from('categories').insert([
          {
            name: formData.name.trim(),
            type: activeTab,
            user_id: user.id,
            icon: formData.icon,
          },
        ]);
        if (error) throw error;
        toast.success('Kategori ditambahkan');
      }

      setIsModalOpen(false);
      setEditData(null);
      setFormData({ name: '', icon: 'LayoutGrid' });
      fetchCategories();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (category) => {
    if (!window.confirm(`Hapus kategori "${category.name}"?`)) return;

    const { error } = await supabase.from('categories').delete().eq('id', category.id);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success('Kategori dihapus');
    fetchCategories();
  };

  const tone = activeTab === 'expense'
    ? {
        accent: 'text-rose-500',
        soft: 'bg-rose-50 text-rose-500',
        selected: 'bg-rose-50 border-rose-200 ring-2 ring-rose-100',
      }
    : {
        accent: 'text-emerald-600',
        soft: 'bg-emerald-50 text-emerald-600',
        selected: 'bg-emerald-50 border-emerald-200 ring-2 ring-emerald-100',
      };

  return (
    <main className="min-h-screen bg-[#F6F7F9] pb-32 md:pb-16 md:pt-28 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 md:pt-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mb-7">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 mb-1">Master data</p>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">Kategori transaksi.</h1>
            <p className="text-sm text-slate-500 mt-2">Atur kategori pemasukan dan pengeluaran beserta ikon yang dipakai di seluruh Lar Finance.</p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 bg-slate-950 hover:bg-black text-white rounded-2xl px-5 py-3.5 text-xs font-black shadow-lg shadow-slate-300"
          >
            <icons.Plus size={16} /> Kategori baru
          </button>
        </div>

        <section className="bg-white border border-slate-200/70 rounded-[2rem] p-4 md:p-5 shadow-sm mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl md:w-80">
              {[
                { key: 'expense', label: 'Pengeluaran', icon: icons.ArrowUpRight },
                { key: 'income', label: 'Pemasukan', icon: icons.ArrowDownLeft },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${
                    activeTab === key
                      ? key === 'expense'
                        ? 'bg-white text-rose-500 shadow-sm'
                        : 'bg-white text-emerald-600 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Icon size={15} /> {label}
                </button>
              ))}
            </div>

            <label className="relative flex-1">
              <icons.Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari kategori..."
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-bold outline-none focus:bg-white focus:ring-4 focus:ring-slate-100"
              />
            </label>

            <div className="text-xs font-bold text-slate-400 md:px-3">
              {filteredCategories.length} kategori
            </div>
          </div>
        </section>

        {loading ? (
          <div className="py-20 text-center text-xs font-black uppercase tracking-widest text-slate-400">Memuat kategori...</div>
        ) : filteredCategories.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-[2rem] py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-4">
              <icons.Tags size={24} />
            </div>
            <p className="font-black">Kategori tidak ditemukan.</p>
            <p className="text-sm text-slate-400 mt-1">Coba kata pencarian lain atau buat kategori baru.</p>
          </div>
        ) : (
          <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredCategories.map((category, index) => (
              <motion.article
                key={category.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.025 }}
                className="bg-white border border-slate-200/70 rounded-[1.75rem] p-5 shadow-sm group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${tone.soft}`}>
                    <DynamicIcon name={category.icon} size={22} />
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(category)}
                      aria-label={`Edit ${category.name}`}
                      className="w-8 h-8 rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100 flex items-center justify-center"
                    >
                      <icons.Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(category)}
                      aria-label={`Hapus ${category.name}`}
                      className="w-8 h-8 rounded-xl bg-rose-50 text-rose-400 hover:text-rose-600 flex items-center justify-center"
                    >
                      <icons.Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <p className="font-black text-sm mt-5 truncate" title={category.name}>{category.name}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">
                  {activeTab === 'expense' ? 'Pengeluaran' : 'Pemasukan'}
                </p>
              </motion.article>
            ))}
          </section>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[90] bg-slate-950/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 32, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 32, scale: 0.98 }}
              className="bg-white w-full max-w-lg rounded-t-[2rem] sm:rounded-[2rem] p-6 md:p-7 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-lg font-black">{editData ? 'Edit kategori' : 'Kategori baru'}</p>
                  <p className="text-xs text-slate-400 mt-1">{activeTab === 'expense' ? 'Pengeluaran' : 'Pemasukan'}</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
                  <icons.X size={17} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nama kategori</span>
                  <input
                    autoFocus
                    required
                    value={formData.name}
                    onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                    placeholder="Contoh: Food & Drink"
                    className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 font-bold outline-none focus:bg-white focus:ring-4 focus:ring-slate-100"
                  />
                </label>

                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">Pilih ikon</span>
                  <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-3 max-h-52 overflow-y-auto">
                    {AVAILABLE_ICONS.map((iconName) => (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => setFormData({ ...formData, icon: iconName })}
                        className={`aspect-square rounded-xl flex items-center justify-center transition-all ${
                          formData.icon === iconName ? tone.selected : 'text-slate-400 hover:bg-white hover:text-slate-600'
                        }`}
                      >
                        <DynamicIcon name={iconName} size={19} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${tone.soft}`}>
                    <DynamicIcon name={formData.icon} size={21} />
                  </div>
                  <div>
                    <p className="font-black text-sm">{formData.name || 'Preview kategori'}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Preview tampilan</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="py-4 rounded-2xl bg-slate-100 text-slate-600 font-black text-sm">Batal</button>
                  <button type="submit" className="py-4 rounded-2xl bg-slate-950 text-white font-black text-sm shadow-lg">Simpan</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
