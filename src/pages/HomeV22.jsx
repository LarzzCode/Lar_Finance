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

export default function HomeV22() {
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
  const [hideBalance, setHideBalance] = useState(false);
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

  const monthNet = Number(summary.income_month || 0) - Number(summary.expense_month || 0);
  const budgetTotal = budgets.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expenseRatio = Number(summary.income_month || 0) > 0
    ? (Number(summary.expense_month || 0) / Number(summary.income_month || 0)) * 100
    : 0;

  const insight = useMemo(() => {
    if (loading) return 'Menganalisis data keuangan…';
    if (!transactionCount) return 'Catat transaksi pertama agar Lar Finance mulai membaca pola cashflow kamu.';
    if (summary.income_month > 0 && summary.expense_month > summary.income_month) return 'Pengeluaran bulan ini sudah melewati pemasukan. Cek laporan dan budget sebelum menambah pengeluaran baru.';
    if (expenseRatio >= 80) return 'Lebih dari 80% pemasukan bulan ini sudah terpakai. Prioritaskan kebutuhan wajib dan cek kategori terbesar di Laporan.';
    if (!budgets.length) return 'Cashflow sudah tercatat. Langkah berikutnya: buat budget untuk kategori pengeluaran utama.';
    return 'Pencatatan berjalan baik. Jaga konsistensi dan tinjau planning secara berkala.';
  }, [loading, transactionCount, summary, expenseRatio, budgets.length]);

  const onboarding = [
    { done: walletCount > 0, label: 'Siapkan dompet', href: '/wallet', icon: WalletCards },
    { done: transactionCount > 0, label: 'Catat transaksi pertama', href: '/input', icon: CircleDollarSign },
    { done: budgets.length > 0, label: 'Buat budget pertama', href: '/budget', icon: PiggyBank },
  ];
  const onboardingDone = onboarding.filter((item) => item.done).length;

  const firstName = profile.full_name?.trim().split(' ')[0] || 'Boss';
  const hour = new Date().getHours();
  const greeting = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 19 ? 'Selamat sore' : 'Selamat malam';

  return (
    <main className="min-h-screen bg-[#F7F8FA] text-slate-900 pb-28 md:pb-16 pt-7 md:pt-32">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <header className="flex items-center justify-between gap-4 mb-7 md:mb-9">
          <div>
            <p className="text-[11px] md:text-xs font-black uppercase tracking-[0.18em] text-slate-400 mb-1">{greeting}</p>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">Hi, {firstName}</h1>
          </div>
          <Link to="/profile" className="shrink-0">
            <img src={profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(firstName)}&background=111827&color=fff`} alt="Profile" className="w-11 h-11 md:w-12 md:h-12 rounded-full object-cover border-2 border-white shadow-sm" />
          </Link>
        </header>

        {loadError && (
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700">Sebagian data belum berhasil dimuat: {loadError}</div>
        )}

        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-[2rem] md:rounded-[2.5rem] bg-[#0B1220] text-white p-6 md:p-8 lg:p-10 shadow-2xl shadow-slate-900/10 overflow-hidden relative mb-6">
          <div className="absolute -right-28 -top-28 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="absolute -left-24 -bottom-28 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="relative z-10 grid lg:grid-cols-[1.08fr_0.92fr] gap-8 lg:items-end">
            <div>
              <div className="flex items-center justify-between max-w-2xl mb-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Saldo saat ini</p>
                  <p className="text-xs text-slate-500 mt-1">Saldo awal seluruh dompet + seluruh pemasukan − seluruh pengeluaran.</p>
                </div>
                <button onClick={() => setHideBalance((value) => !value)} className="p-2.5 rounded-full bg-white/5 hover:bg-white/10" aria-label={hideBalance ? 'Tampilkan saldo' : 'Sembunyikan saldo'}>
                  {hideBalance ? <Eye size={17} /> : <EyeOff size={17} />}
                </button>
              </div>
              <p className={`font-black tracking-tight text-4xl md:text-6xl ${Number(summary.total_saldo) < 0 ? 'text-rose-300' : 'text-white'}`}>
                {hideBalance ? '••••••••' : loading ? '…' : rupiah(summary.total_saldo)}
              </p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/[0.06] border border-white/10 px-3 py-2 text-xs font-bold text-slate-300">
                {monthNet >= 0 ? <ArrowUpRight size={14} className="text-emerald-300" /> : <ArrowDownRight size={14} className="text-rose-300" />}
                Cashflow bulan ini {hideBalance ? '••••' : rupiah(monthNet)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 md:p-5">
                <div className="flex items-center gap-2 text-emerald-300 mb-2"><ArrowUpRight size={16} /><span className="text-[10px] font-black uppercase tracking-wider">Masuk bulan ini</span></div>
                <p className="font-black text-base md:text-lg truncate">{hideBalance ? '••••' : loading ? '…' : rupiah(summary.income_month)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 md:p-5">
                <div className="flex items-center gap-2 text-rose-300 mb-2"><ArrowDownRight size={16} /><span className="text-[10px] font-black uppercase tracking-wider">Keluar bulan ini</span></div>
                <p className="font-black text-base md:text-lg truncate">{hideBalance ? '••••' : loading ? '…' : rupiah(summary.expense_month)}</p>
              </div>
            </div>
          </div>
        </motion.section>

        {onboardingDone < onboarding.length && (
          <section className="mb-6 rounded-[2rem] border border-indigo-100 bg-indigo-50/70 p-5 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-indigo-500">Quick setup</p>
                <h2 className="text-xl font-black mt-1">Siapkan fondasi keuanganmu.</h2>
              </div>
              <span className="text-xs font-black text-indigo-600">{onboardingDone}/{onboarding.length} selesai</span>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              {onboarding.map(({ done, label, href, icon: Icon }) => (
                <Link key={label} to={href} className={`rounded-2xl border p-4 flex items-center gap-3 transition ${done ? 'bg-white/60 border-indigo-100 text-slate-400' : 'bg-white border-white hover:border-indigo-200'}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${done ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>{done ? <Check size={17} /> : <Icon size={18} />}</div>
                  <span className={`text-sm font-black ${done ? 'line-through' : ''}`}>{label}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-7">
          <Link to="/input" className="rounded-3xl border border-slate-200 bg-white p-5 hover:shadow-lg transition-shadow"><CircleDollarSign size={20} className="text-indigo-600 mb-4" /><p className="font-black text-sm">Catat transaksi</p><p className="text-xs text-slate-400 mt-1">Income / expense</p></Link>
          <Link to="/rekap" className="rounded-3xl border border-slate-200 bg-white p-5 hover:shadow-lg transition-shadow"><ReceiptText size={20} className="text-rose-500 mb-4" /><p className="font-black text-sm">Laporan</p><p className="text-xs text-slate-400 mt-1">Analisis arus kas</p></Link>
          <Link to="/wallet" className="rounded-3xl border border-slate-200 bg-white p-5 hover:shadow-lg transition-shadow"><WalletCards size={20} className="text-emerald-600 mb-4" /><p className="font-black text-sm">Dompet</p><p className="text-xs text-slate-400 mt-1">{walletCount} aktif</p></Link>
          <Link to="/planning" className="rounded-3xl border border-slate-200 bg-white p-5 hover:shadow-lg transition-shadow"><PiggyBank size={20} className="text-amber-500 mb-4" /><p className="font-black text-sm">Planning</p><p className="text-xs text-slate-400 mt-1">Budget & goals</p></Link>
        </section>

        <section className="grid lg:grid-cols-[1.3fr_0.7fr] gap-5 mb-7">
          <div className="bg-white border border-slate-200 rounded-[2rem] p-5 md:p-7 shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div><p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 mb-1">Transaksi terbaru</p><h2 className="text-xl md:text-2xl font-black">Aktivitas terakhir</h2></div>
              <Link to="/rekap" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900">Lihat semua <ArrowRight size={14} /></Link>
            </div>
            {loading ? (
              <div className="space-y-3">{[1,2,3].map((item) => <div key={item} className="h-16 rounded-2xl bg-slate-100 animate-pulse" />)}</div>
            ) : !recent.length ? (
              <div className="py-10 text-center"><ReceiptText size={27} className="mx-auto text-slate-300 mb-3" /><p className="font-black">Belum ada transaksi.</p><Link to="/input" className="inline-block mt-3 text-sm font-black text-indigo-600">Catat transaksi pertama →</Link></div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recent.map((tx) => {
                  const income = tx.categories?.type === 'income';
                  return <div key={tx.id} className="py-4 flex items-center justify-between gap-4"><div className="flex items-center gap-3 min-w-0"><div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${income ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>{income ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}</div><div className="min-w-0"><p className="font-black text-sm truncate">{tx.description || tx.categories?.name || 'Transaksi'}</p><p className="text-[11px] text-slate-400 truncate">{tx.categories?.name || 'Lainnya'} · {tx.wallets?.name || 'Manual'}</p></div></div><p className={`font-black text-sm whitespace-nowrap ${income ? 'text-emerald-600' : 'text-slate-900'}`}>{income ? '+' : '-'}{rupiah(tx.amount)}</p></div>;
                })}
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="bg-[#EEF2FF] border border-indigo-100 rounded-[2rem] p-5 md:p-6"><div className="w-10 h-10 rounded-2xl bg-white text-indigo-600 flex items-center justify-center shadow-sm mb-4"><Sparkles size={19} /></div><p className="text-[11px] font-black uppercase tracking-[0.16em] text-indigo-500 mb-2">Smart insight</p><p className="font-bold leading-relaxed text-slate-800">{insight}</p></div>

            <div className="bg-white border border-slate-200 rounded-[2rem] p-5 md:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4"><div><p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Planning snapshot</p><p className="font-black mt-1">Bulan ini</p></div><Link to="/planning" className="text-xs font-black text-indigo-600">Kelola</Link></div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 text-slate-500"><PiggyBank size={15} /> Budget</span><b>{rupiah(budgetTotal)}</b></div>
                <div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 text-slate-500"><CalendarClock size={15} /> Tagihan</span><b>{subscriptions.length}</b></div>
                <div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 text-slate-500"><Target size={15} /> Goals</span><b>{goals.length}</b></div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
