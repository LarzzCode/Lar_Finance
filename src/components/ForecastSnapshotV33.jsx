import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarRange, Gauge, ShieldCheck, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { rupiah } from '../lib/financeDataV35';
import { buildFinancialForecast } from '../lib/forecastingV33';

export default function ForecastSnapshotV33() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const [txRes, walletRes, transferRes, adjustmentRes, budgetRes, subRes, recurringRes] = await Promise.all([
        supabase.from('transactions').select('amount, category_id, wallet_id, transaction_date, description, categories(type)').eq('user_id', user.id),
        supabase.from('wallets').select('*').eq('user_id', user.id),
        supabase.from('transfers').select('amount, from_wallet_id, to_wallet_id, transfer_date').eq('user_id', user.id),
        supabase.from('wallet_adjustments').select('amount, wallet_id, adjustment_date, actual_balance, created_at').eq('user_id', user.id),
        supabase.from('budgets').select('amount, category_id').eq('user_id', user.id),
        supabase.from('subscriptions').select('id, name, amount, due_date, category_id').eq('user_id', user.id),
        supabase.from('recurring_transactions').select('id, name, type, amount, day_of_month, category_id, is_active, last_posted_month').eq('user_id', user.id),
      ]);

      const hasError = [txRes, walletRes, transferRes, adjustmentRes, budgetRes, subRes, recurringRes].some((result) => result.error);
      if (!hasError) {
        setData(buildFinancialForecast({
          transactions: txRes.data || [],
          wallets: walletRes.data || [],
          transfers: transferRes.data || [],
          adjustments: adjustmentRes.data || [],
          budgets: budgetRes.data || [],
          subscriptions: subRes.data || [],
          recurring: recurringRes.data || [],
        }));
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const status = useMemo(() => {
    if (!data) return null;
    if (data.projectedOverBudget > 0) return { label: `Potensi lewat ${rupiah(data.projectedOverBudget)}`, tone: 'text-rose-500' };
    if (data.budgetTotal > 0) return { label: `Masih di bawah budget ${rupiah(Math.abs(data.projectedOverBudget))}`, tone: 'text-emerald-600 dark:text-emerald-300' };
    return { label: data.basis, tone: 'text-slate-400' };
  }, [data]);

  if (loading) return <section className="liquid-nav rounded-[2.2rem] p-6 mb-5 h-52 animate-pulse" />;
  if (!data) return null;

  return (
    <section className="liquid-nav rounded-[2.3rem] p-5 md:p-7 mb-5 overflow-hidden relative">
      <div className="absolute -right-24 -top-24 w-64 h-64 rounded-full bg-indigo-400/10 blur-3xl" />
      <div className="relative">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-300 mb-2"><TrendingUp size={16} /><span className="text-[10px] uppercase tracking-[0.16em] font-medium">Financial forecast</span></div>
            <h2 className="text-xl md:text-2xl font-semibold tracking-[-0.03em]">Kalau ritme ini berlanjut…</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Proyeksi berdasarkan transaksi aktual, budget, tagihan, dan recurring bulan berjalan.</p>
          </div>
          <Link to="/forecast" className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-300">Lihat detail <ArrowRight size={15} /></Link>
        </div>

        <div className="grid md:grid-cols-3 gap-3 md:gap-4">
          <div className="rounded-[1.8rem] bg-white/42 dark:bg-white/[.04] border border-white/60 dark:border-white/10 p-5">
            <div className="w-9 h-9 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-4"><CalendarRange size={17} /></div>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Proyeksi akhir bulan</p>
            <p className="text-xl md:text-2xl font-semibold mt-2">{rupiah(data.projectedExpense)}</p>
            <p className={`text-[11px] mt-2 ${status?.tone}`}>{status?.label}</p>
          </div>

          <div className="rounded-[1.8rem] bg-white/42 dark:bg-white/[.04] border border-white/60 dark:border-white/10 p-5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 flex items-center justify-center mb-4"><ShieldCheck size={17} /></div>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Aman digunakan</p>
            <p className="text-xl md:text-2xl font-semibold mt-2 text-emerald-700 dark:text-emerald-300">{rupiah(data.safeToSpend)}</p>
            <p className="text-[11px] text-slate-400 mt-2">≈ {rupiah(data.safePerDay)} / hari · {data.daysRemaining} hari tersisa</p>
          </div>

          <div className="rounded-[1.8rem] bg-white/42 dark:bg-white/[.04] border border-white/60 dark:border-white/10 p-5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 flex items-center justify-center mb-4"><Gauge size={17} /></div>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Komitmen tersisa</p>
            <p className="text-xl md:text-2xl font-semibold mt-2">{rupiah(data.scheduledExpense)}</p>
            <p className="text-[11px] text-slate-400 mt-2">Expected income +{rupiah(data.scheduledIncome)}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
