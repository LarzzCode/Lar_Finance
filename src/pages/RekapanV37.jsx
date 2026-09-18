import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { loadAccessibleCategories, rupiah } from '../lib/financeDataV35';

const monthKey = (dateString) => format(parseISO(dateString), 'yyyy-MM');
const monthLabel = (dateString) => format(parseISO(`${dateString}-01`), 'MMMM yyyy', { locale: id });

const StatCard = ({ label, value, tone = 'slate', icon: Icon }) => {
  const toneClass = {
    emerald: 'text-emerald-600 dark:text-emerald-300 bg-emerald-500/8',
    rose: 'text-rose-500 dark:text-rose-300 bg-rose-500/8',
    indigo: 'text-indigo-600 dark:text-indigo-300 bg-indigo-500/8',
    slate: 'text-slate-600 dark:text-slate-300 bg-slate-500/8',
  }[tone];

  return (
    <div className="liquid-nav rounded-[1.8rem] p-5 md:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <span className="text-[10px] uppercase tracking-[0.14em] font-medium text-slate-400">{label}</span>
        <span className={`w-9 h-9 rounded-2xl inline-flex items-center justify-center ${toneClass}`}><Icon size={16} /></span>
      </div>
      <p className="text-xl md:text-2xl font-semibold tracking-[-0.03em]">{value}</p>
    </div>
  );
};

