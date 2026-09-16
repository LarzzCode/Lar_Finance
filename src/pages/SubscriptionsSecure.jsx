import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, CheckCircle2, CircleDollarSign, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import { endOfMonth, format, getDate, startOfMonth } from 'date-fns';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const rupiah = (value) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const normalize = (value) => (value || '').trim().toLowerCase().replace(/\s+/g, ' ');

const getDueStatus = (dueDate, isPaid) => {
  if (isPaid) return { label: 'Lunas', className: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
  const today = getDate(new Date());
  const diff = Number(dueDate) - today;
  if (diff === 0) return { label: 'Hari ini', className: 'bg-rose-50 text-rose-600 border-rose-100' };
  if (diff < 0) return { label: `Telat ${Math.abs(diff)} hari`, className: 'bg-rose-50 text-rose-600 border-rose-100' };
  if (diff <= 3) return { label: `${diff} hari lagi`, className: 'bg-amber-50 text-amber-600 border-amber-100' };
  return { label: `H-${diff}`, className: 'bg-indigo-50 text-indigo-600 border-indigo-100' };
};

export default function SubscriptionsSecure() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [payingId, setPayingId] = useState(null);
  const [form, setForm] = useState({ name: '', amount: '', category_id: '', payment_method: 'cash', due_date: '1' });

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    const start = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const end = format(endOfMonth(new Date()), 'yyyy-MM-dd');

    const [subRes, txRes, catRes] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('*, categories(name)')
        .eq('user_id', user.id)
        .order('due_date', { ascending: true }),
      supabase
        .from('transactions')
        .select('id, description, amount, category_id, transaction_date')
        .eq('user_id', user.id)
        .gte('transaction_date', start)
        .lte('transaction_date', end),
      supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .order('name'),
    ]);

    if (subRes.error || txRes.error || catRes.error) {
      toast.error(subRes.error?.message || txRes.error?.message || catRes.error?.message || 'Gagal memuat tagihan');
    }
    setSubscriptions(subRes.data || []);
    setTransactions(txRes.data || []);
    setCategories(catRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const items = useMemo(() => subscriptions.map((sub) => {
    const subAmount = Number(sub.amount || 0);
    const isPaid = transactions.some((tx) => {
      const nameMatches = normalize(tx.description) === normalize(sub.name);
      const amountMatches = Number(tx.amount || 0) === subAmount;
      const categoryMatches = !sub.category_id || String(tx.category_id) === String(sub.category_id);
      return nameMatches && amountMatches && categoryMatches;
    });
    return { ...sub, isPaid, status: getDueStatus(sub.due_date, isPaid) };
  }), [subscriptions, transactions]);

  const stats = useMemo(() => {
    const total = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const paid = items.filter((item) => item.isPaid).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return { total, paid, remaining: total - paid, unpaidCount: items.filter((item) => !item.isPaid).length };
  }, [items]);

  const visible = items.filter((item) => filter === 'paid' ? item.isPaid : filter === 'unpaid' ? !item.isPaid : true);

  const closeModal = () => {
    setModalOpen(false);
    setForm({ name: '', amount: '', category_id: '', payment_method: 'cash', due_date: '1' });
  };

  const handleAdd = async (event) => {
    event.preventDefault();
    if (!user) return;
    const name = form.name.trim();
    const amount = Number(form.amount);
    const dueDate = Number(form.due_date);
    const category = categories.find((item) => String(item.id) === String(form.category_id));

    if (!name) return toast.error('Nama tagihan wajib diisi');
    if (!Number.isFinite(amount) || amount <= 0) return toast.error('Nominal tagihan harus lebih dari 0');
    if (!Number.isInteger(dueDate) || dueDate < 1 || dueDate > 31) return toast.error('Tanggal jatuh tempo harus 1–31');
    if (!category) return toast.error('Kategori tagihan tidak valid');

    setSaving(true);
    const { error } = await supabase.from('subscriptions').insert([{
      name,
      amount,
      category_id: category.id,
      payment_method: form.payment_method.trim() || 'cash',
      due_date: dueDate,
      user_id: user.id,
    }]);
    setSaving(false);

    if (error) return toast.error(error.message);
    toast.success('Langganan ditambahkan');
    closeModal();
    loadData();
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Hapus langganan ${item.name}? Transaksi pembayaran yang sudah tercatat tetap disimpan.`)) return;
    const { error } = await supabase
      .from('subscriptions')
      .delete()
      .eq('id', item.id)
      .eq('user_id', user.id);
    if (error) return toast.error(error.message);
    toast.success('Langganan dihapus');
    loadData();
  };

  const handlePay = async (item) => {
    if (!user || item.isPaid || payingId) return;
    const category = categories.find((entry) => String(entry.id) === String(item.category_id));
    if (!category) return toast.error('Kategori tagihan sudah tidak tersedia. Perbarui data tagihan terlebih dahulu.');

    setPayingId(item.id);
    const { error } = await supabase.from('transactions').insert([{
      amount: Number(item.amount),
      category_id: item.category_id,
      description: item.name,
      payment_method: item.payment_method || 'cash',
      transaction_date: format(new Date(), 'yyyy-MM-dd'),
      user_id: user.id,
    }]);
    setPayingId(null);

    if (error) return toast.error(`Gagal mencatat pembayaran: ${error.message}`);
    confetti({ particleCount: 90, spread: 65, origin: { y: 0.65 } });
    toast.success(`${item.name} sudah dicatat sebagai lunas`);
    loadData();
  };

  return (
    <main className="min-h-screen bg-[#F7F8FA] text-slate-900 pb-28 md:pb-16 pt-8 md:pt-32">
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-7">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 mb-2">Planning / Bills</p>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">Langganan rutin</h1>
            <p className="text-sm text-slate-500 mt-2">Status lunas dicocokkan dengan nama, nominal, dan kategori agar lebih akurat tanpa mengubah schema database.</p>
          </div>
          <button onClick={() => setModalOpen(true)} className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-slate-950 text-white text-sm font-bold shadow-lg shadow-slate-900/10"><Plus size={17} /> Tambah tagihan</button>
        </header>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
          <div className="rounded-3xl border border-indigo-100 bg-indigo-50 p-5"><CircleDollarSign size={18} className="text-indigo-600 mb-3" /><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Total tagihan</p><p className="font-black text-lg md:text-xl mt-1">{rupiah(stats.total)}</p></div>
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5"><CheckCircle2 size={18} className="text-emerald-600 mb-3" /><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Sudah dibayar</p><p className="font-black text-lg md:text-xl mt-1">{rupiah(stats.paid)}</p></div>
          <div className="rounded-3xl border border-rose-100 bg-rose-50 p-5"><CalendarClock size={18} className="text-rose-500 mb-3" /><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Sisa beban</p><p className="font-black text-lg md:text-xl mt-1">{rupiah(stats.remaining)}</p></div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5"><ShieldCheck size={18} className="text-slate-500 mb-3" /><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Belum lunas</p><p className="font-black text-lg md:text-xl mt-1">{stats.unpaidCount} tagihan</p></div>
        </section>

        <section className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden">
          <div className="p-5 md:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-1">Monthly bills</p><h2 className="text-xl font-black">Daftar tagihan</h2></div>
            <div className="inline-flex bg-slate-100 p-1 rounded-2xl self-start">{[['all','Semua'],['unpaid','Belum bayar'],['paid','Lunas']].map(([value,label]) => <button key={value} onClick={() => setFilter(value)} className={`px-4 py-2 rounded-xl text-xs font-bold transition ${filter === value ? 'bg-white shadow-sm text-slate-950' : 'text-slate-400'}`}>{label}</button>)}</div>
          </div>

          <div className="p-4 md:p-6">
            {loading ? (
              <div className="py-16 text-center text-sm text-slate-400">Memuat tagihan…</div>
            ) : !visible.length ? (
              <div className="py-14 text-center"><CalendarClock size={28} className="mx-auto text-slate-300 mb-4" /><h3 className="font-black">Belum ada tagihan di filter ini</h3><p className="text-sm text-slate-500 mt-2">Tambahkan langganan rutin agar jatuh temponya mudah dipantau.</p></div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {visible.map((item) => (
                  <motion.div layout key={item.id} className="border border-slate-200 rounded-[1.75rem] p-5 bg-white hover:shadow-lg hover:shadow-slate-900/5 transition-shadow">
                    <div className="flex items-start justify-between gap-4 mb-5">
                      <div className="min-w-0"><div className="flex items-center gap-2 mb-2"><span className={`inline-flex px-2.5 py-1 rounded-full border text-[10px] font-bold ${item.status.className}`}>{item.status.label}</span><span className="text-[10px] font-bold text-slate-400">Tgl {item.due_date}</span></div><h3 className="font-black text-lg truncate">{item.name}</h3><p className="text-xs text-slate-400 mt-1">{item.categories?.name || 'Tanpa kategori'} · {item.payment_method || 'cash'}</p></div>
                      <button onClick={() => handleDelete(item)} className="w-9 h-9 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0"><Trash2 size={15} /></button>
                    </div>
                    <p className="text-2xl font-black tracking-tight mb-5">{rupiah(item.amount)}</p>
                    {item.isPaid ? <div className="w-full h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center gap-2 text-sm font-bold"><CheckCircle2 size={17} /> Sudah lunas</div> : <button onClick={() => handlePay(item)} disabled={payingId === item.id} className="w-full h-11 rounded-2xl bg-slate-950 text-white text-sm font-bold hover:bg-black transition-colors disabled:opacity-60">{payingId === item.id ? 'Mencatat...' : 'Catat sebagai dibayar'}</button>}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-[100] bg-slate-950/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} className="bg-white w-full sm:max-w-lg rounded-t-[2rem] sm:rounded-[2rem] p-6 md:p-7 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Recurring bill</p><h3 className="text-xl font-black">Tagihan baru</h3></div><button onClick={closeModal} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"><X size={18} /></button></div>
              <form onSubmit={handleAdd} className="space-y-4">
                <div><label className="text-[11px] font-bold text-slate-500">Nama tagihan</label><input required maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Internet, Netflix, listrik..." className="mt-1 w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:ring-4 focus:ring-slate-100 font-semibold" /></div>
                <div className="grid sm:grid-cols-2 gap-4"><div><label className="text-[11px] font-bold text-slate-500">Nominal</label><input required type="number" min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" className="mt-1 w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none font-bold" /></div><div><label className="text-[11px] font-bold text-slate-500">Tanggal jatuh tempo</label><input required type="number" min="1" max="31" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="mt-1 w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none font-bold" /></div></div>
                <div><label className="text-[11px] font-bold text-slate-500">Kategori</label><select required value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="mt-1 w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none"><option value="">Pilih kategori</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
                <div><label className="text-[11px] font-bold text-slate-500">Metode bayar</label><input maxLength={40} value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} placeholder="cash / transfer" className="mt-1 w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none" /></div>
                <button type="submit" disabled={saving} className="w-full h-12 rounded-2xl bg-slate-950 text-white font-bold disabled:opacity-60">{saving ? 'Menyimpan...' : 'Simpan tagihan'}</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
