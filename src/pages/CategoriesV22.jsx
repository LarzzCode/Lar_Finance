import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import * as icons from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { isSystemCategory, loadAccessibleCategories } from '../lib/financeData';

const AVAILABLE_ICONS = ['Utensils','HeartPulse','GraduationCap','Wifi','Users','HeartHandshake','ShoppingCart','Sparkles','Car','LayoutGrid','Briefcase','Gift','Wallet','Coffee','Dumbbell','Gamepad2','Home','Music','Plane','Smartphone','Scissors','Baby'];
const DynamicIcon = ({ name, size = 20 }) => { const Icon = icons[name] || icons.HelpCircle; return <Icon size={size} />; };

export default function CategoriesV22() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('expense');
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', icon: 'LayoutGrid' });

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const result = await loadAccessibleCategories(supabase, user.id, activeTab);
    if (result.error) toast.error(result.error.message);
    setCategories(result.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user, activeTab]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return categories.filter((category) => !term || (category.name || '').toLowerCase().includes(term));
  }, [categories, query]);

  const systemCount = categories.filter(isSystemCategory).length;
  const ownCount = categories.length - systemCount;

  const openCreate = () => { setEditData(null); setForm({ name: '', icon: 'LayoutGrid' }); setModalOpen(true); };
  const openEdit = (category) => { if (isSystemCategory(category)) return; setEditData(category); setForm({ name: category.name || '', icon: category.icon || 'LayoutGrid' }); setModalOpen(true); };
  const close = () => { setModalOpen(false); setEditData(null); setForm({ name: '', icon: 'LayoutGrid' }); };

  const save = async (event) => {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) return toast.error('Nama kategori wajib diisi');
    if (name.length > 50) return toast.error('Nama maksimal 50 karakter');
    const duplicate = categories.some((category) => !isSystemCategory(category) && category.id !== editData?.id && (category.name || '').trim().toLowerCase() === name.toLowerCase());
    if (duplicate) return toast.error('Kategori pribadi dengan nama tersebut sudah ada');

    setSaving(true);
    const result = editData
      ? await supabase.from('categories').update({ name, icon: form.icon }).eq('id', editData.id).eq('user_id', user.id)
      : await supabase.from('categories').insert([{ user_id: user.id, name, icon: form.icon, type: activeTab }]);
    setSaving(false);
    if (result.error) return toast.error(result.error.message);
    toast.success(editData ? 'Kategori diperbarui' : 'Kategori ditambahkan');
    close();
    load();
  };

  const remove = async (category) => {
    if (isSystemCategory(category)) return toast.error('Kategori bawaan tidak bisa dihapus');
    const [txRes, budgetRes, subRes] = await Promise.all([
      supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('category_id', category.id),
      supabase.from('budgets').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('category_id', category.id),
      supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('category_id', category.id),
    ]);
    const error = txRes.error || budgetRes.error || subRes.error;
    if (error) return toast.error(error.message);
    const references = (txRes.count || 0) + (budgetRes.count || 0) + (subRes.count || 0);
    if (references > 0) return toast.error(`Kategori masih dipakai ${references} data. Edit namanya jika perlu.`);
    if (!window.confirm(`Hapus kategori "${category.name}"?`)) return;
    const { error: deleteError } = await supabase.from('categories').delete().eq('id', category.id).eq('user_id', user.id);
    if (deleteError) return toast.error(deleteError.message);
    toast.success('Kategori dihapus');
    load();
  };

  const tone = activeTab === 'expense' ? 'rose' : 'emerald';

  return (
    <main className="min-h-screen bg-[#F6F7F9] pb-32 md:pb-16 md:pt-28 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 md:pt-6">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mb-7"><div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 mb-1">Master data</p><h1 className="text-3xl md:text-4xl font-black tracking-tight">Kategori transaksi.</h1><p className="text-sm text-slate-500 mt-2">Kategori bawaan dipakai bersama sebagai referensi aman; kategori pribadi hanya milik akunmu.</p></div><button onClick={openCreate} className="inline-flex items-center justify-center gap-2 bg-slate-950 text-white rounded-2xl px-5 py-3.5 text-xs font-black"><icons.Plus size={16} /> Kategori pribadi baru</button></header>

        <section className="bg-white border border-slate-200 rounded-[2rem] p-4 md:p-5 shadow-sm mb-6"><div className="flex flex-col md:flex-row gap-4 md:items-center"><div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl md:w-80">{[['expense','Pengeluaran',icons.ArrowUpRight],['income','Pemasukan',icons.ArrowDownLeft]].map(([key,label,Icon]) => <button key={key} onClick={() => setActiveTab(key)} className={`py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 ${activeTab === key ? key === 'expense' ? 'bg-white text-rose-500 shadow-sm' : 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}><Icon size={15} /> {label}</button>)}</div><label className="relative flex-1"><icons.Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari kategori..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-bold outline-none focus:ring-4 focus:ring-slate-100" /></label><div className="text-xs font-bold text-slate-400 whitespace-nowrap">{systemCount} bawaan · {ownCount} pribadi</div></div></section>

        {loading ? <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">{[1,2,3,4].map((item) => <div key={item} className="h-36 rounded-[1.75rem] bg-slate-200 animate-pulse" />)}</div> : !filtered.length ? <div className="bg-white border border-dashed border-slate-300 rounded-[2rem] py-16 text-center"><icons.Tags size={26} className="mx-auto text-slate-300 mb-3" /><p className="font-black">Kategori tidak ditemukan.</p></div> : <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">{filtered.map((category, index) => { const system = isSystemCategory(category); return <motion.article key={category.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.02 }} className="bg-white border border-slate-200 rounded-[1.75rem] p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${activeTab === 'expense' ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-600'}`}><DynamicIcon name={category.icon} size={22} /></div>{system ? <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 rounded-full px-2 py-1"><icons.LockKeyhole size={10} /> Bawaan</span> : <div className="flex gap-1"><button onClick={() => openEdit(category)} className="w-8 h-8 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center"><icons.Pencil size={14} /></button><button onClick={() => remove(category)} className="w-8 h-8 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center"><icons.Trash2 size={14} /></button></div>}</div><p className="font-black text-sm mt-5 truncate">{category.name}</p><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">{system ? 'Kategori sistem' : 'Kategori pribadi'}</p></motion.article>; })}</section>}
      </div>

      <AnimatePresence>{modalOpen && <div className="fixed inset-0 z-[90] bg-slate-950/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"><motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} className="bg-white w-full max-w-lg rounded-t-[2rem] sm:rounded-[2rem] p-6 md:p-7 shadow-2xl"><div className="flex items-center justify-between mb-6"><div><p className="text-lg font-black">{editData ? 'Edit kategori pribadi' : 'Kategori pribadi baru'}</p><p className="text-xs text-slate-400 mt-1">Kategori bawaan tidak akan berubah.</p></div><button onClick={close} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"><icons.X size={17} /></button></div><form onSubmit={save} className="space-y-5"><label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nama kategori</span><input autoFocus required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 font-bold outline-none focus:ring-4 focus:ring-slate-100" /></label><div><span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">Ikon</span><div className="grid grid-cols-6 sm:grid-cols-8 gap-2 bg-slate-50 rounded-2xl p-3 max-h-52 overflow-auto">{AVAILABLE_ICONS.map((iconName) => <button key={iconName} type="button" onClick={() => setForm({ ...form, icon: iconName })} className={`aspect-square rounded-xl flex items-center justify-center ${form.icon === iconName ? tone === 'rose' ? 'bg-rose-50 text-rose-600 ring-2 ring-rose-100' : 'bg-emerald-50 text-emerald-600 ring-2 ring-emerald-100' : 'text-slate-400 hover:bg-white'}`}><DynamicIcon name={iconName} size={19} /></button>)}</div></div><div className="grid grid-cols-2 gap-3"><button type="button" onClick={close} className="h-12 rounded-2xl bg-slate-100 font-black text-sm">Batal</button><button disabled={saving} type="submit" className="h-12 rounded-2xl bg-slate-950 text-white font-black text-sm disabled:opacity-60">{saving ? 'Menyimpan...' : 'Simpan'}</button></div></form></motion.div></div>}</AnimatePresence>
    </main>
  );
}
