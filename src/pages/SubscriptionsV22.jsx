import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, CheckCircle2, CircleDollarSign, Plus, Trash2, WalletCards, X } from 'lucide-react';
import { format, getDate } from 'date-fns';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { currentMonthRange, isSystemCategory, loadAccessibleCategories, rupiah } from '../lib/financeData';

const normalize = (value) => (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const dueStatus = (dueDate, paid) => {
  if (paid) return { label: 'Lunas', className: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
  const diff = Number(dueDate) - getDate(new Date());
  if (diff === 0) return { label: 'Hari ini', className: 'bg-rose-50 text-rose-600 border-rose-100' };
  if (diff < 0) return { label: `Telat ${Math.abs(diff)} hari`, className: 'bg-rose-50 text-rose-600 border-rose-100' };
  if (diff <= 3) return { label: `${diff} hari lagi`, className: 'bg-amber-50 text-amber-600 border-amber-100' };
  return { label: `H-${diff}`, className: 'bg-indigo-50 text-indigo-600 border-indigo-100' };
};

export default function SubscriptionsV22() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [paying, setPaying] = useState(null);
  const [payWallet, setPayWallet] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', amount: '', category_id: '', payment_method: 'Rutin', due_date: '1' });

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { start, end } = currentMonthRange();
    const [subRes, txRes, catRes, walletRes] = await Promise.all([
      supabase.from('subscriptions').select('*, categories(name, user_id)').eq('user_id', user.id).order('due_date'),
      supabase.from('transactions').select('id, description, amount, category_id, wallet_id, transaction_date').eq('user_id', user.id).gte('transaction_date', start).lte('transaction_date', end),
      loadAccessibleCategories(supabase, user.id, 'expense'),
      supabase.from('wallets').select('id, name').eq('user_id', user.id).order('created_at'),
    ]);
    const error = subRes.error || txRes.error || catRes.error || walletRes.error;
    if (error) toast.error(error.message || 'Gagal memuat tagihan');
    setSubscriptions(subRes.data || []);
    setTransactions(txRes.data || []);
    setCategories(catRes.data || []);
    setWallets(walletRes.data || []);
    setPayWallet((current) => current || walletRes.data?.[0]?.id || '');
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const items = useMemo(() => subscriptions.map((sub) => {
    const isPaid = transactions.some((tx) => normalize(tx.description) === normalize(sub.name) && Number(tx.amount || 0) === Number(sub.amount || 0) && String(tx.category_id || '') === String(sub.category_id || ''));
    return { ...sub, isPaid, status: dueStatus(sub.due_date, isPaid) };
  }), [subscriptions, transactions]);

  const stats = useMemo(() => {
    const total = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const paid = items.filter((item) => item.isPaid).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return { total, paid, remaining: total - paid, unpaid: items.filter((item) => !item.isPaid).length };
  }, [items]);

  const visible = items.filter((item) => filter === 'paid' ? item.isPaid : filter === 'unpaid' ? !item.isPaid : true);
  const close = () => { setModalOpen(false); setForm({ name: '', amount: '', category_id: '', payment_method: 'Rutin', due_date: '1' }); };

  const save = async (event) => {
    event.preventDefault();
    const amount = Number(form.amount || 0);
    const due = Number(form.due_date || 0);
    if (!form.name.trim()) return toast.error('Nama tagihan wajib diisi');
    if (!Number.isFinite(amount) || amount <= 0) return toast.error('Nominal harus lebih dari 0');
    if (!form.category_id) return toast.error('Pilih kategori');
    if (due < 1 || due > 31) return toast.error('Tanggal jatuh tempo harus 1–31');
    if (!categories.some((category) => String(category.id) === String(form.category_id))) return toast.error('Kategori tidak valid');

    setSaving(true);
    const { error } = await supabase.from('subscriptions').insert([{
      user_id: user.id,
      name: form.name.trim(),
      amount,
      category_id: Number(form.category_id),
      payment_method: form.payment_method.trim() || 'Rutin',
      due_date: due,
    }]);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Tagihan rutin ditambahkan');
    close();
    load();
  };

  const askPay = (item) => {
    if (item.isPaid) return;
    if (!wallets.length) return toast.error('Buat dompet dulu sebelum mencatat pembayaran');
    setPayWallet(wallets[0]?.id || '');
    setPaying(item);
  };

  const payNow = async () => {
    if (!paying || !payWallet) return;
    const wallet = wallets.find((item) => String(item.id) === String(payWallet));
    if (!wallet) return toast.error('Dompet tidak valid');
    setSaving(true);
    const { error } = await supabase.from('transactions').insert([{
      user_id: user.id,
      amount: Number(paying.amount),
      transaction_date: format(new Date(), 'yyyy-MM-dd'),
      description: paying.name,
      category_id: paying.category_id,
      wallet_id: wallet.id,
      payment_method: wallet.name,
    }]);
    setSaving(false);
    if (error) return toast.error(error.message);
    confetti({ particleCount: 90, spread: 65, origin: { y: 0.7 } });
    toast.success(`${paying.name} dicatat sebagai lunas`);
    setPaying(null);
    load();
  };

  const remove = async (item) => {
    if (!window.confirm(`Hapus tagihan rutin "${item.name}"? Transaksi pembayaran lama tidak ikut dihapus.`)) return;
    const { error } = await supabase.from('subscriptions').delete().eq('id', item.id).eq('user_id', user.id);
    if (error) return toast.error(error.message);
    toast.success('Tagihan dihapus');
    load();
  };

  return (
    <main className="min-h-screen bg-[#F7F8FA] text-slate-900 pb-28 md:pb-16 pt-8 md:pt-32">
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-7"><div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 mb-1">Planning / Bills</p><h1 className="text-3xl md:text-4xl font-black tracking-tight">Tagihan rutin.</h1><p className="text-sm text-slate-500 mt-2">Pantau jatuh tempo dan catat pembayaran langsung ke dompet yang benar.</p></div><button onClick={() => setModalOpen(true)} className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-slate-950 text-white text-sm font-black"><Plus size={17} /> Tagihan baru</button></header>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">{[
          ['Total tagihan', rupiah(stats.total), 'slate'],
          ['Sudah dibayar', rupiah(stats.paid), 'emerald'],
          ['Sisa bulan ini', rupiah(stats.remaining), 'rose'],
          ['Belum lunas', `${stats.unpaid} tagihan`, 'amber'],
        ].map(([label,value,tone]) => <div key={label} className={`rounded-[1.75rem] border p-5 ${tone === 'emerald' ? 'bg-emerald-50 border-emerald-100' : tone === 'rose' ? 'bg-rose-50 border-rose-100' : tone === 'amber' ? 'bg-amber-50 border-amber-100' : 'bg-white border-slate-200'}`}><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="text-lg md:text-xl font-black mt-2">{loading ? '…' : value}</p></div>)}</section>

        <div className="mb-5 inline-flex bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">{[['all','Semua'],['unpaid','Belum bayar'],['paid','Lunas']].map(([key,label]) => <button key={key} onClick={() => setFilter(key)} className={`px-4 py-2.5 rounded-xl text-xs font-black ${filter === key ? 'bg-slate-950 text-white' : 'text-slate-400'}`}>{label}</button>)}</div>

        {loading ? <div className="grid md:grid-cols-2 gap-4">{[1,2].map((item) => <div key={item} className="h-40 rounded-[2rem] bg-slate-200 animate-pulse" />)}</div> : !visible.length ? <div className="bg-white border border-dashed border-slate-300 rounded-[2rem] py-16 text-center"><CalendarClock size={30} className="mx-auto text-slate-300 mb-4" /><p className="font-black">Belum ada tagihan di filter ini.</p></div> : <section className="grid md:grid-cols-2 gap-4">{visible.map((item) => <article key={item.id} className="bg-white border border-slate-200 rounded-[2rem] p-5 md:p-6 shadow-sm"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-black truncate">{item.name}</h3><span className={`text-[10px] font-black border rounded-full px-2.5 py-1 ${item.status.className}`}>{item.status.label}</span></div><p className="text-xs text-slate-400 mt-1">{item.categories?.name || 'Kategori'}{item.categories?.user_id == null ? ' · Bawaan' : ''} · setiap tanggal {item.due_date}</p></div><button onClick={() => remove(item)} className="w-9 h-9 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0"><Trash2 size={15} /></button></div><div className="mt-6 flex items-end justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nominal</p><p className="text-2xl font-black mt-1">{rupiah(item.amount)}</p></div>{item.isPaid ? <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-600"><CheckCircle2 size={16} /> Terbayar</span> : <button onClick={() => askPay(item)} className="h-11 px-4 rounded-2xl bg-slate-950 text-white text-xs font-black inline-flex items-center gap-2"><CircleDollarSign size={15} /> Bayar sekarang</button>}</div></article>)}</section>}
      </div>

      <AnimatePresence>{modalOpen && <div className="fixed inset-0 z-[90] bg-slate-950/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"><motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} className="bg-white w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 md:p-7 shadow-2xl"><div className="flex items-center justify-between mb-6"><div><p className="text-lg font-black">Tagihan rutin baru</p><p className="text-xs text-slate-400 mt-1">Tagihan tidak membuat transaksi sampai kamu menekan Bayar.</p></div><button onClick={close} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"><X size={17} /></button></div><form onSubmit={save} className="space-y-4"><label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nama</span><input autoFocus required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Internet, Netflix..." className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 font-bold outline-none" /></label><div className="grid grid-cols-2 gap-3"><label><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nominal</span><input required min="1" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 font-bold outline-none" /></label><label><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Jatuh tempo</span><input required min="1" max="31" type="number" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 font-bold outline-none" /></label></div><label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Kategori</span><select required value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 font-bold outline-none"><option value="">Pilih kategori</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}{isSystemCategory(category) ? ' · Bawaan' : ''}</option>)}</select></label><button disabled={saving} className="w-full h-12 rounded-2xl bg-slate-950 text-white font-black text-sm disabled:opacity-60">{saving ? 'Menyimpan...' : 'Simpan tagihan'}</button></form></motion.div></div>}</AnimatePresence>

      <AnimatePresence>{paying && <div className="fixed inset-0 z-[95] bg-slate-950/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"><motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} className="bg-white w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 md:p-7 shadow-2xl"><div className="flex items-center justify-between mb-5"><div><p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Catat pembayaran</p><h3 className="text-xl font-black mt-1">{paying.name}</h3></div><button onClick={() => setPaying(null)} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"><X size={17} /></button></div><div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 mb-5"><p className="text-xs text-slate-400">Nominal</p><p className="text-2xl font-black mt-1">{rupiah(paying.amount)}</p></div><label className="block"><span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-400"><WalletCards size={14} /> Bayar dari dompet</span><select value={payWallet} onChange={(e) => setPayWallet(e.target.value)} className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 font-bold outline-none">{wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}</select></label><button onClick={payNow} disabled={saving || !payWallet} className="mt-5 w-full h-12 rounded-2xl bg-emerald-500 text-white font-black text-sm disabled:opacity-60">{saving ? 'Mencatat...' : 'Konfirmasi pembayaran'}</button></motion.div></div>}</AnimatePresence>
    </main>
  );
}
