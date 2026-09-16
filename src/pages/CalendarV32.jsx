import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Repeat2, ArrowRightLeft, CalendarDays } from 'lucide-react';
import { eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek, addMonths, subMonths, isBefore, startOfDay } from 'date-fns';
import { id } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { rupiah } from '../lib/financeData';

const dueDateForMonth = (day, monthDate) => {
  const last = endOfMonth(monthDate).getDate();
  return new Date(monthDate.getFullYear(), monthDate.getMonth(), Math.min(Number(day || 1), last));
};

export default function CalendarV32() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [transactions, setTransactions] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd');
    const [txRes, transferRes, recurringRes] = await Promise.all([
      supabase.from('transactions').select('id, amount, transaction_date, description, categories(name,type), wallets(name)').eq('user_id', user.id).gte('transaction_date', start).lte('transaction_date', end).order('transaction_date'),
      supabase.from('transfers').select('id, amount, transfer_date, note, from_wallet:wallets!transfers_from_wallet_id_fkey(name), to_wallet:wallets!transfers_to_wallet_id_fkey(name)').eq('user_id', user.id).gte('transfer_date', start).lte('transfer_date', end).order('transfer_date'),
      supabase.from('recurring_transactions').select('id, name, type, amount, day_of_month, is_active, last_posted_month, categories(name), wallets(name)').eq('user_id', user.id).eq('is_active', true).order('day_of_month'),
    ]);
    const error = txRes.error || transferRes.error || recurringRes.error;
    if (error) toast.error(error.message || 'Gagal memuat kalender');
    setTransactions(txRes.data || []);
    setTransfers(transferRes.data || []);
    setRecurring(recurringRes.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user, currentDate]);

  const calendarStart = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const monthKey = format(startOfMonth(currentDate), 'yyyy-MM-dd');
  const today = format(new Date(), 'yyyy-MM-dd');
  const currentMonthStart = startOfMonth(new Date());
  const showRecurring = !isBefore(startOfMonth(currentDate), currentMonthStart);

  const byDay = useMemo(() => {
    const map = {};
    const ensure = (key) => {
      if (!map[key]) map[key] = { income: 0, expense: 0, transfers: 0, transactions: [], transferItems: [], recurringItems: [] };
      return map[key];
    };
    transactions.forEach((tx) => {
      const item = ensure(tx.transaction_date);
      const amount = Number(tx.amount || 0);
      if (tx.categories?.type === 'income') item.income += amount;
      else item.expense += amount;
      item.transactions.push(tx);
    });
    transfers.forEach((transfer) => {
      const item = ensure(transfer.transfer_date);
      item.transfers += Number(transfer.amount || 0);
      item.transferItems.push(transfer);
    });
    if (showRecurring) {
      recurring.forEach((item) => {
        const key = format(dueDateForMonth(item.day_of_month, currentDate), 'yyyy-MM-dd');
        ensure(key).recurringItems.push({ ...item, posted: item.last_posted_month === monthKey });
      });
    }
    return map;
  }, [transactions, transfers, recurring, currentDate, monthKey, showRecurring]);

  const summary = useMemo(() => transactions.reduce((acc, tx) => {
    const amount = Number(tx.amount || 0);
    if (tx.categories?.type === 'income') acc.income += amount;
    else acc.expense += amount;
    return acc;
  }, { income: 0, expense: 0 }), [transactions]);

  const selected = byDay[selectedDate] || { income: 0, expense: 0, transfers: 0, transactions: [], transferItems: [], recurringItems: [] };
  const selectedDateObj = new Date(`${selectedDate}T00:00:00`);

  const changeMonth = (direction) => {
    const next = direction > 0 ? addMonths(currentDate, 1) : subMonths(currentDate, 1);
    setCurrentDate(next);
    setSelectedDate(format(startOfMonth(next), 'yyyy-MM-dd'));
  };

  return (
    <main className="min-h-screen pb-32 md:pb-16 pt-8 md:pt-32 text-slate-900 dark:text-slate-100">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-8">
          <div><p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Calendar cashflow</p><h1 className="text-[2rem] md:text-[2.7rem] font-semibold tracking-[-0.04em] mt-1">Kalender keuangan</h1><p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Lihat ritme uang per hari tanpa mencampur transfer antar dompet dengan cashflow.</p></div>
          <div className="liquid-nav inline-flex items-center self-start lg:self-auto rounded-2xl p-1"><button onClick={() => changeMonth(-1)} className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/40 dark:hover:bg-white/[.05]"><ChevronLeft size={17} /></button><span className="min-w-[145px] text-center text-xs font-medium uppercase tracking-wide">{format(currentDate, 'MMMM yyyy', { locale: id })}</span><button onClick={() => changeMonth(1)} className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/40 dark:hover:bg-white/[.05]"><ChevronRight size={17} /></button></div>
        </header>

        <section className="grid sm:grid-cols-3 gap-3 mb-5"><div className="liquid-nav rounded-[1.8rem] p-5"><p className="text-[10px] uppercase tracking-wide text-emerald-600">Pemasukan</p><p className="text-xl font-semibold mt-2 text-emerald-600 dark:text-emerald-300">+{rupiah(summary.income)}</p></div><div className="liquid-nav rounded-[1.8rem] p-5"><p className="text-[10px] uppercase tracking-wide text-rose-500">Pengeluaran</p><p className="text-xl font-semibold mt-2 text-rose-500 dark:text-rose-300">-{rupiah(summary.expense)}</p></div><div className="liquid-nav rounded-[1.8rem] p-5"><p className="text-[10px] uppercase tracking-wide text-indigo-500">Net</p><p className={`text-xl font-semibold mt-2 ${summary.income-summary.expense<0?'text-rose-500':''}`}>{rupiah(summary.income-summary.expense)}</p></div></section>

        <section className="grid xl:grid-cols-[1.35fr_.65fr] gap-5 items-start">
          <div className="liquid-nav rounded-[2.2rem] p-3 sm:p-5 overflow-hidden">
            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">{['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map((label)=><div key={label} className="text-center text-[9px] sm:text-[10px] uppercase tracking-wide text-slate-400 py-2">{label}</div>)}</div>
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {days.map((day) => {
                const key = format(day, 'yyyy-MM-dd');
                const data = byDay[key] || { income:0, expense:0, transfers:0, recurringItems:[] };
                const active = selectedDate === key;
                const inMonth = isSameMonth(day, currentDate);
                return <button key={key} onClick={()=>setSelectedDate(key)} className={`min-h-[86px] sm:min-h-[112px] rounded-2xl p-2 sm:p-3 text-left border transition ${active?'border-indigo-300/60 bg-indigo-500/[.08]':'border-white/50 dark:border-white/10 bg-white/26 dark:bg-white/[.02] hover:bg-white/45 dark:hover:bg-white/[.04]'} ${!inMonth?'opacity-35':''}`}><div className="flex items-center justify-between"><span className={`text-xs font-medium ${key===today?'w-7 h-7 rounded-full bg-slate-950 text-white dark:bg-white dark:text-slate-950 inline-flex items-center justify-center':''}`}>{format(day,'d')}</span>{data.recurringItems?.length>0 && <Repeat2 size={12} className="text-indigo-500" />}</div><div className="mt-2 space-y-1">{data.income>0 && <p className="text-[9px] sm:text-[10px] text-emerald-600 dark:text-emerald-300 truncate">+{rupiah(data.income)}</p>}{data.expense>0 && <p className="text-[9px] sm:text-[10px] text-rose-500 dark:text-rose-300 truncate">-{rupiah(data.expense)}</p>}{data.transfers>0 && <p className="text-[9px] sm:text-[10px] text-indigo-500 truncate">⇄ {rupiah(data.transfers)}</p>}</div></button>;
              })}
            </div>
          </div>

          <aside className="liquid-nav rounded-[2.2rem] p-5 md:p-6 xl:sticky xl:top-28">
            <div className="flex items-center gap-3 mb-5"><div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 flex items-center justify-center"><CalendarDays size={18} /></div><div><p className="text-[10px] uppercase tracking-wide text-slate-400">Detail hari</p><h2 className="text-lg font-semibold">{format(selectedDateObj, 'EEEE, d MMMM', { locale: id })}</h2></div></div>
            <div className="grid grid-cols-2 gap-3 mb-5"><div className="rounded-2xl bg-emerald-500/[.07] p-3"><p className="text-[9px] text-emerald-600 uppercase">Masuk</p><p className="text-sm font-semibold mt-1 text-emerald-600">+{rupiah(selected.income)}</p></div><div className="rounded-2xl bg-rose-500/[.07] p-3"><p className="text-[9px] text-rose-500 uppercase">Keluar</p><p className="text-sm font-semibold mt-1 text-rose-500">-{rupiah(selected.expense)}</p></div></div>

            {!selected.transactions.length && !selected.transferItems.length && !selected.recurringItems.length ? <div className="py-10 text-center text-sm text-slate-400">Tidak ada aktivitas di tanggal ini.</div> : <div className="space-y-4">
              {selected.transactions.map((tx)=>{ const income=tx.categories?.type==='income'; return <div key={`tx-${tx.id}`} className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-medium truncate">{tx.description || tx.categories?.name || 'Transaksi'}</p><p className="text-[10px] text-slate-400 mt-1">{tx.categories?.name || 'Kategori'} · {tx.wallets?.name || 'Dompet'}</p></div><p className={`text-xs font-semibold whitespace-nowrap ${income?'text-emerald-600':'text-rose-500'}`}>{income?'+':'-'}{rupiah(tx.amount)}</p></div>;})}
              {selected.transferItems.map((item)=><div key={`transfer-${item.id}`} className="flex items-start justify-between gap-3"><div className="flex gap-2 min-w-0"><ArrowRightLeft size={15} className="text-indigo-500 mt-0.5 shrink-0" /><div className="min-w-0"><p className="text-sm font-medium truncate">{item.from_wallet?.name || 'Dompet'} → {item.to_wallet?.name || 'Dompet'}</p><p className="text-[10px] text-slate-400 mt-1">Transfer · tidak masuk cashflow</p></div></div><p className="text-xs font-semibold text-indigo-500 whitespace-nowrap">{rupiah(item.amount)}</p></div>)}
              {selected.recurringItems.map((item)=><div key={`rec-${item.id}`} className="flex items-start justify-between gap-3 pt-3 border-t border-white/50 dark:border-white/10"><div className="flex gap-2 min-w-0"><Repeat2 size={15} className="text-indigo-500 mt-0.5 shrink-0" /><div className="min-w-0"><p className="text-sm font-medium truncate">{item.name}</p><p className="text-[10px] text-slate-400 mt-1">Jadwal rutin · {item.posted?'sudah dicatat':'belum dicatat'}</p></div></div><p className={`text-xs font-semibold whitespace-nowrap ${item.type==='income'?'text-emerald-600':'text-rose-500'}`}>{item.type==='income'?'+':'-'}{rupiah(item.amount)}</p></div>)}
            </div>}
          </aside>
        </section>
      </div>
    </main>
  );
}
