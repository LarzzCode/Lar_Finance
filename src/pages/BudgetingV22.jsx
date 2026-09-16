import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Pencil, Plus, Target, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { currentMonthRange, loadAccessibleCategories, rupiah, isSystemCategory } from '../lib/financeData';

export default function BudgetingV22() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ category_id: '', amount: '' });

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { start, end } = currentMonthRange();
    const [budgetRes, categoryRes, txRes] = await Promise.all([
      supabase.from('budgets').select('*, categories(name, type, user_id)').eq('user_id', user.id).order('amount', { ascending: false }),
      loadAccessibleCategories(supabase, user.id, 'expense'),
      supabase.from('transactions').select('amount, category_id, categories(type)').eq('user_id', user.id).gte('transaction_date', start).lte('transaction_date', end),
    ]);
    const error = budgetRes.error || categoryRes.error || txRes.error;
    if (error) toast.error(error.message || 'Gagal memuat budget');
    setBudgets(budgetRes.data || []);
    setCategories(categoryRes.data || []);
    setTransactions(txRes.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const income = useMemo(() => transactions.filter((tx) => tx.categories?.type === 'income').reduce((sum, tx) => sum + Number(tx.amount || 0), 0), [transactions]);
  const processed = useMemo(() => budgets.map((budget) => {
    const spent = transactions.filter((tx) => tx.categories?.type === 'expense' && String(tx.category_id) === String(budget.category_id)).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const amount = Number(budget.amount || 0);
    return { ...budget, spent, percent: amount > 0 ? (spent / amount) * 100 : 0 };
  }), [budgets, transactions]);

  const totalBudget = processed.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalSpent = processed.reduce((sum, item) => sum + Number(item.spent || 0), 0);
  const remainingAllocation = income - totalBudget;
  const allocationPercent = income > 0 ? Math.min((totalBudget / income) * 100, 100) : 0;

  const openNew = () => { setEditing(null); setForm({ category_id: '', amount: '' }); setModalOpen(true); };
  const openEdit = (budget) => { setEditing(budget); setForm({ category_id: String(budget.category_id || ''), amount: String(budget.amount || '') }); setModalOpen(true); };
  const close = () => { setModalOpen(false); setEditing(null); setForm({ category_id: '', amount: '' }); };

  const save = async (event) => {
    event.preventDefault();
    const amount = Number(form.amount || 0);
    if (!form.category_id) return toast.error('Pilih kategori');
    if (!Number.isFinite(amount) || amount <= 0) return toast.error('Budget harus lebih dari 0');
    const category = categories.find((item) => String(item.id) === String(form.category_id));
    if (!category) return toast.error('Kategori tidak valid');

    const duplicate = budgets.some((item) => item.id !== editing?.id && String(item.category_id) === String(form.category_id));
    if (duplicate) return toast.error('Kategori ini sudah punya budget');

    const otherBudget = budgets.filter((item) => item.id !== editing?.id).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    if (income > 0 && otherBudget + amount > income) return toast.error('Total budget tidak boleh melebihi pemasukan bulan ini');

    setSaving(true);
    const payload = { user_id: user.id, category_id: Number(form.category_id), amount };
    const result = editing
      ? await supabase.from('budgets').update(payload).eq('id', editing.id).eq('user_id', user.id)
      : await supabase.from('budgets').insert([payload]);
    setSaving(false);
    if (result.error) return toast.error(result.error.message);
    toast.success(editing ? 'Budget diperbarui' : 'Budget dibuat');
    close();
    load();
  };

  const remove = async (budget) => {
    if (!window.confirm(`Hapus budget ${budget.categories?.name || ''}?`)) return;
    const { error } = await supabase.from('budgets').delete().eq('id', budget.id).eq('user_id', user.id);
    if (error) return toast.error(error.message);
    toast.success('Budget dihapus');
    load();
  };

  return (
    <main className="min-h-screen bg-[#F7F8FA] text-slate-900 pb-28 md:pb-16 pt-8 md:pt-32">
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-7"><div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 mb-1">Planning / Budget</p><h1 className="text-3xl md:text-4xl font-black tracking-tight">Budget bulanan.</h1><p className="text-sm text-slate-500 mt-2">Kategori bawaan dan kategori pribadi sama-sama bisa dipakai untuk perencanaan.</p></div><button onClick={openNew} className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-slate-950 text-white text-sm font-black"><Plus size={17} /> Budget baru</button></header>

        <section className="grid lg:grid-cols-[1.15fr_0.85fr] gap-4 mb-6">
          <div className="rounded-[2rem] bg-slate-950 text-white p-6 md:p-8 relative overflow-hidden"><div className="absolute -right-16 -top-20 w-56 h-56 bg-indigo-500/20 rounded-full blur-3xl" /><div className="relative"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Alokasi bulan ini</p><p className="text-3xl md:text-5xl font-black mt-2">{loading ? '…' : rupiah(totalBudget)}</p><p className="text-sm text-slate-400 mt-2">dari pemasukan {rupiah(income)}</p><div className="mt-6 h-3 rounded-full bg-white/10 overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${allocationPercent}%` }} className="h-full rounded-full bg-indigo-400" /></div><div className="mt-2 flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-500"><span>{Math.round(allocationPercent)}% dialokasikan</span><span>Sisa {rupiah(Math.max(remainingAllocation, 0))}</span></div></div></div>
          <div className="grid grid-cols-2 gap-4"><div className="bg-white border border-slate-200 rounded-[2rem] p-5"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Terpakai</p><p className="text-xl font-black mt-2">{rupiah(totalSpent)}</p></div><div className="bg-white border border-slate-200 rounded-[2rem] p-5"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Budget aktif</p><p className="text-xl font-black mt-2">{budgets.length}</p></div><div className="col-span-2 rounded-[2rem] bg-amber-50 border border-amber-100 p-5 flex gap-3"><AlertTriangle size={19} className="text-amber-600 shrink-0" /><div><p className="text-sm font-black text-amber-800">Salary guard</p><p className="text-xs text-amber-700/80 mt-1">Jika ada pemasukan bulan ini, total alokasi tidak boleh melebihinya.</p></div></div></div>
        </section>

        {loading ? <div className="grid md:grid-cols-2 gap-4">{[1,2].map((item) => <div key={item} className="h-48 rounded-[2rem] bg-slate-200 animate-pulse" />)}</div> : !processed.length ? <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2rem] p-14 text-center"><Target size={30} className="mx-auto text-slate-300 mb-4" /><h2 className="text-xl font-black">Belum ada budget.</h2><p className="text-sm text-slate-500 mt-2 mb-5">Mulai dari kategori yang paling sering menghabiskan uang.</p><button onClick={openNew} className="text-sm font-black text-indigo-600">Buat budget pertama →</button></div> : <section className="grid md:grid-cols-2 gap-4">{processed.map((budget) => { const over = budget.percent > 100; const remaining = Number(budget.amount || 0) - budget.spent; return <article key={budget.id} className="bg-white border border-slate-200 rounded-[2rem] p-5 md:p-6 shadow-sm"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><h3 className="font-black text-lg">{budget.categories?.name || 'Kategori'}</h3>{budget.categories?.user_id == null && <span className="text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 rounded-full px-2 py-1">Bawaan</span>}</div><p className="text-xs text-slate-400 mt-1">{over ? `Melebihi ${rupiah(Math.abs(remaining))}` : `Sisa ${rupiah(Math.max(remaining, 0))}`}</p></div><div className="flex gap-2"><button onClick={() => openEdit(budget)} className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center"><Pencil size={15} /></button><button onClick={() => remove(budget)} className="w-9 h-9 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center"><Trash2 size={15} /></button></div></div><div className="mt-6 flex items-end justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Terpakai</p><p className="text-xl font-black mt-1">{rupiah(budget.spent)}</p></div><p className="text-sm font-black text-slate-400">/ {rupiah(budget.amount)}</p></div><div className="mt-3 h-2.5 rounded-full bg-slate-100 overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(budget.percent, 100)}%` }} className={`h-full rounded-full ${over ? 'bg-rose-500' : budget.percent >= 80 ? 'bg-amber-500' : 'bg-indigo-500'}`} /></div><div className="mt-2 text-right text-[11px] font-black text-slate-400">{Math.round(budget.percent)}%</div></article>; })}</section>}
      </div>

      <AnimatePresence>{modalOpen && <div className="fixed inset-0 z-[90] bg-slate-950/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"><motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} className="bg-white w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 md:p-7 shadow-2xl"><div className="flex items-center justify-between mb-6"><div><p className="text-lg font-black">{editing ? 'Edit budget' : 'Budget baru'}</p><p className="text-xs text-slate-400 mt-1">Pilih kategori pengeluaran yang ingin dikontrol.</p></div><button onClick={close} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"><X size={17} /></button></div><form onSubmit={save} className="space-y-5"><label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Kategori</span><select required value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 font-bold outline-none"><option value="">Pilih kategori</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}{isSystemCategory(category) ? ' · Bawaan' : ''}</option>)}</select></label><label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nominal budget</span><input required min="1" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 font-black text-xl outline-none" /></label><div className="grid grid-cols-2 gap-3"><button type="button" onClick={close} className="h-12 rounded-2xl bg-slate-100 font-black text-sm">Batal</button><button disabled={saving} type="submit" className="h-12 rounded-2xl bg-slate-950 text-white font-black text-sm disabled:opacity-60">{saving ? 'Menyimpan...' : 'Simpan'}</button></div></form></motion.div></div>}</AnimatePresence>
    </main>
  );
}