export default function RekapanV37() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);

    const [txRes, catRes, walletRes] = await Promise.all([
      supabase.from('transactions')
        .select('id, amount, transaction_date, description, category_id, wallet_id, payment_method, created_at, tags, categories(name, type), wallets(name)')
        .eq('user_id', user.id)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false }),
      loadAccessibleCategories(supabase, user.id),
      supabase.from('wallets').select('*').eq('user_id', user.id).order('name'),
    ]);

    const error = txRes.error || catRes.error || walletRes.error;
    if (error) toast.error(error.message || 'Gagal memuat laporan');

    setTransactions(txRes.data || []);
    setCategories(catRes.data || []);
    setWallets(walletRes.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    const expenseByCategory = {};

    transactions.forEach((tx) => {
      const amount = Number(tx.amount || 0);
      if (tx.categories?.type === 'income') income += amount;
      else {
        expense += amount;
        const name = tx.categories?.name || 'Lainnya';
        expenseByCategory[name] = (expenseByCategory[name] || 0) + amount;
      }
    });

    return {
      income,
      expense,
      net: income - expense,
      categories: Object.entries(expenseByCategory)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
    };
  }, [transactions]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return transactions;

    return transactions.filter((tx) =>
      (tx.description || '').toLowerCase().includes(term)
      || (tx.categories?.name || '').toLowerCase().includes(term)
      || (tx.wallets?.name || '').toLowerCase().includes(term)
      || (tx.tags || []).some((tag) => String(tag).toLowerCase().includes(term))
    );
  }, [transactions, query]);

  const monthlyGroups = useMemo(() => {
    const map = {};

    filtered.forEach((tx) => {
      const key = monthKey(tx.transaction_date);
      if (!map[key]) map[key] = { key, income: 0, expense: 0, items: [] };
      const amount = Number(tx.amount || 0);
      if (tx.categories?.type === 'income') map[key].income += amount;
      else map[key].expense += amount;
      map[key].items.push(tx);
    });

    return Object.values(map)
      .map((month) => ({ ...month, net: month.income - month.expense }))
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [filtered]);

  const maxMonth = Math.max(1, ...monthlyGroups.flatMap((month) => [month.income, month.expense]));

  const openEdit = (tx) => {
    setSelected(tx);
    setEditForm({
      amount: String(tx.amount || ''),
      description: tx.description || '',
      date: tx.transaction_date,
      category_id: String(tx.category_id || ''),
      wallet_id: String(tx.wallet_id || ''),
    });
  };

  const closeEdit = () => {
    setSelected(null);
    setEditForm(null);
  };

  const saveEdit = async (event) => {
    event.preventDefault();

    const amount = Number(editForm.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) return toast.error('Nominal harus lebih dari 0');

    const category = categories.find((item) => String(item.id) === String(editForm.category_id));
    const wallet = wallets.find((item) => String(item.id) === String(editForm.wallet_id));
    if (!category || !wallet) return toast.error('Kategori atau dompet tidak valid');

    setSaving(true);
    const { error } = await supabase.from('transactions').update({
      amount,
      description: editForm.description.trim() || (category.type === 'income' ? 'Pemasukan' : 'Pengeluaran'),
      transaction_date: editForm.date,
      category_id: category.id,
      wallet_id: wallet.id,
      payment_method: wallet.name,
    }).eq('id', selected.id).eq('user_id', user.id);
    setSaving(false);

    if (error) return toast.error(error.message);

    toast.success('Transaksi diperbarui');
    closeEdit();
    load();
  };

  const remove = async () => {
    if (!selected || !window.confirm('Pindahkan transaksi ini ke Trash? Kamu masih bisa memulihkannya selama 30 hari.')) return;

    const { error } = await supabase.rpc('trash_transaction', { p_transaction_id: selected.id });
    if (error) return toast.error(error.message);

    toast.success('Transaksi dipindahkan ke Trash');
    closeEdit();
    load();
  };

  const exportExcel = () => {
    if (!transactions.length) return toast.error('Belum ada transaksi untuk diekspor');

    const rows = [
      ['LAPORAN KEUANGAN LAR FINANCE'],
      ['Periode: SEMUA WAKTU'],
      [],
      ['Total Pemasukan', summary.income],
      ['Total Pengeluaran', summary.expense],
      ['Net Cashflow', summary.net],
      [],
      ['Bulan', 'Tanggal', 'Kategori', 'Dompet', 'Deskripsi', 'Nominal', 'Jenis', 'Tags'],
      ...transactions.map((tx) => [
        monthLabel(monthKey(tx.transaction_date)),
        tx.transaction_date,
        tx.categories?.name || 'Lainnya',
        tx.wallets?.name || tx.payment_method || 'Manual',
        tx.description || '-',
        Number(tx.amount),
        tx.categories?.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
        (tx.tags || []).join(', '),
      ]),
    ];

    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet['!cols'] = [
      { wch: 18 }, { wch: 14 }, { wch: 22 }, { wch: 18 },
      { wch: 34 }, { wch: 18 }, { wch: 16 }, { wch: 24 },
    ];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Semua Transaksi');
    XLSX.writeFile(book, 'LarFinance_Semua_Waktu.xlsx');
    toast.success('Laporan semua waktu diunduh');
  };

  return (
    <main className="min-h-screen pb-32 md:pb-16 pt-8 md:pt-32 text-slate-900 dark:text-slate-100">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-7 md:mb-9">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] font-medium text-slate-400">Reports · Lifetime</p>
            <h1 className="text-[2rem] md:text-[2.7rem] leading-tight font-semibold tracking-[-0.04em] mt-1">Laporan semua waktu</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Tidak ada reset bulanan. Semua transaksi sejak akun mulai dipakai dibaca sebagai satu histori, lalu dikelompokkan per bulan agar tetap mudah ditelusuri.
            </p>
          </div>

          <button onClick={exportExcel} className="liquid-nav inline-flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-medium self-start lg:self-auto">
            <Download size={15} /> Excel semua waktu
          </button>
        </header>

        <section className="grid sm:grid-cols-3 gap-3 md:gap-4 mb-5">
          <StatCard label="Total pemasukan" value={loading ? '…' : rupiah(summary.income)} tone="emerald" icon={ArrowUpRight} />
          <StatCard label="Total pengeluaran" value={loading ? '…' : rupiah(summary.expense)} tone="rose" icon={ArrowDownRight} />
          <StatCard label="Net keseluruhan" value={loading ? '…' : rupiah(summary.net)} tone={summary.net < 0 ? 'rose' : 'indigo'} icon={summary.net < 0 ? ArrowDownRight : ArrowUpRight} />
        </section>

        <section className="grid lg:grid-cols-[.76fr_1.24fr] gap-5 mb-5">
          <div className="liquid-nav rounded-[2.2rem] p-5 md:p-6">
            <p className="text-[10px] uppercase tracking-[0.15em] font-medium text-slate-400">Kategori terbesar</p>
            <h2 className="text-lg md:text-xl font-semibold mt-1 mb-5">Sepanjang histori</h2>

            {summary.categories.length ? (
              <div className="space-y-4">
                {summary.categories.slice(0, 7).map((item, index) => {
                  const percent = summary.expense > 0 ? (item.value / summary.expense) * 100 : 0;
                  return (
                    <div key={item.name}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-slate-600 dark:text-slate-300 truncate">{index + 1}. {item.name}</span>
                        <span className="font-semibold">{rupiah(item.value)}</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-slate-200/60 dark:bg-white/10 overflow-hidden">
                        <div className="h-full bg-slate-800 dark:bg-slate-200 rounded-full" style={{ width: `${Math.min(percent, 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-14 text-center text-sm text-slate-400">Belum ada pengeluaran.</div>
            )}
          </div>

          <div className="liquid-nav rounded-[2.2rem] p-5 md:p-6">
            <p className="text-[10px] uppercase tracking-[0.15em] font-medium text-slate-400">Monthly rhythm</p>
            <h2 className="text-lg md:text-xl font-semibold mt-1">Arus kas per bulan</h2>
            <p className="text-xs text-slate-400 mt-1 mb-6">Bulan hanya dipakai sebagai pengelompokan visual—total utama tetap kumulatif.</p>

            <div className="space-y-5">
              {[...monthlyGroups].reverse().map((month) => (
                <div key={month.key}>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{monthLabel(month.key)}</span>
                    <span className={`text-xs font-medium ${month.net < 0 ? 'text-rose-500' : 'text-slate-500 dark:text-slate-300'}`}>
                      Net {month.net >= 0 ? '+' : ''}{rupiah(month.net)}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-[82px_1fr_auto] items-center gap-3">
                      <span className="text-[10px] uppercase tracking-wide text-emerald-600 dark:text-emerald-300">Masuk</span>
                      <div className="h-2 rounded-full bg-emerald-500/10 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(month.income ? 4 : 0, (month.income / maxMonth) * 100)}%` }} />
                      </div>
                      <span className="text-xs font-medium">{rupiah(month.income)}</span>
                    </div>
                    <div className="grid grid-cols-[82px_1fr_auto] items-center gap-3">
                      <span className="text-[10px] uppercase tracking-wide text-rose-500">Keluar</span>
                      <div className="h-2 rounded-full bg-rose-500/10 overflow-hidden">
                        <div className="h-full rounded-full bg-rose-500" style={{ width: `${Math.max(month.expense ? 4 : 0, (month.expense / maxMonth) * 100)}%` }} />
                      </div>
                      <span className="text-xs font-medium">{rupiah(month.expense)}</span>
                    </div>
                  </div>
                </div>
              ))}

              {!monthlyGroups.length && <div className="py-16 text-center text-sm text-slate-400">Belum ada data.</div>}
            </div>
          </div>
        </section>

        <section className="liquid-nav rounded-[2.3rem] p-5 md:p-7">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] font-medium text-slate-400">Transactions</p>
              <h2 className="text-xl md:text-2xl font-semibold mt-1">Histori per bulan</h2>
            </div>
            <label className="relative md:w-80">
              <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari transaksi / tag..." className="w-full rounded-2xl pl-10 pr-4 py-3 text-sm font-medium outline-none" />
            </label>
          </div>

          {loading ? (
            <div className="space-y-3">{[1,2,3].map((item) => <div key={item} className="h-20 rounded-2xl bg-white/35 dark:bg-white/[.04] animate-pulse" />)}</div>
          ) : !monthlyGroups.length ? (
            <div className="py-14 text-center text-sm text-slate-400">Belum ada transaksi.</div>
          ) : (
            <div className="space-y-5">
              {monthlyGroups.map((month) => (
                <article key={month.key} className="rounded-[1.9rem] border border-white/65 dark:border-white/10 bg-white/32 dark:bg-white/[.025] overflow-hidden">
                  <div className="px-4 md:px-5 py-4 md:py-5 bg-white/34 dark:bg-white/[.03] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold capitalize">{monthLabel(month.key)}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{month.items.length} transaksi</p>
                    </div>
                    <div className="grid grid-cols-3 gap-4 sm:gap-7">
                      <div>
                        <p className="text-[9px] uppercase tracking-wide text-slate-400">Pemasukan</p>
                        <p className="text-xs md:text-sm font-semibold text-emerald-600 dark:text-emerald-300 mt-1">+{rupiah(month.income)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wide text-slate-400">Pengeluaran</p>
                        <p className="text-xs md:text-sm font-semibold text-rose-500 mt-1">-{rupiah(month.expense)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wide text-slate-400">Net</p>
                        <p className={`text-xs md:text-sm font-semibold mt-1 ${month.net < 0 ? 'text-rose-500' : ''}`}>
                          {month.net >= 0 ? '+' : ''}{rupiah(month.net)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="divide-y divide-white/50 dark:divide-white/10 px-2 md:px-3">
                    {month.items.map((tx) => {
                      const income = tx.categories?.type === 'income';
                      return (
                        <button key={tx.id} onClick={() => openEdit(tx)} className="w-full py-4 px-2 flex items-center justify-between gap-4 text-left hover:bg-white/35 dark:hover:bg-white/[.03] rounded-xl transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${income ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : 'bg-rose-500/10 text-rose-500'}`}>
                              {income ? <ArrowUpRight size={17} /> : <ArrowDownRight size={17} />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{tx.description || tx.categories?.name || 'Transaksi'}</p>
                              <p className="text-[11px] text-slate-400 mt-1 truncate">
                                {format(parseISO(tx.transaction_date), 'EEE, d MMM yyyy', { locale: id })} · {tx.categories?.name || 'Lainnya'} · {tx.wallets?.name || tx.payment_method || 'Manual'}
                              </p>
                              {(tx.tags || []).length > 0 && <p className="text-[10px] text-indigo-500 mt-1 truncate">{tx.tags.map((tag) => `#${tag}`).join(' ')}</p>}
                            </div>
                          </div>
                          <p className={`font-semibold whitespace-nowrap text-sm ${income ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-500'}`}>
                            {income ? '+' : '-'}{rupiah(tx.amount)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <AnimatePresence>
        {selected && editForm && (
          <div className="fixed inset-0 z-[95] bg-slate-950/35 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 28 }} className="liquid-nav w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 md:p-7 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] font-medium text-slate-400">Edit transaksi</p>
                  <h3 className="text-xl font-semibold mt-1">{selected.description || 'Transaksi'}</h3>
                </div>
                <button onClick={closeEdit} className="liquid-nav-pill w-9 h-9 rounded-full flex items-center justify-center"><X size={16} /></button>
              </div>

              <form onSubmit={saveEdit} className="space-y-4">
                <label className="block">
                  <span className="text-[10px] uppercase tracking-wide font-medium text-slate-400">Nominal</span>
                  <input required min="1" type="number" value={editForm.amount} onChange={(event) => setEditForm({ ...editForm, amount: event.target.value })} className="w-full mt-2 rounded-2xl px-4 py-4 font-medium outline-none" />
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase tracking-wide font-medium text-slate-400">Tanggal</span>
                  <input required type="date" value={editForm.date} onChange={(event) => setEditForm({ ...editForm, date: event.target.value })} className="w-full mt-2 rounded-2xl px-4 py-4 font-medium outline-none" />
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase tracking-wide font-medium text-slate-400">Kategori</span>
                  <select required value={editForm.category_id} onChange={(event) => setEditForm({ ...editForm, category_id: event.target.value })} className="w-full mt-2 rounded-2xl px-4 py-4 font-medium outline-none">
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase tracking-wide font-medium text-slate-400">Dompet</span>
                  <select required value={editForm.wallet_id} onChange={(event) => setEditForm({ ...editForm, wallet_id: event.target.value })} className="w-full mt-2 rounded-2xl px-4 py-4 font-medium outline-none">
                    {wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase tracking-wide font-medium text-slate-400">Catatan</span>
                  <textarea rows={3} value={editForm.description} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} className="w-full mt-2 rounded-2xl px-4 py-4 font-medium outline-none resize-none" />
                </label>
                <div className="grid grid-cols-[.65fr_1.35fr] gap-3 pt-2">
                  <button type="button" onClick={remove} className="h-12 rounded-2xl bg-rose-500/10 text-rose-500 font-medium text-sm inline-flex items-center justify-center gap-2">
                    <Trash2 size={15} /> Trash
                  </button>
                  <button disabled={saving} type="submit" className="liquid-primary h-12 rounded-2xl text-white font-semibold text-sm disabled:opacity-60">
                    {saving ? 'Menyimpan…' : 'Simpan perubahan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
