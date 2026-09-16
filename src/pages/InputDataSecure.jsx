import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import toast from 'react-hot-toast';
import * as icons from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const rupiah = (value) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const DynamicIcon = ({ name, size = 20 }) => {
  const Icon = icons[name] || icons.HelpCircle;
  return <Icon size={size} />;
};

export default function InputDataSecure() {
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
  const [categoryFrequencies, setCategoryFrequencies] = useState({});
  const [showAllCategories, setShowAllCategories] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadFormData();
  }, [user, type]);

  const loadFormData = async () => {
    if (!user) return;
    setDataLoading(true);
    const now = new Date();
    const start = format(startOfMonth(now), 'yyyy-MM-dd');
    const end = format(endOfMonth(now), 'yyyy-MM-dd');

    const [categoryRes, walletRes, txRes] = await Promise.all([
      supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', type)
        .order('name'),
      supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at'),
      supabase
        .from('transactions')
        .select('amount, wallet_id, category_id, categories(type)')
        .eq('user_id', user.id)
        .gte('transaction_date', start)
        .lte('transaction_date', end),
    ]);

    if (categoryRes.error || walletRes.error || txRes.error) {
      toast.error(categoryRes.error?.message || walletRes.error?.message || txRes.error?.message || 'Gagal memuat form transaksi');
      setDataLoading(false);
      return;
    }

    const txData = txRes.data || [];
    const freq = {};
    txData.forEach((tx) => {
      if (tx.category_id) freq[tx.category_id] = (freq[tx.category_id] || 0) + 1;
    });

    const calculatedWallets = (walletRes.data || []).map((wallet) => {
      const walletTransactions = txData.filter((tx) => String(tx.wallet_id) === String(wallet.id));
      const income = walletTransactions
        .filter((tx) => tx.categories?.type === 'income')
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      const expense = walletTransactions
        .filter((tx) => tx.categories?.type === 'expense')
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      return {
        ...wallet,
        balance: Number(wallet.saldo_awal || 0) + income - expense,
      };
    });

    setCategories(categoryRes.data || []);
    setCategoryFrequencies(freq);
    setWallets(calculatedWallets);
    setSelectedCategory('');
    setSelectedWallet((current) => {
      const stillValid = calculatedWallets.some((wallet) => String(wallet.id) === String(current));
      return stillValid ? current : calculatedWallets[0]?.id || '';
    });
    setDataLoading(false);
  };

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => (categoryFrequencies[b.id] || 0) - (categoryFrequencies[a.id] || 0)),
    [categories, categoryFrequencies],
  );

  const visibleCategories = showAllCategories ? sortedCategories : sortedCategories.slice(0, 6);
  const selectedWalletData = wallets.find((wallet) => String(wallet.id) === String(selectedWallet));
  const selectedCategoryData = categories.find((category) => String(category.id) === String(selectedCategory));
  const numericAmount = Number(amount || 0);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user) return;

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast.error('Nominal transaksi harus lebih dari 0');
      return;
    }

    const category = categories.find((item) => String(item.id) === String(selectedCategory));
    const wallet = wallets.find((item) => String(item.id) === String(selectedWallet));
    if (!category || category.type !== type) {
      toast.error('Kategori tidak valid untuk jenis transaksi ini');
      return;
    }
    if (!wallet) {
      toast.error('Dompet tidak valid atau sudah tidak tersedia');
      return;
    }

    setLoading(true);
    const { error } = await supabase.from('transactions').insert([
      {
        user_id: user.id,
        amount: numericAmount,
        transaction_date: date,
        description: description.trim() || (type === 'expense' ? 'Pengeluaran' : 'Pemasukan'),
        category_id: category.id,
        wallet_id: wallet.id,
        payment_method: wallet.name || 'Manual',
      },
    ]);

    setLoading(false);
    if (error) {
      toast.error(`Gagal menyimpan: ${error.message}`);
      return;
    }

    toast.success(type === 'expense' ? 'Pengeluaran tersimpan' : 'Pemasukan tersimpan');
    navigate('/');
  };

  const accent = type === 'expense' ? 'rose' : 'emerald';
  const formattedAmount = amount ? new Intl.NumberFormat('id-ID').format(amount) : '';

  return (
    <main className="min-h-screen bg-[#F6F7F9] pb-32 md:pb-16 md:pt-28 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 md:pt-6">
        <header className="mb-7">
          <button onClick={() => navigate('/')} className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-700 mb-4">
            <icons.ArrowLeft size={15} /> Kembali ke dashboard
          </button>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 mb-1">Transaksi baru</p>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Catat arus kas.</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl">Setiap pilihan kategori dan dompet diverifikasi terhadap akun yang sedang login sebelum transaksi disimpan.</p>
        </header>

        <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)] gap-6 lg:gap-8 items-start">
          <form onSubmit={handleSubmit} className="space-y-5">
            <section className="bg-white border border-slate-200/70 rounded-[2rem] shadow-sm overflow-hidden">
              <div className="p-2 bg-slate-100/80 grid grid-cols-2 gap-2 m-5 mb-0 rounded-2xl">
                {[
                  ['expense', 'Pengeluaran', icons.ArrowUpRight],
                  ['income', 'Pemasukan', icons.ArrowDownLeft],
                ].map(([key, label, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setType(key)}
                    className={`py-3.5 px-4 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${
                      type === key
                        ? key === 'expense'
                          ? 'bg-white text-rose-600 shadow-sm'
                          : 'bg-white text-emerald-600 shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <Icon size={16} /> {label}
                  </button>
                ))}
              </div>

              <div className="px-6 md:px-8 pt-8 pb-9 text-center">
                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 block mb-3">Nominal transaksi</label>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-xl md:text-2xl font-black text-slate-300">Rp</span>
                  <input
                    autoFocus
                    inputMode="numeric"
                    type="text"
                    placeholder="0"
                    value={formattedAmount}
                    onChange={(event) => setAmount(event.target.value.replace(/\D/g, ''))}
                    className={`min-w-0 w-full max-w-md bg-transparent outline-none text-center text-4xl md:text-6xl font-black tracking-tight placeholder:text-slate-200 ${type === 'expense' ? 'text-rose-500' : 'text-emerald-500'}`}
                  />
                </div>
              </div>
            </section>

            <section className="bg-white border border-slate-200/70 rounded-[2rem] shadow-sm p-6 md:p-8 space-y-7">
              <div className="grid sm:grid-cols-2 gap-5">
                <label className="block">
                  <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 mb-2"><icons.CalendarDays size={14} /> Tanggal</span>
                  <input type="date" required value={date} onChange={(event) => setDate(event.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 font-bold text-sm outline-none focus:ring-4 focus:ring-slate-100 focus:bg-white" />
                </label>

                <label className="block">
                  <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 mb-2"><icons.WalletCards size={14} /> Sumber dana</span>
                  <select value={selectedWallet || ''} onChange={(event) => setSelectedWallet(event.target.value)} disabled={dataLoading || !wallets.length} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 font-bold text-sm outline-none focus:ring-4 focus:ring-slate-100 focus:bg-white disabled:opacity-60" required>
                    <option value="" disabled>{dataLoading ? 'Memuat dompet...' : 'Pilih dompet'}</option>
                    {wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} · {rupiah(wallet.balance)}</option>)}
                  </select>
                </label>
              </div>

              <div>
                <div className="flex items-center justify-between gap-4 mb-3">
                  <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400"><icons.Tags size={14} /> Kategori</span>
                  {sortedCategories.length > 6 && (
                    <button type="button" onClick={() => setShowAllCategories((value) => !value)} className="text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-700">
                      {showAllCategories ? 'Ringkas' : 'Lihat semua'}
                    </button>
                  )}
                </div>

                {dataLoading ? (
                  <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-400">Memuat kategori...</div>
                ) : visibleCategories.length ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {visibleCategories.map((category) => {
                      const active = String(selectedCategory) === String(category.id);
                      return (
                        <button key={category.id} type="button" onClick={() => setSelectedCategory(category.id)} className={`p-4 rounded-2xl border text-left transition-all ${active ? type === 'expense' ? 'border-rose-200 bg-rose-50 ring-2 ring-rose-100' : 'border-emerald-200 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${active ? type === 'expense' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}><DynamicIcon name={category.icon} size={19} /></div>
                          <p className="font-black text-sm truncate">{category.name}</p>
                          <p className="text-[10px] text-slate-400 mt-1">Dipakai {categoryFrequencies[category.id] || 0}× bulan ini</p>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">Belum ada kategori untuk jenis transaksi ini.</div>
                )}
              </div>

              <label className="block">
                <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 mb-2"><icons.NotebookPen size={14} /> Catatan</span>
                <textarea rows={3} value={description} maxLength={180} onChange={(event) => setDescription(event.target.value)} placeholder="Contoh: makan siang, gaji freelance, bensin..." className="w-full resize-none bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 font-medium text-sm outline-none focus:ring-4 focus:ring-slate-100 focus:bg-white" />
                <span className="block text-right text-[10px] text-slate-400 mt-1">{description.length}/180</span>
              </label>

              <button type="submit" disabled={loading || dataLoading || !wallets.length || !categories.length} className={`w-full rounded-2xl py-4 px-5 text-sm font-black text-white shadow-lg transition-all active:scale-[0.99] disabled:opacity-50 ${type === 'expense' ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-200' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200'}`}>
                {loading ? 'Menyimpan...' : `Simpan ${type === 'expense' ? 'Pengeluaran' : 'Pemasukan'}`}
              </button>
            </section>
          </form>

          <aside className="lg:sticky lg:top-28 space-y-4">
            <section className="bg-slate-950 text-white rounded-[2rem] p-6 md:p-7 shadow-xl overflow-hidden relative">
              <div className={`absolute -right-16 -top-16 w-44 h-44 rounded-full blur-3xl opacity-30 ${type === 'expense' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
              <div className="relative">
                <p className="text-[10px] uppercase tracking-[0.18em] font-black text-slate-500 mb-2">Preview transaksi</p>
                <p className={`text-3xl font-black ${type === 'expense' ? 'text-rose-300' : 'text-emerald-300'}`}>{numericAmount > 0 ? `${type === 'expense' ? '-' : '+'}${rupiah(numericAmount)}` : rupiah(0)}</p>
                <div className="mt-6 space-y-3 text-sm">
                  <div className="flex justify-between gap-3"><span className="text-slate-500">Dompet</span><span className="font-bold text-right">{selectedWalletData?.name || '-'}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-slate-500">Kategori</span><span className="font-bold text-right">{selectedCategoryData?.name || '-'}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-slate-500">Tanggal</span><span className="font-bold text-right">{date}</span></div>
                </div>
              </div>
            </section>

            <section className={`rounded-[2rem] border p-5 ${accent === 'rose' ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
              <icons.ShieldCheck size={20} className={accent === 'rose' ? 'text-rose-500' : 'text-emerald-600'} />
              <p className="font-black mt-3">Owner-scoped input</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">Kategori, dompet, dan histori yang dipakai form ini difilter dengan user ID akun aktif sebelum transaksi dibuat.</p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
