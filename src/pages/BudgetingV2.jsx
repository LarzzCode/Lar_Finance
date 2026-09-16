import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Pencil, Plus, Target, Trash2, WalletCards, X } from 'lucide-react';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const rupiah = (value) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

export default function BudgetingV2() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [income, setIncome] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [form, setForm] = useState({ category_id: '', amount: '' });

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    const start = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const end = format(endOfMonth(new Date()), 'yyyy-MM-dd');

    const [budgetRes, categoryRes, txRes] = await Promise.all([
      supabase
        .from('budgets')
        .select('*, categories(name, type)')
        .eq('user_id', user.id)
        .order('amount', { ascending: false }),
      supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .order('name'),
      supabase
        .from('transactions')
        .select('amount, category_id, categories(type)')
        .eq('user_id', user.id)
        .gte('transaction_date', start)
        .lte('transaction_date', end),
    ]);

    const txData = txRes.data || [];
    const totalIncome = txData
      .filter((tx) => tx.categories?.type === 'income')
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

    setIncome(totalIncome);
    setBudgets(budgetRes.data || []);
    setCategories(categoryRes.data || []);
    setTransactions(txData);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const processed = useMemo(() => {
    return budgets.map((budget) => {
      const spent = transactions
        .filter((tx) => tx.categories?.type === 'expense' && String(tx.category_id) === String(budget.category_id))
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      const amount = Number(budget.amount || 0);
      const percent = amount > 0 ? (spent / amount) * 100 : 0;
      return { ...budget, spent, percent };
    });
  }, [budgets, transactions]);

  const totalBudget = processed.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalSpent = processed.reduce((sum, item) => sum + Number(item.spent || 0), 0);
  const unallocated = income - totalBudget;
  const allocationPercent = income > 0 ? Math.min((totalBudget / income) * 100, 100) : 0;

  const openNew = () => {
    setEditingBudget(null);
    setForm({ category_id: '', amount: '' });
    setModalOpen(true);
  };

  const openEdit = (budget) => {
    setEditingBudget(budget);
    setForm({ category_id: String(budget.category_id), amount: String(budget.amount) });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingBudget(null);
    setForm({ category_id: '', amount: '' });
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!form.category_id || !amount) return;

    const currentOld = editingBudget ? Number(editingBudget.amount || 0) : 0;
    const projected = totalBudget - currentOld + amount;
    if (income > 0 && projected > income) {
      return toast.error(`Total budget melebihi pemasukan. Maksimal tersisa ${rupiah(income - (totalBudget - currentOld))}`);
    }

    const payload = {
      user_id: user.id,
      category_id: Number(form.category_id),
      amount,
    };
    if (editingBudget) payload.id = editingBudget.id;

    const { error } = await supabase.from('budgets').upsert(payload, { onConflict: 'user_id, category_id' });
    if (error) return toast.error(error.message);
    toast.success(editingBudget ? 'Budget diperbarui' : 'Budget dibuat');
    closeModal();
    loadData();
  };

  const handleDelete = async (budget) => {
    if (!window.confirm(`Hapus budget ${budget.categories?.name || ''}?`)) return;
    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('id', budget.id)
      .eq('user_id', user.id);
    if (error) return toast.error(error.message);
    toast.success('Budget dihapus');
    loadData();
  };

  return (
    <main className="min-h-screen bg-[#F7F8FA] text-slate-900 pb-28 md:pb-16 pt-8 md:pt-32">
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-7">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 mb-2">Planning / Budget</p>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">Budget bulanan</h1>
            <p className="text-sm text-slate-500 mt-2">Beri setiap rupiah tujuan sebelum uangnya terpakai.</p>
          </div>
          <button onClick={openNew} className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-slate-950 text-white text-sm font-bold shadow-lg shadow-slate-900/10">
            <Plus size={17} /> Atur budget
          </button>
        </header>

        <section className="rounded-[2rem] bg-[#0B1220] text-white p-6 md:p-8 mb-6 relative overflow-hidden shadow-xl shadow-slate-900/10">
          <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="relative z-10 grid lg:grid-cols-[1fr_0.8fr] gap-7 lg:items-end">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 mb-2">Pemasukan bulan ini</p>
              <p className="text-3xl md:text-5xl font-black tracking-tight">{loading ? '…' : rupiah(income)}</p>
              <p className="text-sm text-slate-400 mt-3">Total budget tidak akan dibiarkan melewati pemasukan bulan berjalan.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Dialokasikan</p>
                <p className="font-black text-lg truncate">{rupiah(totalBudget)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Belum dialokasikan</p>
                <p className={`font-black text-lg truncate ${unallocated < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{rupiah(unallocated)}</p>
              </div>
            </div>
          </div>
          <div className="relative z-10 mt-7">
            <div className="flex items-center justify-between gap-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              <span>Alokasi budget</span><span>{Math.round(allocationPercent)}%</span>
            </div>
            <div className="h-3 rounded-full bg-white/10 overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${allocationPercent}%` }} className="h-full rounded-full bg-indigo-400" /></div>
          </div>
        </section>

        <section className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-5"><WalletCards size={18} className="text-indigo-500 mb-3" /><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Total budget</p><p className="font-black text-lg mt-1">{rupiah(totalBudget)}</p></div>
          <div className="bg-white border border-slate-200 rounded-3xl p-5"><Target size={18} className="text-emerald-500 mb-3" /><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Terpakai</p><p className="font-black text-lg mt-1">{rupiah(totalSpent)}</p></div>
          <div className="bg-white border border-slate-200 rounded-3xl p-5 col-span-2 md:col-span-1"><AlertTriangle size={18} className="text-amber-500 mb-3" /><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Kategori</p><p className="font-black text-lg mt-1">{processed.length} budget aktif</p></div>
        </section>

        <section>
          <div className="flex items-center justify-between gap-4 mb-4">
            <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-1">Category limits</p><h2 className="text-xl md:text-2xl font-black">Kontrol pengeluaran</h2></div>
          </div>

          {loading ? (
            <div className="py-20 text-center text-sm text-slate-400">Memuat budget…</div>
          ) : !processed.length ? (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2rem] p-10 md:p-14 text-center">
              <Target size={28} className="mx-auto text-slate-300 mb-4" />
              <h3 className="font-black text-lg">Belum ada budget</h3>
              <p className="text-sm text-slate-500 mt-2 mb-5">Mulai dari kategori yang paling sering bikin pengeluaran membesar.</p>
              <button onClick={openNew} className="px-5 py-3 rounded-2xl bg-slate-950 text-white font-bold text-sm">Buat budget pertama</button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {processed.map((budget) => {
                const percent = Math.min(budget.percent, 100);
                const danger = budget.percent >= 100;
                const warning = budget.percent >= 75 && !danger;
                return (
                  <motion.div layout key={budget.id} className="bg-white border border-slate-200 rounded-[2rem] p-5 md:p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-4 mb-5">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-1">Kategori</p>
                        <h3 className="text-lg font-black">{budget.categories?.name || 'Kategori'}</h3>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(budget)} className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center"><Pencil size={15} /></button>
                        <button onClick={() => handleDelete(budget)} className="w-9 h-9 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center"><Trash2 size={15} /></button>
                      </div>
                    </div>
                    <div className="flex items-end justify-between gap-4 mb-3">
                      <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Terpakai</p><p className="font-black text-xl">{rupiah(budget.spent)}</p></div>
                      <div className="text-right"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Batas</p><p className="font-bold text-sm">{rupiah(budget.amount)}</p></div>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${percent}%` }} className={`h-full rounded-full ${danger ? 'bg-rose-500' : warning ? 'bg-amber-400' : 'bg-emerald-500'}`} /></div>
                    <div className="flex items-center justify-between mt-3 text-[11px] font-bold"><span className={danger ? 'text-rose-500' : warning ? 'text-amber-600' : 'text-slate-400'}>{Math.round(budget.percent)}% terpakai</span><span className="text-slate-400">Sisa {rupiah(Math.max(Number(budget.amount) - budget.spent, 0))}</span></div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-[100] bg-slate-950/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} className="bg-white w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 md:p-7 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Budget</p><h3 className="text-xl font-black">{editingBudget ? 'Edit budget' : 'Budget baru'}</h3></div>
                <button onClick={closeModal} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"><X size={18} /></button>
              </div>
              <form onSubmit={handleSave} className="space-y-4">
                <div><label className="text-[11px] font-bold text-slate-500">Kategori pengeluaran</label><select required value={form.category_id} disabled={Boolean(editingBudget)} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="mt-1 w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none disabled:opacity-60"><option value="">Pilih kategori</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
                <div><label className="text-[11px] font-bold text-slate-500">Batas maksimal</label><input required type="number" min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" className="mt-1 w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:ring-4 focus:ring-slate-100 font-bold" /></div>
                <button type="submit" className="w-full h-12 rounded-2xl bg-slate-950 text-white font-bold">{editingBudget ? 'Simpan perubahan' : 'Buat budget'}</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
