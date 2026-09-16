import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Download, Search, Trash2, X } from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { endOfMonth, endOfWeek, format, isSameMonth, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { id } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { loadAccessibleCategories, rupiah } from '../lib/financeData';

const weekInfo = (date) => {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return { key: format(start, 'yyyy-MM-dd'), start, end };
};

const weekLabel = (start, end) => `${format(start, 'd MMM', { locale: id })} – ${format(end, 'd MMM', { locale: id })}`;

export default function RekapanV23() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [activeTab, setActiveTab] = useState('expense');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd');
    const [txRes, catRes, walletRes] = await Promise.all([
      supabase.from('transactions').select('*, categories(name, type, icon, user_id), wallets(name)').eq('user_id', user.id).gte('transaction_date', start).lte('transaction_date', end).order('transaction_date', { ascending: false }).order('created_at', { ascending: false }),
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

  useEffect(() => { load(); }, [user, currentDate]);

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
      categories: Object.entries(expenseByCategory).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    };
  }, [transactions]);

  const weeklySummary = useMemo(() => {
    const map = {};
    transactions.forEach((tx) => {
      const info = weekInfo(parseISO(tx.transaction_date));
      if (!map[info.key]) map[info.key] = { ...info, income: 0, expense: 0, count: 0 };
      const amount = Number(tx.amount || 0);
      if (tx.categories?.type === 'income') map[info.key].income += amount;
      else map[info.key].expense += amount;
      map[info.key].count += 1;
    });
    return Object.values(map)
      .map((item) => ({ ...item, net: item.income - item.expense }))
      .sort((a, b) => b.start - a.start);
  }, [transactions]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return transactions.filter((tx) => tx.categories?.type === activeTab && (!term || (tx.description || '').toLowerCase().includes(term) || (tx.categories?.name || '').toLowerCase().includes(term) || (tx.wallets?.name || '').toLowerCase().includes(term)));
  }, [transactions, activeTab, query]);

  const dailyData = useMemo(() => {
    const grouped = {};
    filtered.forEach((tx) => {
      const key = format(parseISO(tx.transaction_date), 'dd MMM', { locale: id });
      grouped[key] = (grouped[key] || 0) + Number(tx.amount || 0);
    });
    return Object.entries(grouped).reverse().slice(-12).reverse().map(([date, total]) => ({ date, total })).reverse();
  }, [filtered]);

  const groupedByWeek = useMemo(() => {
    const map = {};
    filtered.forEach((tx) => {
      const info = weekInfo(parseISO(tx.transaction_date));
      if (!map[info.key]) map[info.key] = { ...info, items: [] };
      map[info.key].items.push(tx);
    });
    return Object.values(map).sort((a, b) => b.start - a.start);
  }, [filtered]);

  const currentWeekKey = weekInfo(new Date()).key;

  const openEdit = (tx) => {
    setSelected(tx);
    setEditForm({ amount: String(tx.amount || ''), description: tx.description || '', date: tx.transaction_date, category_id: String(tx.category_id || ''), wallet_id: String(tx.wallet_id || '') });
  };
  const closeEdit = () => { setSelected(null); setEditForm(null); };

  const saveEdit = async (event) => {
    event.preventDefault();
    const amount = Number(editForm.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) return toast.error('Nominal harus lebih dari 0');
    const category = categories.find((item) => String(item.id) === String(editForm.category_id));
    const wallet = wallets.find((item) => String(item.id) === String(editForm.wallet_id));
    if (!category || !wallet) return toast.error('Kategori atau dompet tidak valid');
    setSaving(true);
    const { error } = await supabase.from('transactions').update({ amount, description: editForm.description.trim() || (category.type === 'income' ? 'Pemasukan' : 'Pengeluaran'), transaction_date: editForm.date, category_id: category.id, wallet_id: wallet.id, payment_method: wallet.name }).eq('id', selected.id).eq('user_id', user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Transaksi diperbarui');
    closeEdit();
    load();
  };

  const remove = async () => {
    if (!selected || !window.confirm('Hapus transaksi ini permanen?')) return;
    const { error } = await supabase.from('transactions').delete().eq('id', selected.id).eq('user_id', user.id);
    if (error) return toast.error(error.message);
    toast.success('Transaksi dihapus');
    closeEdit();
    load();
  };

  const exportExcel = () => {
    if (!transactions.length) return toast.error('Belum ada data di bulan ini');
    const rows = [
      ['LAPORAN KEUANGAN LAR FINANCE'],
      [`Periode: ${format(currentDate, 'MMMM yyyy', { locale: id }).toUpperCase()}`],
      [],
      ['Pemasukan', summary.income],
      ['Pengeluaran', summary.expense],
      ['Net Cashflow', summary.net],
      [],
      ['Minggu','Tanggal','Kategori','Dompet','Deskripsi','Nominal','Jenis'],
      ...transactions.map((tx) => {
        const info = weekInfo(parseISO(tx.transaction_date));
        return [weekLabel(info.start, info.end), tx.transaction_date, tx.categories?.name || 'Lainnya', tx.wallets?.name || tx.payment_method || 'Manual', tx.description || '-', Number(tx.amount), tx.categories?.type === 'income' ? 'Pemasukan' : 'Pengeluaran'];
      }),
    ];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 22 }, { wch: 18 }, { wch: 32 }, { wch: 18 }, { wch: 16 }];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Laporan');
    XLSX.writeFile(book, `LarFinance_${format(currentDate, 'MMM_yyyy', { locale: id })}.xlsx`);
    toast.success('Laporan Excel diunduh');
  };

  const changeMonth = (offset) => { const next = new Date(currentDate); next.setMonth(next.getMonth() + offset); setCurrentDate(next); };

  return (
    <main className="min-h-screen bg-[#F7F8FA] text-slate-900 pb-28 md:pb-16 pt-8 md:pt-32">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-7">
          <div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 mb-1">Reports</p><h1 className="text-3xl md:text-4xl font-black tracking-tight">Laporan keuangan.</h1><p className="text-sm text-slate-500 mt-2">Pantau pemasukan dan pengeluaran per minggu agar ritme bulan ini lebih mudah dibaca.</p></div>
          <div className="flex flex-wrap items-center gap-2"><button onClick={exportExcel} className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white border border-slate-200 text-sm font-black"><Download size={16} /> Excel</button><div className="inline-flex items-center rounded-2xl bg-white border border-slate-200 p-1"><button onClick={() => changeMonth(-1)} className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center"><ChevronLeft size={17} /></button><span className="min-w-[122px] text-center text-xs font-black uppercase tracking-wide">{format(currentDate, 'MMM yyyy', { locale: id })}</span><button onClick={() => changeMonth(1)} className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center"><ChevronRight size={17} /></button></div></div>
        </header>

        <section className="grid sm:grid-cols-3 gap-3 md:gap-4 mb-6">{[
          ['Pemasukan', summary.income, 'emerald', ArrowUpRight],
          ['Pengeluaran', summary.expense, 'rose', ArrowDownRight],
          ['Net cashflow', summary.net, summary.net < 0 ? 'rose' : 'indigo', summary.net < 0 ? ArrowDownRight : ArrowUpRight],
        ].map(([label, value, tone, Icon]) => <div key={label} className={`rounded-[2rem] border p-5 md:p-6 ${tone === 'emerald' ? 'bg-emerald-50 border-emerald-100' : tone === 'rose' ? 'bg-rose-50 border-rose-100' : 'bg-indigo-50 border-indigo-100'}`}><div className="flex items-center justify-between mb-4"><span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</span><Icon size={18} /></div><p className="text-xl md:text-2xl font-black">{loading ? '…' : rupiah(value)}</p></div>)}</section>

        <section className="mb-6">
          <div className="flex items-end justify-between gap-4 mb-4"><div><p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Weekly overview</p><h2 className="text-xl md:text-2xl font-black mt-1">Ringkasan per minggu</h2></div><p className="hidden md:block text-xs text-slate-400">Senin – Minggu</p></div>
          {loading ? <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">{[1,2,3,4].map((item) => <div key={item} className="h-36 rounded-[1.75rem] bg-slate-100 animate-pulse" />)}</div> : weeklySummary.length ? <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">{weeklySummary.map((week) => { const isCurrent = isSameMonth(currentDate, new Date()) && week.key === currentWeekKey; return <article key={week.key} className={`rounded-[1.75rem] border p-5 ${isCurrent ? 'bg-slate-950 text-white border-slate-950 shadow-xl shadow-slate-900/10' : 'bg-white border-slate-200'}`}><div className="flex items-center justify-between gap-2"><p className={`text-[10px] font-black uppercase tracking-[0.14em] ${isCurrent ? 'text-slate-400' : 'text-slate-400'}`}>{weekLabel(week.start, week.end)}</p>{isCurrent && <span className="text-[9px] font-black uppercase rounded-full bg-white/10 px-2 py-1 text-emerald-300">Minggu ini</span>}</div><div className="grid grid-cols-2 gap-3 mt-5"><div><p className={`text-[9px] font-black uppercase ${isCurrent ? 'text-slate-500' : 'text-slate-400'}`}>Masuk</p><p className="font-black text-emerald-500 mt-1">{rupiah(week.income)}</p></div><div><p className={`text-[9px] font-black uppercase ${isCurrent ? 'text-slate-500' : 'text-slate-400'}`}>Keluar</p><p className="font-black text-rose-500 mt-1">{rupiah(week.expense)}</p></div></div><div className={`mt-4 pt-4 border-t flex items-center justify-between ${isCurrent ? 'border-white/10' : 'border-slate-100'}`}><span className={`text-xs ${isCurrent ? 'text-slate-400' : 'text-slate-500'}`}>Net</span><b className={week.net < 0 ? 'text-rose-400' : isCurrent ? 'text-white' : 'text-slate-900'}>{rupiah(week.net)}</b></div></article>; })}</div> : <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-400">Belum ada transaksi pada bulan ini.</div>}
        </section>

        <section className="grid lg:grid-cols-[0.72fr_1.28fr] gap-5 mb-6">
          <div className="bg-white border border-slate-200 rounded-[2rem] p-5 md:p-6 shadow-sm"><p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Kategori terbesar</p><h2 className="text-xl font-black mt-1 mb-5">Pengeluaran bulan ini</h2>{summary.categories.length ? <div className="space-y-4">{summary.categories.slice(0,6).map((item,index) => { const percent = summary.expense > 0 ? (item.value / summary.expense) * 100 : 0; return <div key={item.name}><div className="flex items-center justify-between gap-3 text-sm"><span className="font-bold text-slate-600 truncate">{index + 1}. {item.name}</span><b>{rupiah(item.value)}</b></div><div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-slate-900 rounded-full" style={{ width: `${Math.min(percent,100)}%` }} /></div></div>; })}</div> : <div className="py-14 text-center text-sm text-slate-400">Belum ada pengeluaran.</div>}</div>
          <div className="bg-white border border-slate-200 rounded-[2rem] p-5 md:p-6 shadow-sm"><div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5"><div><p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Trend</p><h2 className="text-xl font-black mt-1">Aktivitas harian</h2></div><div className="inline-flex bg-slate-100 p-1 rounded-2xl self-start">{[['expense','Pengeluaran'],['income','Pemasukan']].map(([key,label]) => <button key={key} onClick={() => setActiveTab(key)} className={`px-4 py-2 rounded-xl text-xs font-black ${activeTab === key ? 'bg-white shadow-sm text-slate-950' : 'text-slate-400'}`}>{label}</button>)}</div></div><div className="h-[280px]">{dailyData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={dailyData} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#64748b33" /><XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(value) => `${Math.round(value/1000)}k`} /><Tooltip formatter={(value) => rupiah(value)} /><Bar dataKey="total" fill={activeTab === 'expense' ? '#f43f5e' : '#10b981'} radius={[8,8,0,0]} /></BarChart></ResponsiveContainer> : <div className="h-full flex items-center justify-center text-sm text-slate-400">Belum ada data.</div>}</div></div>
        </section>

        <section className="bg-white border border-slate-200 rounded-[2rem] p-5 md:p-7 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5"><div><p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Transactions</p><h2 className="text-xl md:text-2xl font-black mt-1">Detail {activeTab === 'expense' ? 'pengeluaran' : 'pemasukan'} per minggu</h2></div><label className="relative md:w-80"><Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari deskripsi, kategori, dompet..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-sm font-bold outline-none" /></label></div>
          {loading ? <div className="space-y-3">{[1,2,3].map((item) => <div key={item} className="h-16 rounded-2xl bg-slate-100 animate-pulse" />)}</div> : !filtered.length ? <div className="py-14 text-center text-sm text-slate-400">Tidak ada transaksi di filter ini.</div> : <div className="space-y-7">{groupedByWeek.map((week) => { const total = week.items.reduce((sum, tx) => sum + Number(tx.amount || 0), 0); return <div key={week.key}><div className="flex items-center justify-between gap-3 mb-2"><p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{weekLabel(week.start, week.end)}</p><span className="text-xs font-black text-slate-500">{rupiah(total)}</span></div><div className="divide-y divide-slate-100">{week.items.map((tx) => <button key={tx.id} onClick={() => openEdit(tx)} className="w-full py-4 flex items-center justify-between gap-4 text-left hover:bg-slate-50/70 rounded-xl px-2"><div className="min-w-0"><p className="font-black text-sm truncate">{tx.description || tx.categories?.name || 'Transaksi'}</p><p className="text-[11px] text-slate-400 mt-1 truncate">{format(parseISO(tx.transaction_date), 'EEEE, d MMM', { locale: id })} · {tx.categories?.name || 'Lainnya'} · {tx.wallets?.name || tx.payment_method || 'Manual'}</p></div><p className={`font-black whitespace-nowrap ${tx.categories?.type === 'income' ? 'text-emerald-600' : 'text-slate-900'}`}>{tx.categories?.type === 'income' ? '+' : '-'}{rupiah(tx.amount)}</p></button>)}</div></div>; })}</div>}
        </section>
      </div>

      <AnimatePresence>{selected && editForm && <div className="fixed inset-0 z-[95] bg-slate-950/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"><motion.div initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:30 }} className="bg-white w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 md:p-7 shadow-2xl max-h-[90vh] overflow-y-auto"><div className="flex items-center justify-between mb-6"><div><p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Edit transaksi</p><h3 className="text-xl font-black mt-1">{selected.description || 'Transaksi'}</h3></div><button onClick={closeEdit} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"><X size={17} /></button></div><form onSubmit={saveEdit} className="space-y-4"><label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nominal</span><input required min="1" type="number" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 font-black outline-none" /></label><label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Tanggal</span><input required type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 font-bold outline-none" /></label><label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Kategori</span><select required value={editForm.category_id} onChange={(e) => setEditForm({ ...editForm, category_id: e.target.value })} className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 font-bold outline-none">{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Dompet</span><select required value={editForm.wallet_id} onChange={(e) => setEditForm({ ...editForm, wallet_id: e.target.value })} className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 font-bold outline-none">{wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}</select></label><label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Catatan</span><textarea rows={3} maxLength={180} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 font-medium outline-none resize-none" /></label><button disabled={saving} className="w-full h-12 rounded-2xl bg-slate-950 text-white font-black text-sm disabled:opacity-60">{saving ? 'Menyimpan...' : 'Simpan perubahan'}</button></form><button onClick={remove} className="mt-3 w-full h-11 rounded-2xl bg-rose-50 text-rose-600 font-black text-sm inline-flex items-center justify-center gap-2"><Trash2 size={15} /> Hapus transaksi</button></motion.div></div>}</AnimatePresence>
    </main>
  );
}
