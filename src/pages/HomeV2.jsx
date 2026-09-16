import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CircleDollarSign,
  Eye,
  EyeOff,
  Landmark,
  PiggyBank,
  ReceiptText,
  Sparkles,
  WalletCards,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const formatRupiah = (value) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const StatCard = ({ label, value, tone = 'slate', icon: Icon }) => {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    slate: 'bg-white text-slate-900 border-slate-200',
  };

  return (
    <div className={`rounded-3xl border p-5 md:p-6 ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-4 mb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-60">{label}</p>
        <Icon size={18} className="opacity-60" />
      </div>
      <p className="text-xl md:text-2xl font-black tracking-tight truncate">{value}</p>
    </div>
  );
};

export default function HomeV2() {
  const { user } = useAuth();
  const [profile, setProfile] = useState({ full_name: '', avatar_url: '' });
  const [transactions, setTransactions] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hideBalance, setHideBalance] = useState(false);

  useEffect(() => {
    if (!user) return;

    const loadDashboard = async () => {
      setLoading(true);
      const start = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const end = format(endOfMonth(new Date()), 'yyyy-MM-dd');

      const [profileRes, txRes, recentRes, budgetRes, subscriptionRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', user.id)
          .single(),
        supabase
          .from('transactions')
          .select('id, amount, transaction_date, description, categories(name, type), wallets(name)')
          .eq('user_id', user.id)
          .gte('transaction_date', start)
          .lte('transaction_date', end)
          .order('transaction_date', { ascending: false }),
        supabase
          .from('transactions')
          .select('id, amount, transaction_date, description, categories(name, type), wallets(name)')
          .eq('user_id', user.id)
          .order('transaction_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('budgets')
          .select('id, amount, category_id, categories(name)')
          .eq('user_id', user.id),
        supabase
          .from('subscriptions')
          .select('id, name, amount, due_date')
          .eq('user_id', user.id)
          .order('due_date', { ascending: true })
          .limit(4),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      setTransactions(txRes.data || []);
      setRecentTransactions(recentRes.data || []);
      setBudgets(budgetRes.data || []);
      setSubscriptions(subscriptionRes.data || []);
      setLoading(false);
    };

    loadDashboard();
  }, [user]);

  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    const categorySpend = {};

    transactions.forEach((tx) => {
      const amount = Number(tx.amount) || 0;
      if (tx.categories?.type === 'income') {
        income += amount;
      } else {
        expense += amount;
        const name = tx.categories?.name || 'Lainnya';
        categorySpend[name] = (categorySpend[name] || 0) + amount;
      }
    });

    const topCategory = Object.entries(categorySpend).sort((a, b) => b[1] - a[1])[0];
    const budgetTotal = budgets.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const allocationPercent = income > 0 ? Math.min((budgetTotal / income) * 100, 100) : 0;
    const expenseRatio = income > 0 ? (expense / income) * 100 : 0;

    return {
      income,
      expense,
      net: income - expense,
      budgetTotal,
      allocationPercent,
      expenseRatio,
      topCategory,
    };
  }, [transactions, budgets]);

  const insight = useMemo(() => {
    if (loading) return 'Menganalisis keuangan bulan ini…';
    if (summary.income === 0 && summary.expense === 0) return 'Mulai catat transaksi agar Lar Finance bisa membaca pola keuanganmu.';
    if (summary.expense > summary.income && summary.income > 0) return 'Pengeluaran bulan ini sudah melewati pemasukan. Prioritaskan kebutuhan wajib dan tahan pengeluaran tambahan.';
    if (summary.expenseRatio >= 80) return 'Lebih dari 80% pemasukan sudah terpakai. Cek budget kategori sebelum menambah pengeluaran baru.';
    if (summary.topCategory) return `${summary.topCategory[0]} menjadi kategori pengeluaran terbesar bulan ini. Cek detailnya di Laporan.`;
    return 'Arus kas bulan ini masih terkendali. Pertahankan ritme pencatatan agar datanya tetap akurat.';
  }, [loading, summary]);

  const firstName = profile.full_name?.trim().split(' ')[0] || 'Boss';
  const hour = new Date().getHours();
  const greeting = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 19 ? 'Selamat sore' : 'Selamat malam';

  const quickActions = [
    { label: 'Catat transaksi', href: '/input', icon: CircleDollarSign },
    { label: 'Lihat laporan', href: '/rekap', icon: ReceiptText },
    { label: 'Atur planning', href: '/planning', icon: PiggyBank },
    { label: 'Kelola dompet', href: '/wallet', icon: WalletCards },
  ];

  return (
    <main className="min-h-screen bg-[#F7F8FA] text-slate-900 pb-28 md:pb-16 pt-7 md:pt-32">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-4 mb-7 md:mb-9"
        >
          <div>
            <p className="text-[11px] md:text-xs font-bold uppercase tracking-[0.18em] text-slate-400 mb-1">{greeting}</p>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">Hi, {firstName}</h1>
          </div>
          <Link to="/profile" className="shrink-0">
            <img
              src={profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(firstName)}&background=111827&color=fff`}
              alt="Profile"
              className="w-11 h-11 md:w-12 md:h-12 rounded-full object-cover border-2 border-white shadow-sm"
            />
          </Link>
        </motion.header>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-[2rem] md:rounded-[2.5rem] bg-[#0B1220] text-white p-6 md:p-8 lg:p-10 shadow-2xl shadow-slate-900/10 overflow-hidden relative mb-6"
        >
          <div className="absolute -right-28 -top-28 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="absolute -left-24 -bottom-28 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

          <div className="relative z-10 grid lg:grid-cols-[1.1fr_0.9fr] gap-8 lg:items-end">
            <div>
              <div className="flex items-center justify-between max-w-2xl mb-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Net cashflow bulan ini</p>
                <button
                  onClick={() => setHideBalance((value) => !value)}
                  className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                  aria-label={hideBalance ? 'Tampilkan saldo' : 'Sembunyikan saldo'}
                >
                  {hideBalance ? <Eye size={17} /> : <EyeOff size={17} />}
                </button>
              </div>
              <p className={`font-black tracking-tight text-4xl md:text-6xl ${summary.net < 0 ? 'text-rose-300' : 'text-white'}`}>
                {hideBalance ? '••••••••' : loading ? '…' : formatRupiah(summary.net)}
              </p>
              <p className="text-sm text-slate-400 mt-3 max-w-xl">Pemasukan dikurangi seluruh pengeluaran pada periode bulan berjalan.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 md:p-5">
                <div className="flex items-center gap-2 text-emerald-300 mb-2"><ArrowUpRight size={16} /><span className="text-[10px] font-bold uppercase tracking-wider">Pemasukan</span></div>
                <p className="font-bold text-base md:text-lg truncate">{hideBalance ? '••••' : loading ? '…' : formatRupiah(summary.income)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 md:p-5">
                <div className="flex items-center gap-2 text-rose-300 mb-2"><ArrowDownRight size={16} /><span className="text-[10px] font-bold uppercase tracking-wider">Pengeluaran</span></div>
                <p className="font-bold text-base md:text-lg truncate">{hideBalance ? '••••' : loading ? '…' : formatRupiah(summary.expense)}</p>
              </div>
            </div>
          </div>
        </motion.section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-7">
          <StatCard label="Budget dialokasikan" value={loading ? '…' : formatRupiah(summary.budgetTotal)} tone="indigo" icon={Landmark} />
          <StatCard label="Rasio pengeluaran" value={loading ? '…' : `${Math.round(summary.expenseRatio)}%`} tone={summary.expenseRatio >= 80 ? 'rose' : 'emerald'} icon={ReceiptText} />
          <StatCard label="Tagihan rutin" value={loading ? '…' : `${subscriptions.length} terpantau`} tone="slate" icon={CalendarClock} />
          <StatCard label="Budget coverage" value={loading ? '…' : `${Math.round(summary.allocationPercent)}%`} tone="slate" icon={PiggyBank} />
        </section>

        <section className="grid lg:grid-cols-[1.35fr_0.65fr] gap-5 mb-7">
          <div className="bg-white border border-slate-200 rounded-[2rem] p-5 md:p-7 shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-1">Transaksi terbaru</p>
                <h2 className="text-xl md:text-2xl font-black">Aktivitas terakhir</h2>
              </div>
              <Link to="/rekap" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900">Lihat semua <ArrowRight size={14} /></Link>
            </div>

            <div className="divide-y divide-slate-100">
              {recentTransactions.length === 0 && !loading ? (
                <div className="py-12 text-center text-sm text-slate-400">Belum ada transaksi.</div>
              ) : (
                recentTransactions.map((tx) => {
                  const isIncome = tx.categories?.type === 'income';
                  return (
                    <div key={tx.id} className="py-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${isIncome ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                          {isIncome ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate">{tx.description || tx.categories?.name || 'Transaksi'}</p>
                          <p className="text-[11px] text-slate-400 truncate">{tx.categories?.name || 'Lainnya'} · {tx.wallets?.name || 'Manual'}</p>
                        </div>
                      </div>
                      <p className={`font-black text-sm md:text-base whitespace-nowrap ${isIncome ? 'text-emerald-600' : 'text-slate-900'}`}>
                        {isIncome ? '+' : '-'}{formatRupiah(tx.amount)}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-5">
            <div className="bg-[#EEF2FF] border border-indigo-100 rounded-[2rem] p-5 md:p-6">
              <div className="w-10 h-10 rounded-2xl bg-white text-indigo-600 flex items-center justify-center shadow-sm mb-4"><Sparkles size={19} /></div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-500 mb-2">Smart insight</p>
              <p className="font-bold leading-relaxed text-slate-800">{insight}</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-[2rem] p-5 md:p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-1">Tagihan terdekat</p>
                  <h3 className="font-black">Upcoming bills</h3>
                </div>
                <Link to="/subscription" className="text-xs font-bold text-indigo-600">Kelola</Link>
              </div>
              <div className="space-y-3">
                {subscriptions.length === 0 ? (
                  <p className="text-sm text-slate-400 py-4">Belum ada tagihan rutin.</p>
                ) : subscriptions.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{item.name}</p>
                      <p className="text-[11px] text-slate-400">Jatuh tempo tanggal {item.due_date}</p>
                    </div>
                    <p className="font-bold text-sm whitespace-nowrap">{formatRupiah(item.amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-1">Quick actions</p>
              <h2 className="text-xl font-black">Akses cepat</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {quickActions.map(({ label, href, icon: Icon }) => (
              <Link key={href} to={href} className="group bg-white border border-slate-200 rounded-3xl p-5 hover:-translate-y-1 hover:shadow-lg transition-all">
                <div className="w-11 h-11 rounded-2xl bg-slate-50 text-slate-600 flex items-center justify-center mb-5 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                  <Icon size={20} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sm">{label}</span>
                  <ArrowRight size={15} className="text-slate-300 group-hover:text-slate-900 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
