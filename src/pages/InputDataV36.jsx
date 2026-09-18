import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import * as icons from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  calculateWalletBalances,
  currentMonthRange,
  findMatchingRule,
  loadAccessibleCategories,
  rupiah,
} from '../lib/financeDataV35';

const DynamicIcon = ({ name, size = 20 }) => {
  const Icon = icons[name] || icons.HelpCircle;
  return <Icon size={size} />;
};

const newSplitRow = () => ({ category_id: '', amount: '' });

const parseTags = (value) =>
  [...new Set(
    String(value || '')
      .split(',')
      .map((tag) => tag.trim().replace(/^#/, ''))
      .filter(Boolean)
      .map((tag) => tag.slice(0, 40))
  )];

export default function InputDataV36() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [description, setDescription] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedWallet, setSelectedWallet] = useState('');
  const [categories, setCategories] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [rules, setRules] = useState([]);
  const [frequencies, setFrequencies] = useState({});
  const [showAll, setShowAll] = useState(false);
  const [categoryManual, setCategoryManual] = useState(false);
  const [matchedRule, setMatchedRule] = useState(null);
  const [splitMode, setSplitMode] = useState(false);
  const [splits, setSplits] = useState([newSplitRow(), newSplitRow()]);

  const loadData = async () => {
    if (!user) return;
    setDataLoading(true);
    const { start, end } = currentMonthRange();

    const [categoryRes, walletRes, txRes, transferRes, adjustmentRes, ruleRes] = await Promise.all([
      loadAccessibleCategories(supabase, user.id, type),
      supabase.from('wallets').select('*').eq('user_id', user.id).order('created_at'),
      supabase
        .from('transactions')
        .select('amount, wallet_id, category_id, transaction_date, categories(type)')
        .eq('user_id', user.id),
      supabase
        .from('transfers')
        .select('amount, from_wallet_id, to_wallet_id, transfer_date')
        .eq('user_id', user.id),
      supabase
        .from('wallet_adjustments')
        .select('amount, wallet_id, adjustment_date, actual_balance, created_at')
        .eq('user_id', user.id),
      supabase
        .from('category_rules')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('priority')
        .order('created_at'),
    ]);

    const error =
      categoryRes.error
      || walletRes.error
      || txRes.error
      || transferRes.error
      || adjustmentRes.error
      || ruleRes.error;

    if (error) {
      toast.error(error.message || 'Gagal memuat form');
      setDataLoading(false);
      return;
    }

    const txData = txRes.data || [];
    const freq = {};
    txData.forEach((tx) => {
      if (tx.transaction_date >= start && tx.transaction_date <= end && tx.category_id) {
        freq[tx.category_id] = (freq[tx.category_id] || 0) + 1;
      }
    });

    const calculated = calculateWalletBalances(
      walletRes.data || [],
      txData,
      transferRes.data || [],
      adjustmentRes.data || [],
    );

    setCategories(categoryRes.data || []);
    setWallets(calculated);
    setRules(ruleRes.data || []);
    setFrequencies(freq);
    setSelectedCategory('');
    setCategoryManual(false);
    setMatchedRule(null);
    setSelectedWallet((current) =>
      calculated.some((wallet) => String(wallet.id) === String(current))
        ? current
        : calculated[0]?.id || ''
    );
    setDataLoading(false);
  };

  useEffect(() => { loadData(); }, [user, type]);

  useEffect(() => {
    if (splitMode || categoryManual || dataLoading) return;
    const rule = findMatchingRule(rules, { type, description });
    if (!rule) {
      setMatchedRule(null);
      setSelectedCategory('');
      return;
    }

    const categoryAvailable = categories.some((item) => String(item.id) === String(rule.category_id));
    if (!categoryAvailable) return;

    setSelectedCategory(rule.category_id);
    setMatchedRule(rule);

    if (rule.wallet_id && wallets.some((wallet) => String(wallet.id) === String(rule.wallet_id))) {
      setSelectedWallet(rule.wallet_id);
    }
  }, [description, rules, type, splitMode, categoryManual, categories, wallets, dataLoading]);

  const sortedCategories = useMemo(
    () => [...categories].sort(
      (a, b) =>
        (frequencies[b.id] || 0) - (frequencies[a.id] || 0)
        || a.name.localeCompare(b.name)
    ),
    [categories, frequencies],
  );

  const visibleCategories = showAll ? sortedCategories : sortedCategories.slice(0, 6);
  const selectedWalletData = wallets.find((wallet) => String(wallet.id) === String(selectedWallet));
  const selectedCategoryData = categories.find((category) => String(category.id) === String(selectedCategory));
  const numericAmount = Number(amount || 0);
  const formattedAmount = amount ? new Intl.NumberFormat('id-ID').format(amount) : '';

  const splitSum = splits.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const splitDifference = numericAmount - splitSum;
  const splitsValid =
    splitMode
    && splits.length >= 2
    && splits.every((row) => row.category_id && Number(row.amount || 0) > 0)
    && splitSum === numericAmount;

  const previewAmount = numericAmount > 0
    ? `${type === 'expense' ? '-' : '+'}${rupiah(numericAmount)}`
    : rupiah(0);

  const canSubmit =
    numericAmount > 0
    && selectedWallet
    && !loading
    && !dataLoading
    && (splitMode ? splitsValid : Boolean(selectedCategory));

  const changeType = (nextType) => {
    setType(nextType);
    setCategoryManual(false);
    setMatchedRule(null);
    setSelectedCategory('');
    setSplitMode(false);
    setSplits([newSplitRow(), newSplitRow()]);
  };

  const toggleSplit = () => {
    setSplitMode((current) => {
      const next = !current;
      setMatchedRule(null);
      setCategoryManual(false);
      setSelectedCategory('');
      setSplits([newSplitRow(), newSplitRow()]);
      return next;
    });
  };

  const updateSplit = (index, patch) => {
    setSplits((current) => current.map((row, rowIndex) =>
      rowIndex === index ? { ...row, ...patch } : row
    ));
  };

  const removeSplit = (index) => {
    setSplits((current) => current.length <= 2 ? current : current.filter((_, rowIndex) => rowIndex !== index));
  };

  const submit = async (event) => {
    event.preventDefault();
    const wallet = wallets.find((item) => String(item.id) === String(selectedWallet));

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return toast.error('Nominal harus lebih dari 0');
    }
    if (!wallet) return toast.error('Pilih dompet yang valid');

    setLoading(true);

    let result;

    if (splitMode) {
      if (!splitsValid) {
        setLoading(false);
        return toast.error('Total pecahan harus sama persis dengan nominal transaksi');
      }

      const splitGroupId = crypto.randomUUID();
      const payload = splits.map((row) => ({
        user_id: user.id,
        amount: Number(row.amount),
        transaction_date: date,
        description: description.trim() || 'Split transaction',
        category_id: Number(row.category_id),
        wallet_id: wallet.id,
        payment_method: wallet.name || 'Manual',
        split_group_id: splitGroupId,
        tags: parseTags(tagsText),
      }));

      result = await supabase.from('transactions').insert(payload);
    } else {
      const category = categories.find((item) => String(item.id) === String(selectedCategory));
      if (!category || category.type !== type) {
        setLoading(false);
        return toast.error('Pilih kategori yang valid');
      }

      result = await supabase.from('transactions').insert([{
        user_id: user.id,
        amount: numericAmount,
        transaction_date: date,
        description: description.trim() || (type === 'expense' ? 'Pengeluaran' : 'Pemasukan'),
        category_id: category.id,
        wallet_id: wallet.id,
        payment_method: wallet.name || 'Manual',
        tags: parseTags(tagsText),
      }]);
    }

    setLoading(false);

    if (result.error) return toast.error(result.error.message);

    toast.success(
      splitMode
        ? `Split transaksi tersimpan ke ${splits.length} kategori`
        : type === 'expense'
          ? 'Pengeluaran tersimpan'
          : 'Pemasukan tersimpan'
    );
    navigate('/');
  };

  return (
    <main className="min-h-screen pb-32 md:pb-16 pt-8 md:pt-32 text-slate-900 dark:text-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="mb-7 md:mb-9 max-w-3xl">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-700 dark:hover:text-white mb-4"
          >
            <icons.ArrowLeft size={15} /> Kembali
          </button>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400 mb-2">Lar Finance V3.6</p>
          <h1 className="text-[2rem] md:text-[2.7rem] font-semibold tracking-[-0.04em]">Catat arus kas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Auto-category, split transaction, money tags, dan saldo hasil rekonsiliasi sekarang bekerja dalam satu flow.
          </p>
        </header>

        <div className="grid lg:grid-cols-[1.3fr_.7fr] gap-6 lg:gap-8 items-start">
          <form onSubmit={submit} className="space-y-5">
            <section className="liquid-nav rounded-[2.3rem] p-5 md:p-6">
              <div className="grid grid-cols-2 gap-2 p-1.5 rounded-[1.35rem] bg-white/35 dark:bg-white/[.03] border border-white/60 dark:border-white/10">
                {[
                  ['expense', 'Pengeluaran', icons.ArrowUpRight],
                  ['income', 'Pemasukan', icons.ArrowDownLeft],
                ].map(([key, label, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => changeType(key)}
                    className={`py-3.5 px-4 rounded-2xl text-xs font-medium flex items-center justify-center gap-2 ${
                      type === key ? 'liquid-nav-pill text-slate-900 dark:text-white' : 'text-slate-400'
                    }`}
                  >
                    <Icon size={15} /> {label}
                  </button>
                ))}
              </div>

              <div className="pt-9 pb-5 text-center">
                <label htmlFor="transaction-amount" className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400 block mb-3">
                  Nominal transaksi
                </label>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-lg text-slate-300">Rp</span>
                  <input
                    id="transaction-amount"
                    autoFocus
                    inputMode="numeric"
                    value={formattedAmount}
                    onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                    placeholder="0"
                    className={`lf-amount-input max-w-md w-full text-center text-[2.8rem] md:text-[4rem] font-semibold tracking-[-0.05em] ${
                      type === 'expense' ? 'text-rose-500' : 'text-emerald-500'
                    }`}
                  />
                </div>
              </div>
            </section>

            <section className="liquid-nav rounded-[2.3rem] p-6 md:p-8 space-y-7">
              <div className="grid sm:grid-cols-2 gap-5">
                <label>
                  <span className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
                    <icons.CalendarDays size={14} /> Tanggal
                  </span>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full mt-2 rounded-2xl px-4 py-3.5 font-medium text-sm outline-none"
                  />
                </label>

                <label>
                  <span className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
                    <icons.WalletCards size={14} /> Sumber dana
                  </span>
                  <select
                    value={selectedWallet}
                    onChange={(e) => setSelectedWallet(e.target.value)}
                    className="w-full mt-2 rounded-2xl px-4 py-3.5 font-medium text-sm outline-none"
                  >
                    {wallets.map((wallet) => (
                      <option key={wallet.id} value={wallet.id}>
                        {wallet.name} · {rupiah(wallet.current_balance)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
                  <icons.NotebookPen size={14} /> Catatan / merchant
                </span>
                <textarea
                  rows={3}
                  maxLength={180}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Contoh: Pertamina, Indomaret, makan siang..."
                  className="w-full mt-2 resize-none rounded-2xl px-4 py-4 font-medium text-sm outline-none"
                />
              </label>

              <label className="block">
                <span className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
                  <icons.Hash size={14} /> Money tags · opsional
                </span>
                <input
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                  placeholder="kuliah, motor, liburanBandung"
                  className="w-full mt-2 rounded-2xl px-4 py-4 font-medium text-sm outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">Pisahkan dengan koma. Contoh: motor, mudik</p>
              </label>

              {!splitMode && matchedRule && (
                <div className="rounded-2xl bg-indigo-500/[.07] border border-indigo-500/10 p-4 flex gap-3">
                  <icons.Sparkles size={17} className="text-indigo-500 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Auto-category aktif</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      Rule “{matchedRule.name || matchedRule.match_value}” memilih {selectedCategoryData?.name || 'kategori'}.
                      Kamu tetap bisa menggantinya manual.
                    </p>
                  </div>
                </div>
              )}

              <div className="rounded-[1.7rem] bg-white/30 dark:bg-white/[.025] border border-white/60 dark:border-white/10 p-4 flex items-center justify-between gap-4">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-300 flex items-center justify-center shrink-0">
                    <icons.SplitSquareHorizontal size={17} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Split transaction</p>
                    <p className="text-[11px] text-slate-400 mt-1">Satu pembayaran bisa dibagi ke beberapa kategori.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleSplit}
                  className={`w-12 h-7 rounded-full p-1 transition ${
                    splitMode ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-white/10'
                  }`}
                  aria-pressed={splitMode}
                >
                  <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${splitMode ? 'translate-x-5' : ''}`} />
                </button>
              </div>

              {splitMode ? (
                <div>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <span className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
                      <icons.ListChecks size={14} /> Pecahan kategori
                    </span>
                    <button
                      type="button"
                      onClick={() => setSplits((current) => [...current, newSplitRow()])}
                      className="text-xs font-medium text-indigo-600 dark:text-indigo-300"
                    >
                      + Tambah baris
                    </button>
                  </div>

                  <div className="space-y-3">
                    {splits.map((row, index) => (
                      <div key={index} className="grid grid-cols-[1fr_132px_auto] gap-2 items-center">
                        <select
                          value={row.category_id}
                          onChange={(e) => updateSplit(index, { category_id: e.target.value })}
                          className="min-w-0 rounded-2xl px-3 py-3 text-sm font-medium outline-none"
                        >
                          <option value="">Pilih kategori</option>
                          {sortedCategories.map((category) => (
                            <option key={category.id} value={category.id}>{category.name}</option>
                          ))}
                        </select>
                        <input
                          inputMode="numeric"
                          value={row.amount}
                          onChange={(e) => updateSplit(index, { amount: e.target.value.replace(/\D/g, '') })}
                          placeholder="Nominal"
                          className="min-w-0 rounded-2xl px-3 py-3 text-sm font-medium outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => removeSplit(index)}
                          disabled={splits.length <= 2}
                          className="w-10 h-10 rounded-xl text-slate-400 disabled:opacity-20"
                          aria-label="Hapus pecahan"
                        >
                          <icons.MinusCircle size={17} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className={`mt-4 rounded-2xl p-4 text-xs ${
                    splitDifference === 0 && numericAmount > 0
                      ? 'bg-emerald-500/[.07] text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-500/[.08] text-amber-700 dark:text-amber-300'
                  }`}>
                    Total pecahan {rupiah(splitSum)}
                    {numericAmount > 0 && (
                      <span> · {splitDifference === 0 ? 'sudah pas' : `selisih ${rupiah(Math.abs(splitDifference))}`}</span>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
                      <icons.Tags size={14} /> Kategori
                    </span>
                    <div className="flex items-center gap-3">
                      <Link to="/rules" className="text-[10px] text-indigo-600 dark:text-indigo-300">Atur rule</Link>
                      {sortedCategories.length > 6 && (
                        <button
                          type="button"
                          onClick={() => setShowAll((value) => !value)}
                          className="text-[10px] text-slate-400"
                        >
                          {showAll ? 'Ringkas' : 'Lihat semua'}
                        </button>
                      )}
                    </div>
                  </div>

                  {dataLoading ? (
                    <div className="p-6 text-center text-sm text-slate-400">Memuat kategori…</div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {visibleCategories.map((category) => {
                        const active = String(selectedCategory) === String(category.id);
                        return (
                          <button
                            key={category.id}
                            type="button"
                            onClick={() => {
                              setSelectedCategory(category.id);
                              setCategoryManual(true);
                              setMatchedRule(null);
                            }}
                            className={`p-4 rounded-2xl border text-left ${
                              active
                                ? type === 'expense'
                                  ? 'border-rose-300/40 bg-rose-500/[.08]'
                                  : 'border-emerald-300/40 bg-emerald-500/[.08]'
                                : 'border-white/60 dark:border-white/10 bg-white/[.32] dark:bg-white/[.025]'
                            }`}
                          >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                              active
                                ? type === 'expense'
                                  ? 'bg-rose-500/10 text-rose-500'
                                  : 'bg-emerald-500/10 text-emerald-600'
                                : 'bg-slate-500/[.08] text-slate-500'
                            }`}>
                              <DynamicIcon name={category.icon} size={18} />
                            </div>
                            <p className="font-medium text-sm truncate">{category.name}</p>
                            <p className="text-[10px] text-slate-400 mt-1">Dipakai {frequencies[category.id] || 0}× bulan ini</p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <button
                disabled={!canSubmit}
                className={`w-full rounded-2xl py-4 text-sm font-semibold text-white disabled:opacity-40 ${
                  type === 'expense' ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
              >
                {loading
                  ? 'Menyimpan…'
                  : splitMode
                    ? `Simpan split ke ${splits.length} kategori`
                    : `Simpan ${type === 'expense' ? 'Pengeluaran' : 'Pemasukan'}`}
              </button>
            </section>
          </form>

          <aside className="lg:sticky lg:top-28 space-y-4">
            <section className="liquid-nav rounded-[2.2rem] p-6 md:p-7">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Preview transaksi</p>
              <p className={`text-3xl font-semibold mt-2 ${
                numericAmount === 0
                  ? 'text-slate-400'
                  : type === 'expense'
                    ? 'text-rose-500'
                    : 'text-emerald-600'
              }`}>
                {previewAmount}
              </p>

              <div className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-400">Mode</span>
                  <span className="font-medium">{splitMode ? `Split ${splits.length} kategori` : 'Satu kategori'}</span>
                </div>
                {!splitMode && (
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-400">Kategori</span>
                    <span className="font-medium">{selectedCategoryData?.name || 'Belum dipilih'}</span>
                  </div>
                )}
                <div className="flex justify-between gap-3">
                  <span className="text-slate-400">Dompet</span>
                  <span className="font-medium">{selectedWalletData?.name || 'Belum dipilih'}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-400">Saldo saat ini</span>
                  <span className="font-medium">{selectedWalletData ? rupiah(selectedWalletData.current_balance) : '-'}</span>
                </div>
              </div>
            </section>

            {selectedWalletData && numericAmount > 0 && (
              <section className="liquid-nav rounded-[1.8rem] p-5">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Estimasi setelah transaksi</p>
                <p className={`text-2xl font-semibold mt-2 ${
                  selectedWalletData.current_balance + (type === 'income' ? numericAmount : -numericAmount) < 0
                    ? 'text-rose-500'
                    : ''
                }`}>
                  {rupiah(selectedWalletData.current_balance + (type === 'income' ? numericAmount : -numericAmount))}
                </p>
              </section>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
