import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, CheckCircle2, CircleDollarSign, Pause, Pencil, Play, Plus, Trash2, WalletCards, X } from 'lucide-react';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { loadAccessibleCategories, rupiah } from '../lib/financeData';

const emptyForm = {
  name: '',
  type: 'expense',
  amount: '',
  category_id: '',
  wallet_id: '',
  day_of_month: '1',
  description: '',
};

const dueDateForMonth = (day, date = new Date()) => {
  const last = endOfMonth(date).getDate();
  return new Date(date.getFullYear(), date.getMonth(), Math.min(Number(day || 1), last));
};

export default function RecurringV32() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [postingId, setPostingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [itemRes, categoryRes, walletRes] = await Promise.all([
      supabase
        .from('recurring_transactions')
        .select('*, categories(name, type), wallets(name)')
        .eq('user_id', user.id)
        .order('day_of_month')
        .order('created_at'),
      loadAccessibleCategories(supabase, user.id),
      supabase.from('wallets').select('id, name').eq('user_id', user.id).order('name'),
    ]);
    const error = itemRes.error || categoryRes.error || walletRes.error;
    if (error) toast.error(error.message || 'Gagal memuat transaksi rutin');
    setItems(itemRes.data || []);
    setCategories(categoryRes.data || []);
    setWallets(walletRes.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const monthKey = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const visibleCategories = useMemo(() => categories.filter((category) => category.type === form.type), [categories, form.type]);
  const active = items.filter((item) => item.is_active);
  const monthlyTotal = active.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expenseTotal = active.filter((item) => item.type === 'expense').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const incomeTotal = active.filter((item) => item.type === 'income').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const postedCount = items.filter((item) => item.last_posted_month === monthKey).length;

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm, wallet_id: wallets[0]?.id || '' });
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      name: item.name || '',
      type: item.type || 'expense',
      amount: String(item.amount || ''),
      category_id: String(item.category_id || ''),
      wallet_id: String(item.wallet_id || ''),
      day_of_month: String(item.day_of_month || 1),
      description: item.description || '',
    });
    setModalOpen(true);
  };

  const close = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const save = async (event) => {
    event.preventDefault();
    const amount = Number(form.amount || 0);
    const day = Number(form.day_of_month || 0);
    if (!form.name.trim()) return toast.error('Nama transaksi rutin wajib diisi');
    if (!Number.isFinite(amount) || amount <= 0) return toast.error('Nominal harus lebih dari 0');
    if (day < 1 || day > 31) return toast.error('Tanggal rutin harus 1–31');
    const category = visibleCategories.find((item) => String(item.id) === String(form.category_id));
    const wallet = wallets.find((item) => String(item.id) === String(form.wallet_id));
    if (!category || !wallet) return toast.error('Kategori atau dompet tidak valid');

    setSaving(true);
    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      type: form.type,
      amount,
      category_id: Number(form.category_id),
      wallet_id: form.wallet_id,
      day_of_month: day,
      description: form.description.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const result = editing
      ? await supabase.from('recurring_transactions').update(payload).eq('id', editing.id).eq('user_id', user.id)
      : await supabase.from('recurring_transactions').insert([payload]);
    setSaving(false);
    if (result.error) return toast.error(result.error.message);
    toast.success(editing ? 'Jadwal rutin diperbarui' : 'Jadwal rutin dibuat');
    close();
    load();
  };

  const toggleActive = async (item) => {
    const { error } = await supabase
      .from('recurring_transactions')
      .update({ is_active: !item.is_active, updated_at: new Date().toISOString() })
      .eq('id', item.id)
      .eq('user_id', user.id);
    if (error) return toast.error(error.message);
    toast.success(item.is_active ? 'Jadwal dijeda' : 'Jadwal diaktifkan');
    load();
  };

  const remove = async (item) => {
    if (!window.confirm(`Hapus jadwal rutin “${item.name}”? Transaksi yang sudah pernah dicatat tidak ikut dihapus.`)) return;
    const { error } = await supabase.from('recurring_transactions').delete().eq('id', item.id).eq('user_id', user.id);
    if (error) return toast.error(error.message);
    toast.success('Jadwal rutin dihapus');
    load();
  };

  const postNow = async (item) => {
    if (item.last_posted_month === monthKey) return toast('Sudah dicatat untuk bulan ini');
    setPostingId(item.id);
    const { error } = await supabase.rpc('post_recurring_transaction', {
      recurring_uuid: item.id,
      post_date: format(new Date(), 'yyyy-MM-dd'),
    });
    setPostingId(null);
    if (error) return toast.error(error.message || 'Gagal mencatat transaksi rutin');
    toast.success(`${item.name} masuk ke transaksi bulan ini`);
    load();
  };

  return (
    <main className="min-h-screen pb-32 md:pb-16 pt-8 md:pt-32 text-slate-900 dark:text-slate-100">
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-8">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] font-medium text-slate-400">Planning / Recurring</p>
            <h1 className="text-[2rem] md:text-[2.7rem] font-semibold tracking-[-0.04em] mt-1">Transaksi rutin</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-2xl">Simpan template gaji atau pengeluaran berulang. Jadwal tidak mengubah cashflow sampai kamu menekan Catat sekarang.</p>
          </div>
          <button onClick={openNew} disabled={!wallets.length} className="liquid-primary text-white inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-medium disabled:opacity-40"><Plus size={17} /> Jadwal baru</button>
        </header>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
          <div className="liquid-nav rounded-[1.8rem] p-5"><p className="text-[10px] uppercase tracking-wide text-slate-400">Aktif</p><p className="text-xl font-semibold mt-2">{active.length}</p></div>
          <div className="liquid-nav rounded-[1.8rem] p-5"><p className="text-[10px] uppercase tracking-wide text-emerald-600">Rutin masuk</p><p className="text-lg font-semibold mt-2 text-emerald-600 dark:text-emerald-300">+{rupiah(incomeTotal)}</p></div>
          <div className="liquid-nav rounded-[1.8rem] p-5"><p className="text-[10px] uppercase tracking-wide text-rose-500">Rutin keluar</p><p className="text-lg font-semibold mt-2 text-rose-500 dark:text-rose-300">-{rupiah(expenseTotal)}</p></div>
          <div className="liquid-nav rounded-[1.8rem] p-5"><p className="text-[10px] uppercase tracking-wide text-indigo-500">Sudah dicatat</p><p className="text-xl font-semibold mt-2">{postedCount}/{items.length}</p><p className="text-[10px] text-slate-400 mt-1">bulan ini · total {rupiah(monthlyTotal)}</p></div>
        </section>

        {!wallets.length && !loading && <div className="liquid-nav rounded-[2rem] p-6 mb-5 text-sm text-slate-500 dark:text-slate-400"><WalletCards size={20} className="mb-3 text-indigo-500" />Buat dompet dulu sebelum membuat transaksi rutin.</div>}

        {loading ? (
          <div className="grid md:grid-cols-2 gap-4">{[1,2].map((item) => <div key={item} className="h-44 liquid-nav rounded-[2rem] animate-pulse" />)}</div>
        ) : !items.length ? (
          <div className="liquid-nav rounded-[2.2rem] py-16 px-6 text-center"><CalendarClock size={30} className="mx-auto text-slate-300 mb-4" /><h2 className="text-xl font-semibold">Belum ada transaksi rutin</h2><p className="text-sm text-slate-500 mt-2 mb-5">Contoh: gaji tanggal 1, internet tanggal 10, atau uang bulanan.</p><button onClick={openNew} className="text-sm font-medium text-indigo-600 dark:text-indigo-300">Buat jadwal pertama →</button></div>
        ) : (
          <section className="grid md:grid-cols-2 gap-4">
            {items.map((item) => {
              const posted = item.last_posted_month === monthKey;
              const due = dueDateForMonth(item.day_of_month);
              const days = Math.ceil((due - new Date()) / 86400000);
              return (
                <motion.article layout key={item.id} className={`liquid-nav rounded-[2rem] p-5 md:p-6 ${!item.is_active ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0"><div className="flex items-center gap-2 flex-wrap"><h3 className="text-lg font-semibold truncate">{item.name}</h3>{posted && <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-300"><CheckCircle2 size={13} /> Dicatat</span>}</div><p className="text-xs text-slate-400 mt-1">Setiap tanggal {item.day_of_month} · {item.wallets?.name || 'Dompet'} · {item.categories?.name || 'Kategori'}</p></div>
                    <div className="flex gap-1"><button onClick={() => openEdit(item)} className="w-9 h-9 rounded-xl bg-white/45 dark:bg-white/[.05] flex items-center justify-center text-slate-500"><Pencil size={15} /></button><button onClick={() => toggleActive(item)} className="w-9 h-9 rounded-xl bg-white/45 dark:bg-white/[.05] flex items-center justify-center text-slate-500">{item.is_active ? <Pause size={15} /> : <Play size={15} />}</button><button onClick={() => remove(item)} className="w-9 h-9 rounded-xl bg-rose-500/[.08] flex items-center justify-center text-rose-500"><Trash2 size={15} /></button></div>
                  </div>
                  <div className="mt-6 flex items-end justify-between gap-4"><div><p className="text-[10px] uppercase tracking-wide text-slate-400">Nominal</p><p className={`text-2xl font-semibold mt-1 ${item.type === 'income' ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-500 dark:text-rose-300'}`}>{item.type === 'income' ? '+' : '-'}{rupiah(item.amount)}</p></div><p className="text-xs text-slate-400">{days === 0 ? 'Jadwal hari ini' : days > 0 ? `${days} hari lagi` : `Lewat ${Math.abs(days)} hari`}</p></div>
                  <button disabled={posted || postingId === item.id || !item.is_active} onClick={() => postNow(item)} className="mt-5 w-full h-11 rounded-2xl liquid-primary text-white text-sm font-medium disabled:opacity-35 inline-flex items-center justify-center gap-2"><CircleDollarSign size={15} />{postingId === item.id ? 'Mencatat…' : posted ? 'Sudah dicatat bulan ini' : 'Catat sekarang'}</button>
                </motion.article>
              );
            })}
          </section>
        )}
      </div>

      <AnimatePresence>{modalOpen && <div className="fixed inset-0 z-[110] bg-slate-950/40 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"><motion.div initial={{ opacity:0,y:24 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:24 }} className="liquid-nav w-full max-w-lg rounded-t-[2rem] sm:rounded-[2rem] p-6 md:p-7 max-h-[92vh] overflow-y-auto"><div className="flex items-center justify-between mb-6"><div><p className="text-[10px] uppercase tracking-wide text-slate-400">Recurring</p><h3 className="text-xl font-semibold mt-1">{editing ? 'Edit jadwal' : 'Jadwal baru'}</h3></div><button onClick={close} className="w-9 h-9 rounded-full bg-white/45 dark:bg-white/[.05] flex items-center justify-center"><X size={17} /></button></div><form onSubmit={save} className="space-y-4"><label className="block"><span className="text-[10px] uppercase tracking-wide text-slate-400">Nama</span><input autoFocus required value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} placeholder="Gaji, internet, uang bulanan..." className="w-full mt-2 rounded-2xl px-4 py-4 font-medium outline-none" /></label><div className="grid grid-cols-2 gap-3"><button type="button" onClick={()=>setForm({...form,type:'expense',category_id:''})} className={`h-11 rounded-2xl text-sm font-medium ${form.type==='expense'?'bg-rose-500 text-white':'bg-white/45 dark:bg-white/[.05]'}`}>Pengeluaran</button><button type="button" onClick={()=>setForm({...form,type:'income',category_id:''})} className={`h-11 rounded-2xl text-sm font-medium ${form.type==='income'?'bg-emerald-500 text-white':'bg-white/45 dark:bg-white/[.05]'}`}>Pemasukan</button></div><div className="grid sm:grid-cols-2 gap-4"><label><span className="text-[10px] uppercase tracking-wide text-slate-400">Nominal</span><input required min="1" type="number" value={form.amount} onChange={(e)=>setForm({...form,amount:e.target.value})} className="w-full mt-2 rounded-2xl px-4 py-4 font-medium outline-none" /></label><label><span className="text-[10px] uppercase tracking-wide text-slate-400">Tanggal tiap bulan</span><input required min="1" max="31" type="number" value={form.day_of_month} onChange={(e)=>setForm({...form,day_of_month:e.target.value})} className="w-full mt-2 rounded-2xl px-4 py-4 font-medium outline-none" /></label></div><label className="block"><span className="text-[10px] uppercase tracking-wide text-slate-400">Kategori</span><select required value={form.category_id} onChange={(e)=>setForm({...form,category_id:e.target.value})} className="w-full mt-2 rounded-2xl px-4 py-4 font-medium outline-none"><option value="">Pilih kategori</option>{visibleCategories.map((category)=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="block"><span className="text-[10px] uppercase tracking-wide text-slate-400">Dompet</span><select required value={form.wallet_id} onChange={(e)=>setForm({...form,wallet_id:e.target.value})} className="w-full mt-2 rounded-2xl px-4 py-4 font-medium outline-none"><option value="">Pilih dompet</option>{wallets.map((wallet)=><option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}</select></label><label className="block"><span className="text-[10px] uppercase tracking-wide text-slate-400">Catatan opsional</span><textarea rows={2} value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})} className="w-full mt-2 rounded-2xl px-4 py-4 font-medium outline-none resize-none" /></label><div className="grid grid-cols-2 gap-3 pt-1"><button type="button" onClick={close} className="h-12 rounded-2xl bg-white/45 dark:bg-white/[.05] text-sm font-medium">Batal</button><button disabled={saving} className="h-12 rounded-2xl liquid-primary text-white text-sm font-medium disabled:opacity-50">{saving?'Menyimpan…':'Simpan'}</button></div></form></motion.div></div>}</AnimatePresence>
    </main>
  );
}
