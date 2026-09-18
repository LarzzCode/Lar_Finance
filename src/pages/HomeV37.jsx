import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import {
  ArrowDownRight,
  ArrowRightLeft,
  ArrowUpRight,
  CircleDollarSign,
  PiggyBank,
  ReceiptText,
  Target,
  WalletCards,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { currentMonthRange, rupiah } from '../lib/financeDataV35';
import ForecastSnapshotV33 from '../components/ForecastSnapshotV33';

const percentChange = (current, previous) => {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

export default function HomeV37() {
  const { user } = useAuth();
  const [profile, setProfile] = useState({ full_name: '', avatar_url: '' });
  const [allTx, setAllTx] = useState([]);
  const [monthTx, setMonthTx] = useState([]);
  const [weeklyTx, setWeeklyTx] = useState([]);
  const [recent, setRecent] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [walletCount, setWalletCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hideAmount, setHideAmount] = useState(false);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);
      const { start, end } = currentMonthRange();
      const now = new Date();
      const previousStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      const thisEnd = endOfWeek(now, { weekStartsOn: 1 });

      const [profileRes, allRes, monthRes, weeklyRes, recentRes, budgetRes, walletRes] = await Promise.all([
        supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).single(),
        supabase.from('transactions')
          .select('amount, category_id, transaction_date, categories(name, type)')
          .eq('user_id', user.id),
        supabase.from('transactions')
          .select('amount, category_id, transaction_date, categories(name, type)')
          .eq('user_id', user.id)
          .gte('transaction_date', start)
          .lte('transaction_date', end),
        supabase.from('transactions')
          .select('amount, transaction_date, categories(type)')
          .eq('user_id', user.id)
          .gte('transaction_date', format(previousStart, 'yyyy-MM-dd'))
          .lte('transaction_date', format(thisEnd, 'yyyy-MM-dd')),
        supabase.from('transactions')
          .select('id, amount, transaction_date, description, categories(name, type), wallets(name)')
          .eq('user_id', user.id)
          .order('transaction_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.from('budgets')
          .select('id, amount, category_id, categories(name)')
          .eq('user_id', user.id),
        supabase.from('wallets')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      setAllTx(allRes.data || []);
      setMonthTx(monthRes.data || []);
      setWeeklyTx(weeklyRes.data || []);
      setRecent(recentRes.data || []);
      setBudgets(budgetRes.data || []);
      setWalletCount(walletRes.count || 0);
      setLoading(false);
    };

    load();
  }, [user]);

  const lifetime = useMemo(() => allTx.reduce((acc, tx) => {
    const amount = Number(tx.amount || 0);
    if (tx.categories?.type === 'income') acc.income += amount;
    else acc.expense += amount;
    return acc;
  }, { income: 0, expense: 0 }), [allTx]);

  const week = useMemo(() => {
    const now = new Date();
    const thisStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const thisEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const prevStart = format(startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const prevEnd = format(endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), 'yyyy-MM-dd');

    const sum = (from, to) => weeklyTx
      .filter((tx) => tx.transaction_date >= from && tx.transaction_date <= to)
      .reduce((acc, tx) => {
        const amount = Number(tx.amount || 0);
        if (tx.categories?.type === 'income') acc.income += amount;
        else acc.expense += amount;
        return acc;
      }, { income: 0, expense: 0 });

    return { current: sum(thisStart, thisEnd), previous: sum(prevStart, prevEnd) };
  }, [weeklyTx]);

  const budgetState = useMemo(() => budgets.map((budget) => {
    const spent = monthTx
      .filter((tx) => tx.categories?.type === 'expense' && String(tx.category_id) === String(budget.category_id))
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const amount = Number(budget.amount || 0);
    return { ...budget, spent, percent: amount > 0 ? (spent / amount) * 100 : 0 };
  }).sort((a, b) => b.percent - a.percent), [budgets, monthTx]);

  const alertBudget = budgetState.find((item) => item.percent >= 70);
  const expenseDelta = percentChange(week.current.expense, week.previous.expense);
  const net = lifetime.income - lifetime.expense;
  const firstName = profile.full_name?.trim().split(' ')[0] || 'Boss';
  const display = (value) => hideAmount ? '••••••' : loading ? '…' : rupiah(value);

  return (
    <main className="min-h-screen pb-32 md:pb-16 pt-8 md:pt-32 text-slate-900 dark:text-slate-100">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <header className="flex items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Dashboard · Lifetime cashflow</p>
            <h1 className="text-[2rem] md:text-[2.7rem] font-semibold tracking-[-0.04em] mt-1">Hi, {firstName}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Angka utama sekarang dihitung kumulatif sejak kamu mulai memakai Lar Finance, bukan di-reset tiap bulan.
            </p>
          </div>
          <Link to="/profile">
            <img
              src={profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(firstName)}&background=111827&color=fff`}
              alt="Profile"
              className="w-11 h-11 rounded-full object-cover"
            />
          </Link>
        </header>

        <section className="relative overflow-hidden rounded-[2.5rem] border border-white/70 dark:border-white/10 bg-white/52 dark:bg-slate-900/48 backdrop-blur-[30px] p-6 md:p-9 mb-5">
          <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-rose-300/20 blur-3xl" />
          <div className="relative grid lg:grid-cols-[1.2fr_.8fr] gap-7 lg:items-end">
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Total pengeluaran</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Akumulasi seluruh transaksi sejak mulai digunakan.</p>
                </div>
                <button onClick={() => setHideAmount((value) => !value)} className="liquid-nav-pill w-10 h-10 rounded-2xl">
                  {hideAmount ? '••' : 'Rp'}
                </button>
              </div>
              <p className="text-[2.8rem] md:text-[4.5rem] leading-none font-semibold tracking-[-0.055em] mt-5">{display(lifetime.expense)}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="liquid-nav rounded-[1.6rem] p-4">
                <p className="text-[10px] uppercase tracking-wide text-emerald-600">Total pemasukan</p>
                <p className="text-lg font-semibold mt-2">{display(lifetime.income)}</p>
              </div>
              <div className="liquid-nav rounded-[1.6rem] p-4">
                <p className="text-[10px] uppercase tracking-wide text-indigo-600 dark:text-indigo-300">Net keseluruhan</p>
                <p className={`text-lg font-semibold mt-2 ${net < 0 ? 'text-rose-500' : ''}`}>{display(net)}</p>
              </div>
            </div>
          </div>
        </section>

        <ForecastSnapshotV33 />

        <section className="grid md:grid-cols-2 gap-5 mb-5">
          <div className="liquid-nav rounded-[2.2rem] p-5 md:p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Weekly comparison</p>
                <h2 className="text-xl font-semibold mt-1">Minggu ini vs minggu lalu</h2>
              </div>
              {expenseDelta <= 0
                ? <ArrowDownRight className="text-emerald-500" size={20} />
                : <ArrowUpRight className="text-rose-500" size={20} />}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/40 dark:bg-white/[.04] p-4">
                <p className="text-[10px] text-slate-400">Minggu ini</p>
                <p className="text-lg font-semibold mt-1">{rupiah(week.current.expense)}</p>
              </div>
              <div className="rounded-2xl bg-white/40 dark:bg-white/[.04] p-4">
                <p className="text-[10px] text-slate-400">Minggu lalu</p>
                <p className="text-lg font-semibold mt-1">{rupiah(week.previous.expense)}</p>
              </div>
            </div>
            <p className={`text-sm mt-4 ${expenseDelta <= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-500'}`}>
              {Math.abs(Math.round(expenseDelta))}% {expenseDelta <= 0 ? 'lebih hemat' : 'lebih tinggi'} dibanding minggu lalu.
            </p>
          </div>

          <div className="liquid-nav rounded-[2.2rem] p-5 md:p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Budget bulan berjalan</p>
                <h2 className="text-xl font-semibold mt-1">Batas pengeluaran</h2>
              </div>
              <Target size={20} className="text-indigo-500" />
            </div>

            {alertBudget ? (
              <>
                <p className="text-sm text-slate-500 dark:text-slate-400">{alertBudget.categories?.name || 'Kategori'} sudah terpakai</p>
                <p className={`text-4xl font-semibold tracking-[-0.04em] mt-2 ${
                  alertBudget.percent >= 100 ? 'text-rose-500' : alertBudget.percent >= 90 ? 'text-orange-500' : 'text-amber-500'
                }`}>
                  {Math.round(alertBudget.percent)}%
                </p>
                <div className="mt-4 h-2 rounded-full bg-slate-200/60 dark:bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${alertBudget.percent >= 100 ? 'bg-rose-500' : alertBudget.percent >= 90 ? 'bg-orange-500' : 'bg-amber-500'}`}
                    style={{ width: `${Math.min(alertBudget.percent, 100)}%` }}
                  />
                </div>
                <Link to="/budget" className="inline-block mt-4 text-sm font-medium text-indigo-600 dark:text-indigo-300">Buka Budget →</Link>
              </>
            ) : (
              <div className="py-7 text-center">
                <PiggyBank size={28} className="mx-auto text-slate-300 mb-3" />
                <p className="text-sm text-slate-500">Belum ada budget bulan ini yang melewati 70%.</p>
              </div>
            )}
          </div>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 mb-5">
          {[
            ['/input','Catat','Income / expense',CircleDollarSign],
            ['/transfer','Transfer','Antar dompet',ArrowRightLeft],
            ['/rekap','Laporan','Semua waktu',ReceiptText],
            ['/wallet','Dompet',`${walletCount} aktif`,WalletCards],
            ['/budget','Budget','Bulanan',PiggyBank],
          ].map(([href,title,subtitle,Icon]) => (
            <Link key={href} to={href} className="liquid-nav rounded-[1.7rem] p-5">
              <Icon size={18} className="text-indigo-500" />
              <p className="text-sm font-semibold mt-4">{title}</p>
              <p className="text-[11px] text-slate-400 mt-1">{subtitle}</p>
            </Link>
          ))}
        </section>

        <section className="liquid-nav rounded-[2.2rem] p-5 md:p-7">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Aktivitas terakhir</p>
              <h2 className="text-xl font-semibold mt-1">Transaksi terbaru</h2>
            </div>
            <Link to="/rekap" className="text-xs font-medium text-indigo-600 dark:text-indigo-300">Lihat semua</Link>
          </div>

          {loading ? <div className="h-32 animate-pulse" /> : recent.length ? (
            <div className="divide-y divide-white/50 dark:divide-white/10">
              {recent.map((tx) => {
                const income = tx.categories?.type === 'income';
                return (
                  <div key={tx.id} className="py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{tx.description || tx.categories?.name || 'Transaksi'}</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {tx.categories?.name || 'Lainnya'} · {tx.wallets?.name || 'Manual'} · {tx.transaction_date}
                      </p>
                    </div>
                    <p className={`text-sm font-semibold whitespace-nowrap ${income ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {income ? '+' : '-'}{rupiah(tx.amount)}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-slate-400">Belum ada transaksi. Mulai dari Catat.</div>
          )}
        </section>
      </div>
    </main>
  );
}
