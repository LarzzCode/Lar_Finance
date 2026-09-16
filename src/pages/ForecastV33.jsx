import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { ArrowLeft, ArrowDownRight, ArrowUpRight, CalendarDays, Gauge, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { rupiah } from '../lib/financeDataV31';
import { buildFinancialForecast } from '../lib/forecastingV33';

export default function ForecastV33() {
  const { user } = useAuth();
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      setError('');
      const [txRes, walletRes, transferRes, budgetRes, subRes, recurringRes] = await Promise.all([
        supabase.from('transactions').select('amount, category_id, wallet_id, transaction_date, description, categories(type)').eq('user_id', user.id),
        supabase.from('wallets').select('*').eq('user_id', user.id),
        supabase.from('transfers').select('amount, from_wallet_id, to_wallet_id, transfer_date').eq('user_id', user.id),
        supabase.from('budgets').select('amount, category_id').eq('user_id', user.id),
        supabase.from('subscriptions').select('id, name, amount, due_date, category_id').eq('user_id', user.id),
        supabase.from('recurring_transactions').select('id, name, type, amount, day_of_month, category_id, is_active, last_posted_month').eq('user_id', user.id),
      ]);
      const failed = [txRes, walletRes, transferRes, budgetRes, subRes, recurringRes].find((result) => result.error);
      if (failed?.error) setError(failed.error.message || 'Forecast gagal dimuat');
      else {
        setForecast(buildFinancialForecast({
          transactions: txRes.data || [],
          wallets: walletRes.data || [],
          transfers: transferRes.data || [],
          budgets: budgetRes.data || [],
          subscriptions: subRes.data || [],
          recurring: recurringRes.data || [],
        }));
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const health = useMemo(() => {
    if (!forecast) return null;
    if (forecast.projectedOverBudget > 0) return {
      title: 'Proyeksi melewati budget',
      description: `Jika ritme sekarang berlanjut, pengeluaran berpotensi melewati budget sekitar ${rupiah(forecast.projectedOverBudget)}.`,
      className: 'text-rose-500',
    };
    if (forecast.budgetTotal > 0) return {
      title: 'Proyeksi masih dalam budget',
      description: `Ruang tersisa terhadap proyeksi sekitar ${rupiah(Math.abs(forecast.projectedOverBudget))}.`,
      className: 'text-emerald-600 dark:text-emerald-300',
    };
    return {
      title: 'Belum ada budget pembanding',
      description: 'Proyeksi tetap dihitung dari ritme pengeluaran dan komitmen terjadwal.',
      className: 'text-indigo-600 dark:text-indigo-300',
    };
  }, [forecast]);

  if (loading) return <main className="min-h-screen pt-32 px-4"><div className="max-w-6xl mx-auto h-72 liquid-nav rounded-[2.3rem] animate-pulse" /></main>;

  return (
    <main className="min-h-screen pb-32 md:pb-16 pt-8 md:pt-32 text-slate-900 dark:text-slate-100">
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <header className="mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-5"><ArrowLeft size={15} /> Dashboard</Link>
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-300 mb-2"><TrendingUp size={16} /><span className="text-[10px] uppercase tracking-[0.16em] font-medium">Lar Finance V3.3</span></div>
          <h1 className="text-[2rem] md:text-[2.8rem] leading-tight font-semibold tracking-[-0.045em]">Financial Forecasting</h1>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 mt-2 max-w-3xl leading-relaxed">Bukan prediksi AI acak. Angka di bawah dihitung dari transaksi aktual, ritme harian, saldo dompet bulan ini, budget, tagihan yang belum terbayar, dan recurring yang belum dicatat.</p>
        </header>

        {error && <div className="liquid-nav rounded-2xl p-4 text-sm text-rose-500 mb-5">{error}</div>}

        {forecast && <>
          <section className="grid lg:grid-cols-[1.12fr_.88fr] gap-5 mb-5">
            <div className="relative overflow-hidden rounded-[2.4rem] border border-white/70 dark:border-white/10 bg-white/52 dark:bg-slate-900/48 backdrop-blur-[30px] p-6 md:p-8">
              <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full bg-rose-300/18 dark:bg-rose-500/10 blur-3xl" />
              <div className="relative">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Proyeksi pengeluaran akhir bulan</p>
                <p className="text-[2.7rem] md:text-[4rem] leading-none font-semibold tracking-[-0.055em] mt-4">{rupiah(forecast.projectedExpense)}</p>
                <p className={`text-sm font-medium mt-4 ${health?.className}`}>{health?.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">{health?.description}</p>
                <div className="grid grid-cols-2 gap-3 mt-7">
                  <div className="rounded-2xl bg-white/40 dark:bg-white/[.04] border border-white/60 dark:border-white/10 p-4"><p className="text-[10px] text-slate-400">Sudah keluar</p><p className="text-lg font-semibold mt-1">{rupiah(forecast.actualExpense)}</p></div>
                  <div className="rounded-2xl bg-white/40 dark:bg-white/[.04] border border-white/60 dark:border-white/10 p-4"><p className="text-[10px] text-slate-400">Ritme rata-rata</p><p className="text-lg font-semibold mt-1">{rupiah(forecast.dailyExpensePace)} / hari</p></div>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="liquid-nav rounded-[2.2rem] p-6">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 flex items-center justify-center mb-4"><ShieldCheck size={18} /></div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Safe-to-Spend</p>
                <p className="text-3xl font-semibold tracking-[-0.04em] mt-2 text-emerald-700 dark:text-emerald-300">{rupiah(forecast.safeToSpend)}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Sekitar <span className="font-medium text-slate-700 dark:text-slate-200">{rupiah(forecast.safePerDay)} / hari</span> untuk {forecast.daysRemaining} hari tersisa.</p>
              </div>
              <div className="liquid-nav rounded-[2.2rem] p-6">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 flex items-center justify-center mb-4"><Gauge size={18} /></div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Likuiditas setelah komitmen</p>
                <p className={`text-2xl font-semibold mt-2 ${forecast.liquidityAfterCommitments < 0 ? 'text-rose-500' : ''}`}>{rupiah(forecast.liquidityAfterCommitments)}</p>
                <p className="text-xs text-slate-400 mt-2">Saldo sekarang {rupiah(forecast.currentLiquidity)} + expected income − upcoming commitments.</p>
              </div>
            </div>
          </section>

          <section className="grid md:grid-cols-3 gap-4 mb-5">
            <div className="liquid-nav rounded-[1.9rem] p-5"><ArrowUpRight size={17} className="text-emerald-500 mb-4" /><p className="text-[10px] uppercase tracking-wide text-slate-400">Projected income</p><p className="text-xl font-semibold mt-1">{rupiah(forecast.projectedIncome)}</p><p className="text-[11px] text-slate-400 mt-2">Upcoming +{rupiah(forecast.scheduledIncome)}</p></div>
            <div className="liquid-nav rounded-[1.9rem] p-5"><ArrowDownRight size={17} className="text-rose-500 mb-4" /><p className="text-[10px] uppercase tracking-wide text-slate-400">Upcoming commitments</p><p className="text-xl font-semibold mt-1">{rupiah(forecast.scheduledExpense)}</p><p className="text-[11px] text-slate-400 mt-2">Tagihan + recurring belum dicatat</p></div>
            <div className="liquid-nav rounded-[1.9rem] p-5"><Sparkles size={17} className="text-indigo-500 mb-4" /><p className="text-[10px] uppercase tracking-wide text-slate-400">Projected net</p><p className={`text-xl font-semibold mt-1 ${forecast.projectedNet < 0 ? 'text-rose-500' : 'text-indigo-700 dark:text-indigo-300'}`}>{rupiah(forecast.projectedNet)}</p><p className="text-[11px] text-slate-400 mt-2">Income proyeksi − expense proyeksi</p></div>
          </section>

          <section className="grid lg:grid-cols-[1.15fr_.85fr] gap-5">
            <div className="liquid-nav rounded-[2.2rem] p-5 md:p-7">
              <div className="flex items-center justify-between gap-4 mb-5"><div><p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Future cashflow timeline</p><h2 className="text-xl font-semibold mt-1">Yang masih akan lewat</h2></div><CalendarDays size={19} className="text-indigo-500" /></div>
              {forecast.timeline.length ? <div className="space-y-3">{forecast.timeline.map((item) => (
                <div key={item.id} className="rounded-2xl bg-white/36 dark:bg-white/[.035] border border-white/55 dark:border-white/10 p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0"><div className="flex items-center gap-2 flex-wrap"><p className="text-sm font-medium truncate">{item.name}</p><span className="text-[9px] uppercase tracking-wide text-slate-400">{item.source}</span>{item.overdue && <span className="text-[9px] text-rose-500">lewat jadwal</span>}</div><p className="text-[11px] text-slate-400 mt-1">{format(parseISO(item.date), 'd MMMM', { locale: id })} · proyeksi saldo sesudahnya {rupiah(item.projectedLiquidityAfter)}</p></div>
                  <p className={`text-sm font-semibold whitespace-nowrap ${item.direction === 'income' ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-500'}`}>{item.direction === 'income' ? '+' : '-'}{rupiah(item.amount)}</p>
                </div>
              ))}</div> : <div className="py-12 text-center text-sm text-slate-400">Belum ada tagihan atau recurring yang tersisa bulan ini.</div>}
            </div>

            <div className="liquid-nav rounded-[2.2rem] p-5 md:p-7">
              <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Cara menghitung</p>
              <h2 className="text-xl font-semibold mt-1 mb-5">Angkanya transparan</h2>
              <div className="space-y-4 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                <div><p className="font-medium text-slate-700 dark:text-slate-200">1. Proyeksi akhir bulan</p><p className="mt-1">Lar Finance membandingkan run-rate pengeluaran harian dengan pengeluaran aktual + kewajiban terjadwal, lalu memakai nilai yang lebih konservatif.</p></div>
                <div><p className="font-medium text-slate-700 dark:text-slate-200">2. Safe-to-Spend</p><p className="mt-1">Saldo setelah komitmen dibandingkan dengan sisa ruang budget. Nilai yang lebih kecil dipakai agar angka tidak terlalu optimistis.</p></div>
                <div><p className="font-medium text-slate-700 dark:text-slate-200">3. Tidak double-count</p><p className="mt-1">Tagihan dan recurring dengan nama, nominal, dan kategori yang sama dihitung sekali saja.</p></div>
              </div>
              <div className="mt-6 rounded-2xl bg-indigo-500/[.07] p-4"><p className="text-[10px] uppercase tracking-wide text-indigo-600 dark:text-indigo-300">Basis forecast</p><p className="text-sm font-medium mt-1">{forecast.basis}</p></div>
            </div>
          </section>
        </>}
      </div>
    </main>
  );
}
