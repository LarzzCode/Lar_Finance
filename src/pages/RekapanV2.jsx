import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Pencil,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const COLORS = ['#0f172a', '#4f46e5', '#10b981', '#f43f5e', '#f59e0b', '#06b6d4', '#8b5cf6', '#64748b'];

const rupiah = (value) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

export default function RekapanV2() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [activeTab, setActiveTab] = useState('expense');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd');

    const [txRes, catRes, walletRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*, categories(name, type, icon), wallets(name)')
        .eq('user_id', user.id)
        .gte('transaction_date', start)
        .lte('transaction_date', end)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('categories').select('*').eq('user_id', user.id).order('name'),
      supabase.from('wallets').select('*').eq('user_id', user.id).order('name'),
    ]);

    if (txRes.error) toast.error('Gagal memuat laporan');
    setTransactions(txRes.data || []);
    setCategories(catRes.data || []);
    setWallets(walletRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [user, currentDate]);

  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    const expenseByCategory = {};

    transactions.forEach((tx) => {
      const value = Number(tx.amount) || 0;
      if (tx.categories?.type === 'income') income += value;
      else {
        expense += value;
        const name = tx.categories?.name || 'Lainnya';
        expenseByCategory[name] = (expenseByCategory[name] || 0) + value;
      }
    });

    return {
      income,
      expense,
      net: income - expense,
      expenseByCategory: Object.entries(expenseByCategory)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
    };
  }, [transactions]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return transactions.filter((tx) => {
      const typeMatch = tx.categories?.type === activeTab;
      const searchMatch =
        !normalized ||
        (tx.description || '').toLowerCase().includes(normalized) ||
        (tx.categories?.name || '').toLowerCase().includes(normalized) ||
        (tx.wallets?.name || tx.payment_method || '').toLowerCase().includes(normalized);
      return typeMatch && searchMatch;
    });
  }, [transactions, activeTab, query]);

  const dailyData = useMemo(() => {
    const grouped = {};
    filtered.forEach((tx) => {
      const key = format(parseISO(tx.transaction_date), 'dd MMM', { locale: id });
      grouped[key] = (grouped[key] || 0) + Number(tx.amount || 0);
    });
    return Object.entries(grouped)
      .reverse()
      .slice(-10)
      .map(([date, total]) => ({ date, total }));
  }, [filtered]);

  const groupedTransactions = useMemo(() => {
    return filtered.reduce((acc, tx) => {
      const key = format(parseISO(tx.transaction_date), 'EEEE, dd MMMM', { locale: id });
      if (!acc[key]) acc[key] = [];
      acc[key].push(tx);
      return acc;
    }, {});
  }, [filtered]);

  const changeMonth = (offset) => {
    const next = new Date(currentDate);
    next.setMonth(next.getMonth() + offset);
    setCurrentDate(next);
  };

  const openEdit = (tx) => {
    setSelectedTx(tx);
    setEditForm({
      amount: String(tx.amount || ''),
      description: tx.description || '',
      date: tx.transaction_date,
      category_id: tx.category_id || '',
      wallet_id: tx.wallet_id || '',
    });
  };

  const closeEdit = () => {
    setSelectedTx(null);
    setEditForm(null);
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    if (!selectedTx || !editForm) return;
    const selectedWallet = wallets.find((wallet) => String(wallet.id) === String(editForm.wallet_id));
    const { error } = await supabase
      .from('transactions')
      .update({
        amount: Number(editForm.amount),
        description: editForm.description,
        transaction_date: editForm.date,
        category_id: editForm.category_id,
        wallet_id: editForm.wallet_id,
        payment_method: selectedWallet?.name || selectedTx.payment_method || 'Manual',
      })
      .eq('id', selectedTx.id)
      .eq('user_id', user.id);

    if (error) return toast.error(error.message);
    toast.success('Transaksi diperbarui');
    closeEdit();
    loadData();
  };

  const handleDelete = async () => {
    if (!selectedTx || !window.confirm('Hapus transaksi ini permanen?')) return;
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', selectedTx.id)
      .eq('user_id', user.id);
    if (error) return toast.error(error.message);
    toast.success('Transaksi dihapus');
    closeEdit();
    loadData();
  };

  const handleExportExcel = () => {
    if (!transactions.length) return toast.error('Belum ada data di bulan ini');

    const rows = [
      ['LAPORAN KEUANGAN LAR FINANCE'],
      [`Periode: ${format(currentDate, 'MMMM yyyy', { locale: id }).toUpperCase()}`],
      [],
      ['Ringkasan'],
      ['Pemasukan', rupiah(summary.income)],
      ['Pengeluaran', rupiah(summary.expense)],
      ['Net Cashflow', rupiah(summary.net)],
      [],
      ['Tanggal', 'Kategori', 'Dompet', 'Deskripsi', 'Nominal', 'Jenis'],
      ...transactions.map((tx) => [
        format(parseISO(tx.transaction_date), 'dd MMM yyyy', { locale: id }),
        tx.categories?.name || 'Lainnya',
        tx.wallets?.name || tx.payment_method || 'Manual',
        tx.description || '-',
        Number(tx.amount),
        tx.categories?.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      ]),
    ];

    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet['!cols'] = [{ wch: 16 }, { wch: 20 }, { wch: 20 }, { wch: 36 }, { wch: 18 }, { wch: 16 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Laporan');
    XLSX.writeFile(workbook, `LarFinance_${format(currentDate, 'MMM_yyyy', { locale: id })}.xlsx`);
    toast.success('Laporan Excel diunduh');
  };

  const activeTotal = filtered.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  return (
    <main className="min-h-screen bg-[#F7F8FA] text-slate-900 pb-28 md:pb-16 pt-8 md:pt-32">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-7">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 mb-2">Reports</p>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">Laporan keuangan</h1>
            <p className="text-sm text-slate-500 mt-2">Lihat arus kas, pola pengeluaran, dan detail transaksi dalam satu halaman.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={handleExportExcel} className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white border border-slate-200 text-sm font-bold text-slate-700 shadow-sm hover:border-slate-300">
              <Download size={16} /> Excel
            </button>
            <div className="inline-flex items-center rounded-2xl bg-white border border-slate-200 p-1 shadow-sm">
              <button onClick={() => changeMonth(-1)} className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center"><ChevronLeft size={17} /></button>
              <span className="min-w-[122px] text-center text-xs font-black uppercase tracking-wide">{format(currentDate, 'MMM yyyy', { locale: id })}</span>
              <button onClick={() => changeMonth(1)} className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center"><ChevronRight size={17} /></button>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6">
          {[
            { label: 'Pemasukan', value: summary.income, tone: 'emerald', icon: ArrowUpRight },
            { label: 'Pengeluaran', value: summary.expense, tone: 'rose', icon: ArrowDownRight },
            { label: 'Net Cashflow', value: summary.net, tone: summary.net < 0 ? 'rose' : 'indigo', icon: summary.net < 0 ? ArrowDownRight : ArrowUpRight },
          ].map(({ label, value, tone, icon: Icon }) => (
            <div key={label} className={`rounded-[2rem] border p-5 md:p-6 ${tone === 'emerald' ? 'bg-emerald-50 border-emerald-100' : tone === 'rose' ? 'bg-rose-50 border-rose-100' : 'bg-indigo-50 border-indigo-100'}`}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</span>
                <Icon size={18} className={tone === 'emerald' ? 'text-emerald-600' : tone === 'rose' ? 'text-rose-500' : 'text-indigo-600'} />
              </div>
              <p className="text-xl md:text-2xl font-black tracking-tight">{loading ? '…' : rupiah(value)}</p>
            </div>
          ))}
        </section>

        <section className="grid lg:grid-cols-[0.8fr_1.2fr] gap-5 mb-6">
          <div className="bg-white border border-slate-200 rounded-[2rem] p-5 md:p-6 shadow-sm">
            <div className="mb-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-1">Breakdown</p>
              <h2 className="text-xl font-black">Pengeluaran per kategori</h2>
            </div>
            <div className="h-[260px]">
              {summary.expenseByCategory.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={summary.expenseByCategory} dataKey="value" nameKey="name" innerRadius={64} outerRadius={96} paddingAngle={3}>
                      {summary.expenseByCategory.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => rupiah(value)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-slate-400">Belum ada data pengeluaran.</div>
              )}
            </div>
            <div className="space-y-2 mt-3">
              {summary.expenseByCategory.slice(0, 5).map((item, index) => (
                <div key={item.name} className="flex items-center justify-between gap-4 text-sm">
                  <div className="flex items-center gap-2 min-w-0"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} /><span className="truncate font-semibold text-slate-600">{item.name}</span></div>
                  <span className="font-bold whitespace-nowrap">{rupiah(item.value)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-[2rem] p-5 md:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-1">Trend</p>
                <h2 className="text-xl font-black">Aktivitas {activeTab === 'expense' ? 'pengeluaran' : 'pemasukan'}</h2>
              </div>
              <div className="inline-flex bg-slate-100 p-1 rounded-2xl self-start">
                {[
                  ['expense', 'Pengeluaran'],
                  ['income', 'Pemasukan'],
                ].map(([value, label]) => (
                  <button key={value} onClick={() => setActiveTab(value)} className={`px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === value ? 'bg-white shadow-sm text-slate-950' : 'text-slate-400'}`}>{label}</button>
                ))}
              </div>
            </div>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value) => rupiah(value)} />
                  <Bar dataKey="total" fill={activeTab === 'expense' ? '#f43f5e' : '#10b981'} radius={[8, 8, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden">
          <div className="p-5 md:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-1">Transactions</p>
              <h2 className="text-xl font-black">{filtered.length} transaksi · {rupiah(activeTotal)}</h2>
            </div>
            <div className="relative w-full md:w-80">
              <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari transaksi..." className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 text-sm font-medium" />
            </div>
          </div>

          <div className="p-4 md:p-6">
            {loading ? (
              <div className="py-16 text-center text-sm text-slate-400">Memuat transaksi…</div>
            ) : !filtered.length ? (
              <div className="py-16 text-center text-sm text-slate-400">Tidak ada transaksi yang cocok.</div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedTransactions).map(([dateLabel, items]) => (
                  <div key={dateLabel}>
                    <p className="text-[11px] uppercase tracking-[0.15em] font-bold text-slate-400 mb-2 px-1">{dateLabel}</p>
                    <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100">
                      {items.map((tx) => {
                        const income = tx.categories?.type === 'income';
                        return (
                          <button key={tx.id} onClick={() => openEdit(tx)} className="w-full text-left px-4 py-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${income ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>{income ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}</div>
                              <div className="min-w-0">
                                <p className="font-bold text-sm truncate">{tx.description || tx.categories?.name || 'Transaksi'}</p>
                                <p className="text-[11px] text-slate-400 truncate">{tx.categories?.name || 'Lainnya'} · {tx.wallets?.name || tx.payment_method || 'Manual'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <p className={`font-black text-sm ${income ? 'text-emerald-600' : 'text-slate-900'}`}>{income ? '+' : '-'}{rupiah(tx.amount)}</p>
                              <Pencil size={15} className="text-slate-300 hidden sm:block" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <AnimatePresence>
        {selectedTx && editForm && (
          <div className="fixed inset-0 z-[100] bg-slate-950/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} className="bg-white w-full sm:max-w-lg rounded-t-[2rem] sm:rounded-[2rem] p-6 md:p-7 max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Edit transaction</p><h3 className="text-xl font-black">Perbarui transaksi</h3></div>
                <button onClick={closeEdit} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"><X size={18} /></button>
              </div>

              <form onSubmit={handleUpdate} className="space-y-4">
                <div><label className="text-[11px] font-bold text-slate-500">Nominal</label><input type="number" required value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} className="mt-1 w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:ring-4 focus:ring-slate-100 font-bold" /></div>
                <div><label className="text-[11px] font-bold text-slate-500">Tanggal</label><input type="date" required value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} className="mt-1 w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none" /></div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><label className="text-[11px] font-bold text-slate-500">Kategori</label><select required value={editForm.category_id} onChange={(e) => setEditForm({ ...editForm, category_id: e.target.value })} className="mt-1 w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none">{categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></div>
                  <div><label className="text-[11px] font-bold text-slate-500">Dompet</label><select required value={editForm.wallet_id} onChange={(e) => setEditForm({ ...editForm, wallet_id: e.target.value })} className="mt-1 w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none">{wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}</select></div>
                </div>
                <div><label className="text-[11px] font-bold text-slate-500">Catatan</label><textarea rows="3" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="mt-1 w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none resize-none" /></div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={handleDelete} className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center"><Trash2 size={18} /></button>
                  <button type="submit" className="flex-1 h-12 rounded-2xl bg-slate-950 text-white font-bold">Simpan perubahan</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
