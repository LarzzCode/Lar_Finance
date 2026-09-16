import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import * as icons from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { calculateWalletBalances, currentMonthRange, loadAccessibleCategories, rupiah } from '../lib/financeDataV31';

const DynamicIcon = ({ name, size = 20 }) => {
  const Icon = icons[name] || icons.HelpCircle;
  return <Icon size={size} />;
};

export default function InputDataV31() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedWallet, setSelectedWallet] = useState('');
  const [categories, setCategories] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [frequencies, setFrequencies] = useState({});
  const [showAll, setShowAll] = useState(false);

  const loadData = async () => {
    if (!user) return;
    setDataLoading(true);
    const { start, end } = currentMonthRange();
    const [categoryRes, walletRes, txRes, transferRes] = await Promise.all([
      loadAccessibleCategories(supabase, user.id, type),
      supabase.from('wallets').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('transactions').select('amount, wallet_id, category_id, transaction_date, categories(type)').eq('user_id', user.id),
      supabase.from('transfers').select('amount, from_wallet_id, to_wallet_id, transfer_date').eq('user_id', user.id),
    ]);
    const error = categoryRes.error || walletRes.error || txRes.error || transferRes.error;
    if (error) {
      toast.error(error.message || 'Gagal memuat form');
      setDataLoading(false);
      return;
    }
    const txData = txRes.data || [];
    const freq = {};
    txData.forEach((tx) => {
      if (tx.transaction_date >= start && tx.transaction_date <= end && tx.category_id) freq[tx.category_id] = (freq[tx.category_id] || 0) + 1;
    });
    const calculated = calculateWalletBalances(walletRes.data || [], txData, transferRes.data || []);
    setCategories(categoryRes.data || []);
    setWallets(calculated);
    setFrequencies(freq);
    setSelectedCategory('');
    setSelectedWallet((current) => calculated.some((wallet) => String(wallet.id) === String(current)) ? current : calculated[0]?.id || '');
    setDataLoading(false);
  };

  useEffect(() => { loadData(); }, [user, type]);

  const sortedCategories = useMemo(() => [...categories].sort((a, b) => (frequencies[b.id] || 0) - (frequencies[a.id] || 0) || a.name.localeCompare(b.name)), [categories, frequencies]);
  const visibleCategories = showAll ? sortedCategories : sortedCategories.slice(0, 6);
  const selectedWalletData = wallets.find((wallet) => String(wallet.id) === String(selectedWallet));
  const selectedCategoryData = categories.find((category) => String(category.id) === String(selectedCategory));
  const numericAmount = Number(amount || 0);
  const formattedAmount = amount ? new Intl.NumberFormat('id-ID').format(amount) : '';
  const previewAmount = numericAmount > 0 ? `${type === 'expense' ? '-' : '+'}${rupiah(numericAmount)}` : rupiah(0);
  const canSubmit = numericAmount > 0 && selectedCategory && selectedWallet && !loading && !dataLoading;

  const submit = async (event) => {
    event.preventDefault();
    const category = categories.find((item) => String(item.id) === String(selectedCategory));
    const wallet = wallets.find((item) => String(item.id) === String(selectedWallet));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return toast.error('Nominal harus lebih dari 0');
    if (!category || category.type !== type) return toast.error('Pilih kategori yang valid');
    if (!wallet) return toast.error('Pilih dompet yang valid');
    setLoading(true);
    const { error } = await supabase.from('transactions').insert([{
      user_id: user.id,
      amount: numericAmount,
      transaction_date: date,
      description: description.trim() || (type === 'expense' ? 'Pengeluaran' : 'Pemasukan'),
      category_id: category.id,
      wallet_id: wallet.id,
      payment_method: wallet.name || 'Manual',
    }]);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(type === 'expense' ? 'Pengeluaran tersimpan' : 'Pemasukan tersimpan');
    navigate('/');
  };

  return (
    <main className="min-h-screen pb-32 md:pb-16 pt-8 md:pt-32 text-slate-900 dark:text-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="mb-7 md:mb-9 max-w-3xl"><button onClick={() => navigate('/')} className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-700 dark:hover:text-white mb-4"><icons.ArrowLeft size={15} /> Kembali</button><p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400 mb-2">Transaksi baru</p><h1 className="text-[2rem] md:text-[2.7rem] font-semibold tracking-[-0.04em]">Catat arus kas</h1><p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Saldo dompet sudah mengikuti transfer bulan ini.</p></header>

        <div className="grid lg:grid-cols-[1.3fr_.7fr] gap-6 lg:gap-8 items-start">
          <form onSubmit={submit} className="space-y-5">
            <section className="liquid-nav rounded-[2.3rem] p-5 md:p-6">
              <div className="grid grid-cols-2 gap-2 p-1.5 rounded-[1.35rem] bg-white/35 dark:bg-white/[.03] border border-white/60 dark:border-white/10">{[['expense','Pengeluaran',icons.ArrowUpRight],['income','Pemasukan',icons.ArrowDownLeft]].map(([key,label,Icon]) => <button key={key} type="button" onClick={() => setType(key)} className={`py-3.5 px-4 rounded-2xl text-xs font-medium flex items-center justify-center gap-2 ${type === key ? 'liquid-nav-pill text-slate-900 dark:text-white' : 'text-slate-400'}`}><Icon size={15} /> {label}</button>)}</div>
              <div className="pt-9 pb-5 text-center"><label htmlFor="transaction-amount" className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400 block mb-3">Nominal transaksi</label><div className="flex items-baseline justify-center gap-2"><span className="text-lg text-slate-300">Rp</span><input id="transaction-amount" autoFocus inputMode="numeric" value={formattedAmount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} placeholder="0" className={`lf-amount-input max-w-md w-full text-center text-[2.8rem] md:text-[4rem] font-semibold tracking-[-0.05em] ${type === 'expense' ? 'text-rose-500' : 'text-emerald-500'}`} /></div></div>
            </section>

            <section className="liquid-nav rounded-[2.3rem] p-6 md:p-8 space-y-7">
              <div className="grid sm:grid-cols-2 gap-5"><label><span className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400"><icons.CalendarDays size={14} /> Tanggal</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full mt-2 rounded-2xl px-4 py-3.5 font-medium text-sm outline-none" /></label><label><span className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400"><icons.WalletCards size={14} /> Sumber dana</span><select value={selectedWallet} onChange={(e) => setSelectedWallet(e.target.value)} className="w-full mt-2 rounded-2xl px-4 py-3.5 font-medium text-sm outline-none">{wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} · {rupiah(wallet.current_balance)}</option>)}</select></label></div>

              <div><div className="flex items-center justify-between mb-3"><span className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400"><icons.Tags size={14} /> Kategori</span>{sortedCategories.length > 6 && <button type="button" onClick={() => setShowAll((value) => !value)} className="text-[10px] text-slate-400">{showAll ? 'Ringkas' : 'Lihat semua'}</button>}</div>{dataLoading ? <div className="p-6 text-center text-sm text-slate-400">Memuat kategori…</div> : <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{visibleCategories.map((category) => { const active = String(selectedCategory) === String(category.id); return <button key={category.id} type="button" onClick={() => setSelectedCategory(category.id)} className={`p-4 rounded-2xl border text-left ${active ? type === 'expense' ? 'border-rose-300/40 bg-rose-500/[.08]' : 'border-emerald-300/40 bg-emerald-500/[.08]' : 'border-white/60 dark:border-white/10 bg-white/[.32] dark:bg-white/[.025]'}`}><div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${active ? type === 'expense' ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-500/[.08] text-slate-500'}`}><DynamicIcon name={category.icon} size={18} /></div><p className="font-medium text-sm truncate">{category.name}</p><p className="text-[10px] text-slate-400 mt-1">Dipakai {frequencies[category.id] || 0}× bulan ini</p></button>; })}</div>}</div>

              <label><span className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400"><icons.NotebookPen size={14} /> Catatan</span><textarea rows={3} maxLength={180} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Contoh: makan siang, gaji freelance..." className="w-full mt-2 resize-none rounded-2xl px-4 py-4 font-medium text-sm outline-none" /></label>
              <button disabled={!canSubmit} className={`w-full rounded-2xl py-4 text-sm font-semibold text-white disabled:opacity-40 ${type === 'expense' ? 'bg-rose-500' : 'bg-emerald-500'}`}>{loading ? 'Menyimpan…' : `Simpan ${type === 'expense' ? 'Pengeluaran' : 'Pemasukan'}`}</button>
            </section>
          </form>

          <aside className="lg:sticky lg:top-28 space-y-4"><section className="liquid-nav rounded-[2.2rem] p-6 md:p-7"><p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Preview transaksi</p><p className={`text-3xl font-semibold mt-2 ${numericAmount === 0 ? 'text-slate-400' : type === 'expense' ? 'text-rose-500' : 'text-emerald-600'}`}>{previewAmount}</p><div className="mt-5 space-y-3 text-sm"><div className="flex justify-between gap-3"><span className="text-slate-400">Kategori</span><span className="font-medium">{selectedCategoryData?.name || 'Belum dipilih'}</span></div><div className="flex justify-between gap-3"><span className="text-slate-400">Dompet</span><span className="font-medium">{selectedWalletData?.name || 'Belum dipilih'}</span></div><div className="flex justify-between gap-3"><span className="text-slate-400">Saldo bulan ini</span><span className="font-medium">{selectedWalletData ? rupiah(selectedWalletData.current_balance) : '-'}</span></div></div></section>{selectedWalletData && numericAmount > 0 && <section className="liquid-nav rounded-[1.8rem] p-5"><p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Estimasi setelah transaksi</p><p className={`text-2xl font-semibold mt-2 ${selectedWalletData.current_balance + (type === 'income' ? numericAmount : -numericAmount) < 0 ? 'text-rose-500' : ''}`}>{rupiah(selectedWalletData.current_balance + (type === 'income' ? numericAmount : -numericAmount))}</p></section>}</aside>
        </div>
      </div>
    </main>
  );
}
