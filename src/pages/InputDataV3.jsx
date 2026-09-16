import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import * as icons from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { calculateWalletBalances, currentMonthRange, loadAccessibleCategories, rupiah } from '../lib/financeData';

const DynamicIcon = ({ name, size = 20 }) => {
  const Icon = icons[name] || icons.HelpCircle;
  return <Icon size={size} />;
};

export default function InputDataV3() {
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

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user, type]);

  const loadData = async () => {
    setDataLoading(true);
    const { start, end } = currentMonthRange();
    const [categoryRes, walletRes, txRes] = await Promise.all([
      loadAccessibleCategories(supabase, user.id, type),
      supabase.from('wallets').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('transactions').select('amount, wallet_id, category_id, transaction_date, categories(type)').eq('user_id', user.id),
    ]);

    if (categoryRes.error || walletRes.error || txRes.error) {
      toast.error(categoryRes.error?.message || walletRes.error?.message || txRes.error?.message || 'Gagal memuat form');
      setDataLoading(false);
      return;
    }

    const txData = txRes.data || [];
    const freq = {};
    txData.forEach((tx) => {
      if (tx.transaction_date >= start && tx.transaction_date <= end && tx.category_id) freq[tx.category_id] = (freq[tx.category_id] || 0) + 1;
    });

    const calculated = calculateWalletBalances(walletRes.data || [], txData);
    setCategories(categoryRes.data || []);
    setWallets(calculated);
    setFrequencies(freq);
    setSelectedCategory('');
    setSelectedWallet((current) => calculated.some((wallet) => String(wallet.id) === String(current)) ? current : calculated[0]?.id || '');
    setDataLoading(false);
  };

  const sortedCategories = useMemo(() => [...categories].sort((a, b) => (frequencies[b.id] || 0) - (frequencies[a.id] || 0) || a.name.localeCompare(b.name)), [categories, frequencies]);
  const visibleCategories = showAll ? sortedCategories : sortedCategories.slice(0, 6);
  const selectedWalletData = wallets.find((wallet) => String(wallet.id) === String(selectedWallet));
  const selectedCategoryData = categories.find((category) => String(category.id) === String(selectedCategory));
  const numericAmount = Number(amount || 0);
  const formattedAmount = amount ? new Intl.NumberFormat('id-ID').format(amount) : '';

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return toast.error('Nominal harus lebih dari 0');
    const category = categories.find((item) => String(item.id) === String(selectedCategory));
    const wallet = wallets.find((item) => String(item.id) === String(selectedWallet));
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
    if (error) return toast.error(`Gagal menyimpan: ${error.message}`);
    toast.success(type === 'expense' ? 'Pengeluaran tersimpan' : 'Pemasukan tersimpan');
    navigate('/');
  };

  return (
    <main className="min-h-screen pb-32 md:pb-16 md:pt-28 text-slate-900 dark:text-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 md:pt-6">
        <header className="mb-7 md:mb-9">
          <button onClick={() => navigate('/')} className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-4"><icons.ArrowLeft size={15} /> Kembali</button>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400 mb-2">Transaksi baru</p>
          <h1 className="text-[2rem] md:text-[2.7rem] leading-tight font-semibold tracking-[-0.04em]">Catat arus kas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-2xl">Pilih jenis transaksi, dompet, dan kategori. Semua angka mengikuti saldo bulan berjalan.</p>
        </header>

        <div className="grid lg:grid-cols-[minmax(0,1.28fr)_minmax(300px,.72fr)] gap-6 lg:gap-8 items-start">
          <form onSubmit={handleSubmit} className="space-y-5">
            <section className="liquid-nav rounded-[2.3rem] p-5 md:p-6">
              <div className="grid grid-cols-2 gap-2 p-1.5 rounded-[1.35rem] bg-white/35 dark:bg-white/[.03] border border-white/60 dark:border-white/10">
                {[['expense', 'Pengeluaran', icons.ArrowUpRight], ['income', 'Pemasukan', icons.ArrowDownLeft]].map(([key, label, Icon]) => (
                  <button key={key} type="button" onClick={() => setType(key)} className={`py-3.5 px-4 rounded-2xl text-xs font-medium flex items-center justify-center gap-2 transition-all ${type === key ? 'liquid-nav-pill text-slate-900 dark:text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}><Icon size={15} /> {label}</button>
                ))}
              </div>

              <div className="pt-9 pb-5 text-center">
                <label className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400 block mb-3">Nominal transaksi</label>
                <div className="flex items-baseline justify-center gap-2"><span className="text-lg md:text-xl font-medium text-slate-300">Rp</span><input autoFocus inputMode="numeric" type="text" placeholder="0" value={formattedAmount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ''))} className={`min-w-0 w-full max-w-md bg-transparent !shadow-none !border-0 outline-none text-center text-[2.8rem] md:text-[4rem] font-semibold tracking-[-0.05em] placeholder:text-slate-200 ${type === 'expense' ? 'text-rose-500' : 'text-emerald-500'}`} /></div>
              </div>
            </section>

            <section className="liquid-nav rounded-[2.3rem] p-6 md:p-8 space-y-7">
              <div className="grid sm:grid-cols-2 gap-5">
                <label className="block"><span className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400 mb-2"><icons.CalendarDays size={14} /> Tanggal</span><input type="date" required value={date} onChange={(event) => setDate(event.target.value)} className="w-full rounded-2xl px-4 py-3.5 font-medium text-sm outline-none" /></label>
                <label className="block"><span className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400 mb-2"><icons.WalletCards size={14} /> Sumber dana</span><select value={selectedWallet || ''} onChange={(event) => setSelectedWallet(event.target.value)} disabled={dataLoading || !wallets.length} className="w-full rounded-2xl px-4 py-3.5 font-medium text-sm outline-none disabled:opacity-60" required><option value="" disabled>{dataLoading ? 'Memuat dompet...' : 'Pilih dompet'}</option>{wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} · {rupiah(wallet.current_balance)}</option>)}</select></label>
              </div>

              <div>
                <div className="flex items-center justify-between gap-4 mb-3"><span className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400"><icons.Tags size={14} /> Kategori</span>{sortedCategories.length > 6 && <button type="button" onClick={() => setShowAll((value) => !value)} className="text-[10px] font-medium uppercase tracking-wide text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">{showAll ? 'Ringkas' : 'Lihat semua'}</button>}</div>
                {dataLoading ? <div className="rounded-2xl bg-white/30 dark:bg-white/[.03] p-6 text-center text-sm text-slate-400">Memuat kategori...</div> : visibleCategories.length ? <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{visibleCategories.map((category) => { const active = String(selectedCategory) === String(category.id); return <button key={category.id} type="button" onClick={() => setSelectedCategory(category.id)} className={`p-4 rounded-2xl border text-left transition-all ${active ? type === 'expense' ? 'border-rose-300/40 bg-rose-500/8' : 'border-emerald-300/40 bg-emerald-500/8' : 'border-white/60 dark:border-white/10 bg-white/32 dark:bg-white/[.025] hover:bg-white/50'}`}><div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${active ? type === 'expense' ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-500/8 text-slate-500'}`}><DynamicIcon name={category.icon} size={18} /></div><p className="font-medium text-sm truncate">{category.name}</p><p className="text-[10px] text-slate-400 mt-1">Dipakai {frequencies[category.id] || 0}× bulan ini</p></button>; })}</div> : <div className="rounded-2xl border border-dashed border-white/60 dark:border-white/10 p-6 text-center text-sm text-slate-400">Belum ada kategori.</div>}
              </div>

              <label className="block"><span className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400 mb-2"><icons.NotebookPen size={14} /> Catatan</span><textarea rows={3} value={description} maxLength={180} onChange={(event) => setDescription(event.target.value)} placeholder="Contoh: makan siang, gaji freelance, bensin..." className="w-full resize-none rounded-2xl px-4 py-4 font-medium text-sm outline-none" /><span className="block text-right text-[10px] text-slate-400 mt-1">{description.length}/180</span></label>

              {!wallets.length && !dataLoading && <button type="button" onClick={() => navigate('/wallet')} className="w-full rounded-2xl bg-indigo-500/8 p-4 text-sm font-medium text-indigo-700 dark:text-indigo-300">Belum ada dompet · buat dompet dulu →</button>}
              <button type="submit" disabled={loading || dataLoading || !wallets.length || !categories.length} className={`w-full rounded-2xl py-4 px-5 text-sm font-semibold text-white transition-all active:scale-[0.99] disabled:opacity-50 ${type === 'expense' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>{loading ? 'Menyimpan…' : `Simpan ${type === 'expense' ? 'Pengeluaran' : 'Pemasukan'}`}</button>
            </section>
          </form>

          <aside className="lg:sticky lg:top-28 space-y-4">
            <section className="liquid-nav rounded-[2.2rem] p-6 md:p-7 overflow-hidden relative"><div className={`absolute -right-16 -top-16 w-44 h-44 rounded-full blur-3xl opacity-20 ${type === 'expense' ? 'bg-rose-400' : 'bg-emerald-400'}`} /><div className="relative"><p className="text-[10px] uppercase tracking-[0.16em] font-medium text-slate-400 mb-2">Preview transaksi</p><p className={`text-3xl font-semibold tracking-[-0.035em] ${type === 'expense' ? 'text-rose-500 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300'}`}>{type === 'expense' ? '-' : '+'}{rupiah(numericAmount)}</p><div className="mt-5 space-y-3 text-sm"><div className="flex justify-between gap-3"><span className="text-slate-400">Kategori</span><span className="font-medium text-right">{selectedCategoryData?.name || 'Belum dipilih'}</span></div><div className="flex justify-between gap-3"><span className="text-slate-400">Dompet</span><span className="font-medium text-right">{selectedWalletData?.name || 'Belum dipilih'}</span></div><div className="flex justify-between gap-3"><span className="text-slate-400">Saldo bulan ini</span><span className="font-medium text-right">{selectedWalletData ? rupiah(selectedWalletData.current_balance) : '-'}</span></div></div></div></section>
            {selectedWalletData && numericAmount > 0 && <section className="liquid-nav rounded-[1.75rem] p-5"><p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">Estimasi setelah transaksi</p><p className="text-2xl font-semibold tracking-[-0.03em] mt-2">{rupiah(selectedWalletData.current_balance + (type === 'income' ? numericAmount : -numericAmount))}</p></section>}
          </aside>
        </div>
      </div>
    </main>
  );
}
