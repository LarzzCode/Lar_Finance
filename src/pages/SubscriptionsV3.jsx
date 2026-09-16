import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, CheckCircle2, CircleDollarSign, Plus, Trash2, X } from 'lucide-react';
import { format, getDate } from 'date-fns';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { currentMonthRange, loadAccessibleCategories, rupiah } from '../lib/financeData';

const normalize = (value) => (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const dueStatus = (dueDate, paid) => {
  if (paid) return { label: 'Lunas', tone: 'emerald' };
  const diff = Number(dueDate) - getDate(new Date());
  if (diff === 0) return { label: 'Hari ini', tone: 'rose' };
  if (diff < 0) return { label: `Telat ${Math.abs(diff)} hari`, tone: 'rose' };
  if (diff <= 3) return { label: `${diff} hari lagi`, tone: 'amber' };
  return { label: `H-${diff}`, tone: 'indigo' };
};

export default function SubscriptionsV3() {
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
    if (!paying || !payWallet || saving) return;
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
    confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
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

  const toneClass = (tone) => tone === 'emerald' ? 'text-emerald-600 bg-emerald-500/[.08]' : tone === 'rose' ? 'text-rose-500 bg-rose-500/[.08]' : tone === 'amber' ? 'text-amber-600 bg-amber-500/[.08]' : 'text-indigo-600 bg-indigo-500/[.08]';

  return (
    <main className="min-h-screen pb-32 md:pb-16 pt-8 md:pt-32 text-slate-900 dark:text-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-8">
          <div className="max-w-2xl"><p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400 mb-2">Planning / Bills</p><h1 className="text-[2rem] md:text-[2.7rem] font-semibold tracking-[-0.04em] leading-tight">Tagihan rutin</h1><p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Lihat mana yang sudah lunas, mana yang mendekati jatuh tempo, lalu catat pembayaran ke dompet yang benar.</p></div>
          <button onClick={() => setModalOpen(true)} className="liquid-primary text-white inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-medium"><Plus size={17} /> Tagihan baru</button>
        </header>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
          {[
            ['Total tagihan', rupiah(stats.total), 'slate'],
            ['Sudah dibayar', rupiah(stats.paid), 'emerald'],
            ['Sisa bulan ini', rupiah(stats.remaining), 'rose'],
            ['Belum lunas', `${stats.unpaid} tagihan`, 'amber'],
          ].map(([label, value, tone]) => <div key={label} className="liquid-nav rounded-[1.75rem] p-5"><p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</p><p className={`text-lg md:text-xl font-semibold mt-2 ${tone === 'emerald' ? 'text-emerald-600 dark:text-emerald-300' : tone === 'rose' ? 'text-rose-500 dark:text-rose-300' : tone === 'amber' ? 'text-amber-600 dark:text-amber-300' : ''}`}>{loading ? '…' : value}</p></div>)}
        </section>

        <div className="mb-5 inline-flex liquid-nav rounded-2xl p-1">{[['all','Semua'],['unpaid','Belum bayar'],['paid','Lunas']].map(([key,label]) => <button key={key} onClick={() => setFilter(key)} className={`px-4 py-2.5 rounded-xl text-xs font-medium transition ${filter === key ? 'liquid-primary text-white' : 'text-slate-400'}`}>{label}</button>)}</div>

        {loading ? (
          <div className="grid md:grid-cols-2 gap-4">{[1,2].map((item) => <div key={item} className="h-40 liquid-nav rounded-[2rem] animate-pulse" />)}</div>
        ) : !visible.length ? (
          <div className="liquid-nav rounded-[2.2rem] py-16 text-center"><CalendarClock size={30} className="mx-auto text-slate-300 mb-4" /><p className="font-medium">Belum ada tagihan di filter ini.</p></div>
        ) : (
          <section className="grid md:grid-cols-2 gap-4">
            {visible.map((item) => <article key={item.id} className="liquid-nav rounded-[2rem] p-5 md:p-6"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-semibold truncate">{item.name}</h3><span className={`text-[10px] font-medium rounded-full px-2.5 py-1 ${toneClass(item.status.tone)}`}>{item.status.label}</span></div><p className="text-xs text-slate-400 mt-1">{item.categories?.name || 'Kategori'} · setiap tanggal {item.due_date}</p></div><button onClick={() => remove(item)} className="w-9 h-9 rounded-xl bg-rose-500/[.08] text-rose-500 flex items-center justify-center shrink-0"><Trash2 size={15} /></button></div><div className="mt-6 flex items-end justify-between gap-4"><div><p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Nominal</p><p className="text-2xl font-semibold mt-1">{rupiah(item.amount)}</p></div>{item.isPaid ? <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-300"><CheckCircle2 size={16} /> Terbayar</span> : <button onClick={() => askPay(item)} className="h-11 px-4 rounded-2xl liquid-primary text-white text-xs font-medium inline-flex items-center gap-2"><CircleDollarSign size={15} /> Bayar sekarang</button>}</div></article>)}
          </section>
        )}
      </div>

      <AnimatePresence>
        {modalOpen && <div className="fixed inset-0 z-[100] bg-slate-950/40 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"><motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} className="liquid-nav w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 md:p-7"><div className="flex items-center justify-between mb-6"><div><p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">Recurring bill</p><h3 className="text-xl font-semibold mt-1">Tagihan baru</h3></div><button onClick={close} className="w-9 h-9 rounded-full bg-white/45 dark:bg-white/[.05] flex items-center justify-center"><X size={17} /></button></div><form onSubmit={save} className="space-y-4"><label className="block"><span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Nama</span><input autoFocus required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Internet, Netflix..." className="w-full mt-2 rounded-2xl px-4 py-4 font-medium outline-none" /></label><div className="grid grid-cols-2 gap-3"><label><span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Nominal</span><input required min="1" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full mt-2 rounded-2xl px-4 py-4 font-medium outline-none" /></label><label><span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Jatuh tempo</span><input required min="1" max="31" type="number" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="w-full mt-2 rounded-2xl px-4 py-4 font-medium outline-none" /></label></div><label className="block"><span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Kategori</span><select required value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="w-full mt-2 rounded-2xl px-4 py-4 font-medium outline-none"><option value="">Pilih kategori</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><button disabled={saving} className="w-full h-12 rounded-2xl liquid-primary text-white font-medium text-sm disabled:opacity-60">{saving ? 'Menyimpan…' : 'Simpan tagihan'}</button></form></motion.div></div>}
      </AnimatePresence>

      <AnimatePresence>
        {paying && <div className="fixed inset-0 z-[105] bg-slate-950/40 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"><motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} className="liquid-nav w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 md:p-7"><div className="flex items-center justify-between mb-6"><div><p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">Pembayaran</p><h3 className="text-xl font-semibold mt-1">{paying.name}</h3></div><button onClick={() => setPaying(null)} className="w-9 h-9 rounded-full bg-white/45 dark:bg-white/[.05] flex items-center justify-center"><X size={17} /></button></div><div className="rounded-2xl bg-rose-500/[.07] p-4 mb-5"><p className="text-[10px] uppercase tracking-wider text-slate-400">Nominal</p><p className="text-2xl font-semibold text-rose-500 mt-1">{rupiah(paying.amount)}</p></div><label className="block"><span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Bayar dari dompet</span><select value={payWallet} onChange={(e) => setPayWallet(e.target.value)} className="w-full mt-2 rounded-2xl px-4 py-4 font-medium outline-none">{wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}</select></label><button disabled={saving || !payWallet} onClick={payNow} className="w-full h-12 mt-5 rounded-2xl liquid-primary text-white font-medium text-sm disabled:opacity-60">{saving ? 'Mencatat…' : 'Konfirmasi pembayaran'}</button></motion.div></div>}
      </AnimatePresence>
    </main>
  );
}
