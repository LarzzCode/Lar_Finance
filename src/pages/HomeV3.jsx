import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  Check,
  CircleDollarSign,
  Eye,
  EyeOff,
  PiggyBank,
  ReceiptText,
  Sparkles,
  Target,
  WalletCards,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { rupiah } from '../lib/financeData';

const SoftIcon = ({ children, tone = 'slate' }) => {
  const tones = {
    indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300',
    rose: 'bg-rose-500/10 text-rose-500 dark:text-rose-300',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
    slate: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
  };
  return <span className={`w-10 h-10 rounded-2xl inline-flex items-center justify-center ${tones[tone]}`}>{children}</span>;
};

export default function HomeV3() {
  const { user } = useAuth();
  const [profile, setProfile] = useState({ full_name: '', avatar_url: '' });
  const [summary, setSummary] = useState({ total_saldo: 0, income_month: 0, expense_month: 0 });
  const [recent, setRecent] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [goals, setGoals] = useState([]);
  const [walletCount, setWalletCount] = useState(0);
  const [transactionCount, setTransactionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hideAmount, setHideAmount] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);
      setLoadError('');

      const [profileRes, summaryRes, recentRes, budgetRes, subRes, goalRes, walletRes, txCountRes] = await Promise.all([
        supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).single(),
        supabase.rpc('get_dashboard_summary', { uid: user.id }),
        supabase
          .from('transactions')
          .select('id, amount, transaction_date, description, categories(name, type), wallets(name)')
          .eq('user_id', user.id)
          .order('transaction_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.from('budgets').select('id, amount, categories(name)').eq('user_id', user.id),
        supabase.from('subscriptions').select('id, name, amount, due_date').eq('user_id', user.id).order('due_date').limit(4),
        supabase.from('goals').select('id, name, target_amount, current_amount, emoji').eq('user_id', user.id).order('created_at').limit(3),
        supabase.from('wallets').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);

      const error = summaryRes.error || recentRes.error || budgetRes.error || subRes.error || goalRes.error || walletRes.error || txCountRes.error;
      if (error) setLoadError(error.message || 'Sebagian data dashboard gagal dimuat.');

      if (profileRes.data) setProfile(profileRes.data);
      if (summaryRes.data) setSummary(summaryRes.data);
      setRecent(recentRes.data || []);
      setBudgets(budgetRes.data || []);
      setSubscriptions(subRes.data || []);
      setGoals(goalRes.data || []);
      setWalletCount(walletRes.count || 0);
      setTransactionCount(txCountRes.count || 0);
      setLoading(false);
    };

    load();
  }, [user]);

  const monthIncome = Number(summary.income_month || 0);
  const monthExpense = Number(summary.expense_month || 0);
  const monthNet = monthIncome - monthExpense;
  const budgetTotal = budgets.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expenseRatio = monthIncome > 0 ? (monthExpense / monthIncome) * 100 : 0;
  const budgetRatio = budgetTotal > 0 ? Math.min((monthExpense / budgetTotal) * 100, 999) : 0;

  const insight = useMemo(() => {
    if (loading) return 'Membaca pola bulan ini…';
    if (!transactionCount) return 'Catat transaksi pertama agar insight mulai terbentuk.';
    if (monthIncome > 0 && monthExpense > monthIncome) return 'Pengeluaran bulan ini sudah melewati pemasukan. Cek minggu dan kategori terbesar sebelum menambah pengeluaran.';
    if (expenseRatio >= 80) return 'Lebih dari 80% pemasukan bulan ini sudah terpakai. Ritme pengeluaran perlu dijaga.';
    if (!budgets.length) return 'Cashflow sudah tercatat. Buat budget supaya batas pengeluaran lebih mudah dipantau.';
    return 'Arus kas bulan ini masih terpantau. Pertahankan ritme pencatatan dan review mingguan.';
  }, [loading, transactionCount, monthIncome, monthExpense, expenseRatio, budgets.length]);

  const onboarding = [
    { done: walletCount > 0, label: 'Siapkan dompet', href: '/wallet', icon: WalletCards },
    { done: transactionCount > 0, label: 'Catat transaksi pertama', href: '/input', icon: CircleDollarSign },
    { done: budgets.length > 0, label: 'Buat budget pertama', href: '/budget', icon: PiggyBank },
  ];
  const onboardingDone = onboarding.filter((item) => item.done).length;

  const firstName = profile.full_name?.trim().split(' ')[0] || 'Boss';
  const hour = new Date().getHours();
  const greeting = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 19 ? 'Selamat sore' : 'Selamat malam';
  const display = (value) => hideAmount ? '••••••' : loading ? '…' : rupiah(value);

  return (
    <main className="min-h-screen pb-32 md:pb-16 pt-7 md:pt-32 text-slate-900 dark:text-slate-100">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <header className="flex items-center justify-between gap-4 mb-7 md:mb-9">
          <div>
            <p className="text-[11px] md:text-xs font-medium uppercase tracking-[0.16em] text-slate-400 mb-1">{greeting}</p>
            <h1 className="text-[2rem] md:text-[2.65rem] leading-tight font-semibold tracking-[-0.035em]">Hi, {firstName}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Lihat kondisi bulan ini tanpa harus membaca semuanya sekaligus.</p>
          </div>
          <Link to="/profile" className="shrink-0">
            <img src={profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(firstName)}&background=111827&color=fff`} alt="Profile" className="w-11 h-11 md:w-12 md:h-12 rounded-full object-cover border border-white/70 dark:border-white/10 shadow-lg shadow-slate-900/10" />
          </Link>
        </header>

        {loadError && <div className="liquid-nav mb-5 rounded-2xl px-4 py-3 text-xs font-medium text-amber-700 dark:text-amber-300">Sebagian data belum berhasil dimuat: {loadError}</div>}

        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-[2.25rem] md:rounded-[2.75rem] border border-white/70 dark:border-white/10 bg-white/52 dark:bg-slate-900/48 backdrop-blur-[30px] shadow-[0_28px_80px_rgba(15,23,42,.10)] p-6 md:p-8 lg:p-10 mb-5">
          <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-rose-300/25 dark:bg-rose-500/10 blur-3xl" />
          <div className="absolute -left-20 -bottom-28 h-64 w-64 rounded-full bg-indigo-300/20 dark:bg-indigo-500/10 blur-3xl" />
          <div className="relative z-10 grid lg:grid-cols-[1.2fr_.8fr] gap-8 lg:items-end">
            <div>
              <div className="flex items-start justify-between gap-4 max-w-2xl">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] font-medium text-slate-400">Pengeluaran bulan ini</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Fokus utama untuk menjaga ritme September tetap rapi.</p>
                </div>
                <button onClick={() => setHideAmount((value) => !value)} className="liquid-nav-pill w-10 h-10 rounded-2xl inline-flex items-center justify-center text-slate-500 dark:text-slate-300" aria-label={hideAmount ? 'Tampilkan nominal' : 'Sembunyikan nominal'}>{hideAmount ? <Eye size={16} /> : <EyeOff size={16} />}</button>
              </div>
              <p className="mt-5 text-[2.65rem] md:text-[4.4rem] leading-none font-semibold tracking-[-0.055em] text-slate-950 dark:text-white">{display(monthExpense)}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-rose-500/8 text-rose-500 dark:text-rose-300 px-3 py-2 text-xs font-medium"><ReceiptText size={14} /> {monthIncome > 0 ? `${Math.round(expenseRatio)}% dari pemasukan` : 'Belum ada pemasukan'}</span>
                {budgetTotal > 0 && <span className="inline-flex items-center gap-2 rounded-full bg-indigo-500/8 text-indigo-600 dark:text-indigo-300 px-3 py-2 text-xs font-medium"><Target size={14} /> {Math.round(budgetRatio)}% dari budget</span>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[1.6rem] bg-white/52 dark:bg-white/[0.05] border border-white/65 dark:border-white/10 p-4 md:p-5 backdrop-blur-xl">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-300 mb-3"><ArrowUpRight size={16} /><span className="text-[10px] font-medium uppercase tracking-[0.12em]">Pemasukan</span></div>
                <p className="text-base md:text-lg font-semibold truncate">{display(monthIncome)}</p>
                <p className="text-[11px] text-slate-400 mt-1">bulan ini</p>
              </div>
              <div className="rounded-[1.6rem] bg-white/52 dark:bg-white/[0.05] border border-white/65 dark:border-white/10 p-4 md:p-5 backdrop-blur-xl">
                <div className={`flex items-center gap-2 mb-3 ${monthNet >= 0 ? 'text-indigo-600 dark:text-indigo-300' : 'text-rose-500 dark:text-rose-300'}`}>{monthNet >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}<span className="text-[10px] font-medium uppercase tracking-[0.12em]">Net</span></div>
                <p className={`text-base md:text-lg font-semibold truncate ${monthNet < 0 ? 'text-rose-500 dark:text-rose-300' : ''}`}>{display(monthNet)}</p>
                <p className="text-[11px] text-slate-400 mt-1">bulan ini</p>
              </div>
            </div>
          </div>
        </motion.section>

        {onboardingDone < onboarding.length && (
          <section className="liquid-nav rounded-[2rem] p-5 md:p-6 mb-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div><p className="text-[10px] uppercase tracking-[0.16em] font-medium text-indigo-500">Quick setup</p><h2 className="text-lg md:text-xl font-semibold mt-1">Siapkan fondasi keuanganmu</h2></div>
              <span className="text-xs font-medium text-slate-400">{onboardingDone}/{onboarding.length} selesai</span>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              {onboarding.map(({ done, label, href, icon: Icon }) => (
                <Link key={label} to={href} className={`rounded-2xl border border-white/60 dark:border-white/10 p-4 flex items-center gap-3 transition ${done ? 'bg-white/30 dark:bg-white/[.03] text-slate-400' : 'bg-white/55 dark:bg-white/[.05] hover:bg-white/75'}`}>
                  <SoftIcon tone={done ? 'emerald' : 'indigo'}>{done ? <Check size={16} /> : <Icon size={17} />}</SoftIcon>
                  <span className={`text-sm font-medium ${done ? 'line-through' : ''}`}>{label}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-5">
          {[
            ['/input', 'Catat transaksi', 'Income / expense', CircleDollarSign, 'indigo'],
            ['/rekap', 'Laporan', 'Ringkasan mingguan', ReceiptText, 'rose'],
            ['/wallet', 'Dompet', `${walletCount} aktif`, WalletCards, 'emerald'],
            ['/planning', 'Planning', 'Budget & goals', PiggyBank, 'amber'],
          ].map(([href, title, subtitle, Icon, tone]) => (
            <Link key={href} to={href} className="liquid-nav rounded-[1.75rem] p-5 md:p-6 transition-transform hover:-translate-y-0.5">
              <SoftIcon tone={tone}><Icon size={18} /></SoftIcon>
              <p className="text-sm font-semibold mt-4">{title}</p>
              <p className="text-[11px] text-slate-400 mt-1">{subtitle}</p>
            </Link>
          ))}
        </section>

        <section className="grid lg:grid-cols-[1.18fr_.82fr] gap-5 mb-6">
          <div className="liquid-nav rounded-[2.2rem] p-5 md:p-7">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div><p className="text-[10px] uppercase tracking-[0.16em] font-medium text-slate-400">Transaksi terbaru</p><h2 className="text-xl md:text-2xl font-semibold mt-1">Aktivitas terakhir</h2></div>
              <Link to="/rekap" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white">Lihat semua <ArrowRight size={14} /></Link>
            </div>

            {loading ? <div className="space-y-3">{[1,2,3].map((item) => <div key={item} className="h-16 rounded-2xl bg-white/35 dark:bg-white/[.04] animate-pulse" />)}</div> : !recent.length ? (
              <div className="py-10 text-center"><ReceiptText size={26} className="mx-auto text-slate-300 mb-3" /><p className="font-medium">Belum ada transaksi</p><Link to="/input" className="inline-block mt-3 text-sm font-medium text-indigo-600 dark:text-indigo-300">Catat transaksi pertama →</Link></div>
            ) : (
              <div className="divide-y divide-white/50 dark:divide-white/10">
                {recent.map((tx) => {
                  const income = tx.categories?.type === 'income';
                  return (
                    <div key={tx.id} className="py-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <SoftIcon tone={income ? 'emerald' : 'rose'}>{income ? <ArrowUpRight size={17} /> : <ArrowDownRight size={17} />}</SoftIcon>
                        <div className="min-w-0"><p className="text-sm font-medium truncate">{tx.description || tx.categories?.name || 'Transaksi'}</p><p className="text-[11px] text-slate-400 mt-1 truncate">{tx.categories?.name || 'Lainnya'} · {tx.wallets?.name || 'Manual'} · {tx.transaction_date}</p></div>
                      </div>
                      <p className={`text-sm font-semibold whitespace-nowrap ${income ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-500 dark:text-rose-300'}`}>{income ? '+' : '-'}{rupiah(tx.amount)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="liquid-nav rounded-[2.2rem] p-5 md:p-6">
              <div className="flex items-start gap-3"><SoftIcon tone="indigo"><Sparkles size={18} /></SoftIcon><div><p className="text-[10px] uppercase tracking-[0.16em] font-medium text-slate-400">Smart insight</p><p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 mt-2">{insight}</p></div></div>
            </div>

            <div className="liquid-nav rounded-[2.2rem] p-5 md:p-6">
              <div className="flex items-center justify-between mb-4"><div><p className="text-[10px] uppercase tracking-[0.16em] font-medium text-slate-400">Planning snapshot</p><h3 className="text-lg font-semibold mt-1">Bulan ini</h3></div><Target size={18} className="text-slate-400" /></div>
              <div className="grid grid-cols-3 gap-2">
                <Link to="/budget" className="rounded-2xl bg-white/42 dark:bg-white/[.04] border border-white/60 dark:border-white/10 p-3"><p className="text-[10px] text-slate-400">Budget</p><p className="text-sm font-semibold mt-1">{budgets.length}</p></Link>
                <Link to="/subscription" className="rounded-2xl bg-white/42 dark:bg-white/[.04] border border-white/60 dark:border-white/10 p-3"><p className="text-[10px] text-slate-400">Tagihan</p><p className="text-sm font-semibold mt-1">{subscriptions.length}</p></Link>
                <Link to="/savings" className="rounded-2xl bg-white/42 dark:bg-white/[.04] border border-white/60 dark:border-white/10 p-3"><p className="text-[10px] text-slate-400">Goals</p><p className="text-sm font-semibold mt-1">{goals.length}</p></Link>
              </div>
              {subscriptions[0] && <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/36 dark:bg-white/[.03] border border-white/50 dark:border-white/10 p-3"><CalendarClock size={16} className="text-amber-500" /><div className="min-w-0"><p className="text-xs font-medium truncate">{subscriptions[0].name}</p><p className="text-[10px] text-slate-400 mt-0.5">Tagihan terdekat · {rupiah(subscriptions[0].amount)}</p></div></div>}
              {goals[0] && <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white/36 dark:bg-white/[.03] border border-white/50 dark:border-white/10 p-3"><span className="text-lg">{goals[0].emoji || '🎯'}</span><div className="min-w-0"><p className="text-xs font-medium truncate">{goals[0].name}</p><p className="text-[10px] text-slate-400 mt-0.5">{rupiah(goals[0].current_amount)} / {rupiah(goals[0].target_amount)}</p></div></div>}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
