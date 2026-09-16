import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Pencil, Plus, Target, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { currentMonthRange, loadAccessibleCategories, rupiah } from '../lib/financeData';

export default function BudgetingV3() {
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
    if (!categories.some((item) => String(item.id) === String(form.category_id))) return toast.error('Kategori tidak valid');
    if (budgets.some((item) => item.id !== editing?.id && String(item.category_id) === String(form.category_id))) return toast.error('Kategori ini sudah punya budget');

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
    <main className="min-h-screen pb-32 md:pb-16 pt-8 md:pt-32 text-slate-900 dark:text-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-8">
          <div className="max-w-2xl">
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400 mb-2">Planning / Budget</p>
            <h1 className="text-[2rem] md:text-[2.7rem] font-semibold tracking-[-0.04em] leading-tight">Budget bulanan</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">Atur batas pengeluaran per kategori tanpa membuat halaman terasa penuh.</p>
          </div>
          <button onClick={openNew} className="liquid-primary text-white inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-medium"><Plus size={17} /> Budget baru</button>
        </header>

        <section className="grid lg:grid-cols-[1.25fr_.75fr] gap-5 mb-6">
          <div className="liquid-nav rounded-[2.3rem] p-6 md:p-8 relative overflow-hidden">
            <div className="absolute -right-20 -top-20 w-60 h-60 rounded-full bg-indigo-400/15 blur-3xl" />
            <div className="relative">
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">Alokasi bulan ini</p>
              <p className="text-3xl md:text-5xl font-semibold tracking-[-0.045em] mt-2">{loading ? '…' : rupiah(totalBudget)}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Dari pemasukan {rupiah(income)}</p>
              <div className="mt-7 h-2 rounded-full bg-slate-200/60 dark:bg-white/10 overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${allocationPercent}%` }} className="h-full rounded-full bg-indigo-500" /></div>
              <div className="mt-3 flex flex-wrap justify-between gap-2 text-[10px] font-medium uppercase tracking-wider text-slate-400"><span>{Math.round(allocationPercent)}% dialokasikan</span><span>Sisa {rupiah(Math.max(remainingAllocation, 0))}</span></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="liquid-nav rounded-[1.8rem] p-5"><p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Terpakai</p><p className="text-xl font-semibold mt-2">{rupiah(totalSpent)}</p></div>
            <div className="liquid-nav rounded-[1.8rem] p-5"><p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Aktif</p><p className="text-xl font-semibold mt-2">{budgets.length}</p></div>
            <div className="col-span-2 liquid-nav rounded-[1.8rem] p-5 flex gap-3"><AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" /><div><p className="text-sm font-medium">Salary guard</p><p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">Saat ada pemasukan bulan ini, total alokasi tidak boleh melampauinya.</p></div></div>
          </div>
        </section>

        {loading ? (
          <div className="grid md:grid-cols-2 gap-4">{[1, 2].map((item) => <div key={item} className="h-48 liquid-nav rounded-[2rem] animate-pulse" />)}</div>
        ) : !processed.length ? (
          <div className="liquid-nav rounded-[2.2rem] p-14 text-center"><Target size={30} className="mx-auto text-slate-300 mb-4" /><h2 className="text-xl font-semibold">Belum ada budget</h2><p className="text-sm text-slate-500 mt-2 mb-5">Mulai dari kategori pengeluaran yang paling sering muncul.</p><button onClick={openNew} className="text-sm font-medium text-indigo-600 dark:text-indigo-300">Buat budget pertama →</button></div>
        ) : (
          <section className="grid md:grid-cols-2 gap-4">
            {processed.map((budget) => {
              const over = budget.percent > 100;
              const remaining = Number(budget.amount || 0) - budget.spent;
              return (
                <article key={budget.id} className="liquid-nav rounded-[2rem] p-5 md:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div><h3 className="font-semibold text-lg">{budget.categories?.name || 'Kategori'}</h3><p className={`text-xs mt-1 ${over ? 'text-rose-500' : 'text-slate-400'}`}>{over ? `Melebihi ${rupiah(Math.abs(remaining))}` : `Sisa ${rupiah(Math.max(remaining, 0))}`}</p></div>
                    <div className="flex gap-2"><button onClick={() => openEdit(budget)} className="w-9 h-9 rounded-xl bg-white/45 dark:bg-white/[.05] text-slate-500 flex items-center justify-center"><Pencil size={15} /></button><button onClick={() => remove(budget)} className="w-9 h-9 rounded-xl bg-rose-500/[.08] text-rose-500 flex items-center justify-center"><Trash2 size={15} /></button></div>
                  </div>
                  <div className="mt-6 flex items-end justify-between gap-4"><div><p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Terpakai</p><p className="text-xl font-semibold mt-1">{rupiah(budget.spent)}</p></div><p className="text-sm text-slate-400">/ {rupiah(budget.amount)}</p></div>
                  <div className="mt-3 h-2 rounded-full bg-slate-200/60 dark:bg-white/10 overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(budget.percent, 100)}%` }} className={`h-full rounded-full ${over ? 'bg-rose-500' : budget.percent >= 80 ? 'bg-amber-500' : 'bg-indigo-500'}`} /></div>
                  <p className="mt-2 text-right text-[11px] text-slate-400">{Math.round(budget.percent)}%</p>
                </article>
              );
            })}
          </section>
        )}
      </div>

      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-[100] bg-slate-950/40 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} className="liquid-nav w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 md:p-7">
              <div className="flex items-center justify-between mb-6"><div><p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">Budget</p><h3 className="text-xl font-semibold mt-1">{editing ? 'Edit alokasi' : 'Alokasi baru'}</h3></div><button onClick={close} className="w-9 h-9 rounded-full bg-white/45 dark:bg-white/[.05] flex items-center justify-center"><X size={17} /></button></div>
              <form onSubmit={save} className="space-y-5">
                <label className="block"><span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Kategori</span><select required value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="w-full mt-2 rounded-2xl px-4 py-4 font-medium outline-none"><option value="">Pilih kategori</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                <label className="block"><span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Nominal budget</span><input required min="1" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" className="w-full mt-2 rounded-2xl px-4 py-4 font-semibold text-xl outline-none" /></label>
                <div className="grid grid-cols-2 gap-3"><button type="button" onClick={close} className="h-12 rounded-2xl bg-white/45 dark:bg-white/[.05] font-medium text-sm">Batal</button><button disabled={saving} type="submit" className="h-12 rounded-2xl liquid-primary text-white font-medium text-sm disabled:opacity-60">{saving ? 'Menyimpan…' : 'Simpan'}</button></div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
