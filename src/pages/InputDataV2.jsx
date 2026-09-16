import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import * as icons from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const DynamicIcon = ({ name, size = 20, className = '' }) => {
  const LucideIcon = icons[name] || icons.HelpCircle;
  return <LucideIcon size={size} className={className} />;
};

const rupiah = (value) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

export default function InputDataV2() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedWallet, setSelectedWallet] = useState('');
  const [categories, setCategories] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [categoryFrequencies, setCategoryFrequencies] = useState({});
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchCategories();
    fetchWalletsAndCalculate();
  }, [user, type]);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('type', type)
      .order('name');

    if (error) {
      toast.error('Gagal memuat kategori');
      return;
    }

    setCategories(data || []);
    setSelectedCategory('');
  };

  const fetchWalletsAndCalculate = async () => {
    const now = new Date();
    const startDate = format(startOfMonth(now), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(now), 'yyyy-MM-dd');

    const [{ data: walletData, error: walletError }, { data: txData, error: txError }] = await Promise.all([
      supabase.from('wallets').select('*').order('created_at'),
      supabase
        .from('transactions')
        .select('amount, wallet_id, category_id, categories(type)')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate),
    ]);

    if (walletError || txError) {
      toast.error('Gagal memuat data dompet');
      return;
    }

    const freq = {};
    (txData || []).forEach((tx) => {
      if (tx.category_id) freq[tx.category_id] = (freq[tx.category_id] || 0) + 1;
    });
    setCategoryFrequencies(freq);

    const calculatedWallets = (walletData || []).map((wallet) => {
      const walletTx = (txData || []).filter((tx) => String(tx.wallet_id) === String(wallet.id));
      const income = walletTx
        .filter((tx) => tx.categories?.type === 'income')
        .reduce((sum, tx) => sum + Number(tx.amount), 0);
      const expense = walletTx
        .filter((tx) => tx.categories?.type === 'expense')
        .reduce((sum, tx) => sum + Number(tx.amount), 0);

      return {
        ...wallet,
        balance: (Number(wallet.saldo_awal) || 0) + income - expense,
      };
    });

    setWallets(calculatedWallets);
    setSelectedWallet((current) => current || calculatedWallets[0]?.id || '');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!amount || !selectedCategory || !selectedWallet) {
      toast.error('Lengkapi nominal, kategori, dan sumber dana');
      return;
    }

    setLoading(true);

    try {
      const wallet = wallets.find((item) => String(item.id) === String(selectedWallet));
      const { error } = await supabase.from('transactions').insert([
        {
          user_id: user.id,
          amount: Number(amount),
          transaction_date: date,
          description: description.trim() || (type === 'expense' ? 'Pengeluaran' : 'Pemasukan'),
          category_id: selectedCategory,
          wallet_id: selectedWallet,
          payment_method: wallet?.name || 'Manual',
        },
      ]);

      if (error) throw error;

      toast.success(type === 'expense' ? 'Pengeluaran tersimpan' : 'Pemasukan tersimpan');
      navigate('/');
    } catch (error) {
      toast.error(`Gagal menyimpan: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const sortedCategories = useMemo(
    () =>
      [...categories].sort(
        (a, b) => (categoryFrequencies[b.id] || 0) - (categoryFrequencies[a.id] || 0),
      ),
    [categories, categoryFrequencies],
  );

  const selectedCategoryData = categories.find(
    (category) => String(category.id) === String(selectedCategory),
  );
  const selectedWalletData = wallets.find(
    (wallet) => String(wallet.id) === String(selectedWallet),
  );

  const topCategories = sortedCategories.slice(0, 6);
  const selectedOutsideTop =
    selectedCategoryData && !topCategories.some((item) => item.id === selectedCategoryData.id);
  const displayCategories = selectedOutsideTop
    ? [...topCategories.slice(0, 5), selectedCategoryData]
    : topCategories;

  const accent = type === 'expense' ? 'rose' : 'emerald';
  const formattedAmount = amount ? new Intl.NumberFormat('id-ID').format(amount) : '';

  return (
    <main className="min-h-screen bg-[#F6F7F9] pb-32 md:pb-16 md:pt-28 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 md:pt-6">
        <div className="flex items-start justify-between gap-4 mb-7">
          <div>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors mb-4"
            >
              <icons.ArrowLeft size={15} /> Kembali ke dashboard
            </button>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 mb-1">Transaksi baru</p>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">Catat arus kas.</h1>
            <p className="text-sm text-slate-500 mt-2 max-w-xl">
              Masukkan transaksi dengan cepat. Data lama dan struktur database tetap menggunakan alur Lar Finance yang sama.
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)] gap-6 lg:gap-8 items-start">
          <form onSubmit={handleSubmit} className="space-y-5">
            <section className="bg-white border border-slate-200/70 rounded-[2rem] shadow-sm overflow-hidden">
              <div className="p-2 bg-slate-100/80 grid grid-cols-2 gap-2 m-5 mb-0 rounded-2xl">
                {[
                  { key: 'expense', label: 'Pengeluaran', icon: icons.ArrowUpRight },
                  { key: 'income', label: 'Pemasukan', icon: icons.ArrowDownLeft },
                ].map(({ key, label, icon: Icon }) => {
                  const active = type === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setType(key)}
                      className={`relative py-3.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                        active
                          ? key === 'expense'
                            ? 'bg-white text-rose-600 shadow-sm'
                            : 'bg-white text-emerald-600 shadow-sm'
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <Icon size={16} /> {label}
                    </button>
                  );
                })}
              </div>

              <div className="px-6 md:px-8 pt-8 pb-9 text-center">
                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 block mb-3">
                  Nominal transaksi
                </label>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-xl md:text-2xl font-black text-slate-300">Rp</span>
                  <input
                    autoFocus
                    inputMode="numeric"
                    type="text"
                    placeholder="0"
                    value={formattedAmount}
                    onChange={(event) => setAmount(event.target.value.replace(/\D/g, ''))}
                    className={`min-w-0 w-full max-w-md bg-transparent outline-none text-center text-4xl md:text-6xl font-black tracking-tight placeholder:text-slate-200 ${
                      type === 'expense' ? 'text-rose-500' : 'text-emerald-500'
                    }`}
                  />
                </div>
              </div>
            </section>

            <section className="bg-white border border-slate-200/70 rounded-[2rem] shadow-sm p-6 md:p-8 space-y-7">
              <div className="grid sm:grid-cols-2 gap-5">
                <label className="block">
                  <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 mb-2">
                    <icons.CalendarDays size={14} /> Tanggal
                  </span>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 font-bold text-sm outline-none focus:ring-4 focus:ring-slate-100 focus:bg-white"
                  />
                </label>

                <label className="block">
                  <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 mb-2">
                    <icons.WalletCards size={14} /> Sumber dana
                  </span>
                  <select
                    value={selectedWallet || ''}
                    onChange={(event) => setSelectedWallet(event.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 font-bold text-sm outline-none focus:ring-4 focus:ring-slate-100 focus:bg-white"
                    required
                  >
                    <option value="" disabled>Pilih dompet</option>
                    {wallets.map((wallet) => (
                      <option key={wallet.id} value={wallet.id}>
                        {wallet.name} · {rupiah(wallet.balance)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div>
                <div className="flex items-center justify-between gap-4 mb-3">
                  <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                    <icons.Tags size={14} /> Kategori
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(true)}
                    className="text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-700"
                  >
                    Lihat semua
                  </button>
                </div>

                {displayCategories.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {displayCategories.map((category) => {
                      const active = String(selectedCategory) === String(category.id);
                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => setSelectedCategory(category.id)}
                          className={`p-4 rounded-2xl border text-left transition-all ${
                            active
                              ? type === 'expense'
                                ? 'border-rose-200 bg-rose-50 ring-2 ring-rose-100'
                                : 'border-emerald-200 bg-emerald-50 ring-2 ring-emerald-100'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                            active
                              ? type === 'expense'
                                ? 'bg-rose-100 text-rose-600'
                                : 'bg-emerald-100 text-emerald-600'
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            <DynamicIcon name={category.icon} size={19} />
                          </div>
                          <p className="font-black text-sm truncate">{category.name}</p>
                          <p className="text-[10px] text-slate-400 mt-1">
                            Dipakai {categoryFrequencies[category.id] || 0}× bulan ini
                          </p>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                    Belum ada kategori untuk jenis transaksi ini.
                  </div>
                )}
              </div>

              <label className="block">
                <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 mb-2">
                  <icons.NotebookPen size={14} /> Catatan
                </span>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Contoh: makan siang, gaji freelance, bensin..."
                  className="w-full resize-none bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 font-medium text-sm outline-none focus:ring-4 focus:ring-slate-100 focus:bg-white"
                />
              </label>

              <button
                type="submit"
                disabled={loading}
                className={`w-full rounded-2xl py-4 px-5 text-sm font-black text-white shadow-lg transition-all active:scale-[0.99] disabled:opacity-60 ${
                  type === 'expense'
                    ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-200'
                    : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200'
                }`}
              >
                {loading ? 'Menyimpan...' : `Simpan ${type === 'expense' ? 'Pengeluaran' : 'Pemasukan'}`}
              </button>
            </section>
          </form>

          <aside className="lg:sticky lg:top-28 space-y-4">
            <section className="bg-slate-950 text-white rounded-[2rem] p-6 md:p-7 shadow-xl overflow-hidden relative">
              <div className={`absolute -right-16 -top-16 w-44 h-44 rounded-full blur-3xl opacity-30 ${
                type === 'expense' ? 'bg-rose-500' : 'bg-emerald-500'
              }`} />
              <div className="relative">
                <p className="text-[10px] uppercase tracking-[0.18em] font-black text-slate-500 mb-4">Preview transaksi</p>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-400">{type === 'expense' ? 'Pengeluaran' : 'Pemasukan'}</p>
                    <p className="text-3xl font-black tracking-tight mt-1">{rupiah(amount)}</p>
                  </div>
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                    type === 'expense' ? 'bg-rose-500/15 text-rose-300' : 'bg-emerald-500/15 text-emerald-300'
                  }`}>
                    {type === 'expense' ? <icons.ArrowUpRight size={22} /> : <icons.ArrowDownLeft size={22} />}
                  </div>
                </div>

                <div className="mt-7 pt-5 border-t border-white/10 space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Dompet</span>
                    <span className="font-bold text-right">{selectedWalletData?.name || 'Belum dipilih'}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Saldo saat ini</span>
                    <span className="font-bold text-right">{selectedWalletData ? rupiah(selectedWalletData.balance) : '—'}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Kategori</span>
                    <span className="font-bold text-right">{selectedCategoryData?.name || 'Belum dipilih'}</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white border border-slate-200/70 rounded-[2rem] p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <icons.Sparkles size={19} />
                </div>
                <div>
                  <p className="font-black text-sm">Input cepat</p>
                  <p className="text-[11px] text-slate-400">Tips untuk pencatatan yang rapi.</p>
                </div>
              </div>
              <div className="space-y-3 text-xs leading-relaxed text-slate-500">
                <p>• Kategori diurutkan berdasarkan yang paling sering kamu gunakan bulan ini.</p>
                <p>• Saldo dompet dihitung menggunakan logika Lar Finance yang sama seperti versi sebelumnya.</p>
                <p>• Tidak ada perubahan pada tabel atau data existing di database.</p>
              </div>
            </section>
          </aside>
        </div>
      </div>

      <AnimatePresence>
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-slate-950/45 backdrop-blur-sm p-0 sm:p-4">
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="w-full max-w-2xl bg-white rounded-t-[2rem] sm:rounded-[2rem] p-6 shadow-2xl max-h-[82vh] overflow-hidden"
            >
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-5 sm:hidden" />
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="font-black text-lg">Pilih kategori</p>
                  <p className="text-xs text-slate-400 mt-1">Semua kategori {type === 'expense' ? 'pengeluaran' : 'pemasukan'}.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"
                >
                  <icons.X size={17} />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 overflow-y-auto max-h-[60vh] pr-1">
                {categories.map((category) => {
                  const active = String(selectedCategory) === String(category.id);
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(category.id);
                        setIsCategoryModalOpen(false);
                      }}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        active
                          ? type === 'expense'
                            ? 'bg-rose-50 border-rose-200'
                            : 'bg-emerald-50 border-emerald-200'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center mb-3">
                        <DynamicIcon name={category.icon} size={19} />
                      </div>
                      <p className="font-black text-sm truncate">{category.name}</p>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
