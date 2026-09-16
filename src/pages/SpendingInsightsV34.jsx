import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowDownRight, ArrowLeft, ArrowUpRight, BadgeCheck, BarChart3, SearchCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { rupiah } from '../lib/financeDataV31';
import { anomalyQueryStart, buildSpendingAnomalies, formatInsightDate } from '../lib/anomalyDetectionV34';

const severityMeta = {
  high: { label: 'Tinggi', className: 'text-rose-500 bg-rose-500/10' },
  medium: { label: 'Perlu perhatian', className: 'text-orange-500 bg-orange-500/10' },
  watch: { label: 'Pantau', className: 'text-amber-600 bg-amber-500/10' },
};

export default function SpendingInsightsV34() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      setError('');
      const start = anomalyQueryStart(new Date(), 6);
      const { data, error: queryError } = await supabase
        .from('transactions')
        .select('id, amount, category_id, transaction_date, description, categories(name, type)')
        .eq('user_id', user.id)
        .gte('transaction_date', start)
        .order('transaction_date');
      if (queryError) setError(queryError.message || 'Gagal membaca histori transaksi');
      setTransactions(data || []);
      setLoading(false);
    };
    load();
  }, [user]);

  const analysis = useMemo(() => buildSpendingAnomalies(transactions, new Date(), 6), [transactions]);
  const topAnomaly = analysis.anomalies[0];
  const totalDirectionUp = Number(analysis.totalPercentChange || 0) > 0;

  return (
    <main className="min-h-screen pb-32 md:pb-16 pt-8 md:pt-32 text-slate-900 dark:text-slate-100">
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <header className="mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-4"><ArrowLeft size={14} /> Dashboard</Link>
          <p className="text-[10px] uppercase tracking-[0.16em] font-medium text-slate-400">Intelligence / Spending</p>
          <h1 className="text-[2rem] md:text-[2.7rem] font-semibold tracking-[-0.04em] mt-1">Spending anomaly detection</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-3xl leading-relaxed">Lar Finance membandingkan pengeluaran minggu berjalan dengan periode hari yang sama pada 6 minggu sebelumnya. Median dipakai sebagai baseline agar satu minggu ekstrem tidak mendistorsi pola normal.</p>
        </header>

        {error && <div className="liquid-nav rounded-2xl p-4 mb-5 text-sm text-rose-500">{error}</div>}

        <section className="grid md:grid-cols-3 gap-4 mb-5">
          <div className="liquid-nav rounded-[2rem] p-5 md:p-6">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Minggu berjalan</p>
            <p className="text-2xl font-semibold mt-2">{loading ? '…' : rupiah(analysis.currentTotal)}</p>
            <p className="text-[11px] text-slate-400 mt-2">{formatInsightDate(analysis.currentStart)} – {formatInsightDate(analysis.currentEnd)}</p>
          </div>
          <div className="liquid-nav rounded-[2rem] p-5 md:p-6">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Baseline median</p>
            <p className="text-2xl font-semibold mt-2">{loading ? '…' : rupiah(analysis.totalBaseline)}</p>
            <p className="text-[11px] text-slate-400 mt-2">Median 6 periode pembanding</p>
          </div>
          <div className="liquid-nav rounded-[2rem] p-5 md:p-6">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Perubahan total</p>
            <div className={`mt-2 flex items-center gap-2 ${totalDirectionUp ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-300'}`}>{totalDirectionUp ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}<p className="text-2xl font-semibold">{analysis.totalPercentChange == null ? '—' : `${Math.abs(Math.round(analysis.totalPercentChange))}%`}</p></div>
            <p className="text-[11px] text-slate-400 mt-2">{analysis.totalPercentChange == null ? 'Belum ada baseline' : totalDirectionUp ? 'di atas pola biasanya' : 'di bawah pola biasanya'}</p>
          </div>
        </section>

        <section className="liquid-nav rounded-[2.3rem] p-6 md:p-8 mb-5">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div><p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Detection result</p><h2 className="text-xl md:text-2xl font-semibold mt-1">{analysis.anomalies.length ? `${analysis.anomalies.length} pola tidak biasa terdeteksi` : 'Belum ada lonjakan yang signifikan'}</h2></div>
            {analysis.anomalies.length ? <AlertTriangle className="text-amber-500" size={22} /> : <BadgeCheck className="text-emerald-500" size={22} />}
          </div>

          {loading ? <div className="h-32 rounded-2xl bg-white/30 dark:bg-white/[.03] animate-pulse" /> : !analysis.hasEnoughOverallHistory ? (
            <div className="rounded-2xl bg-indigo-500/[.06] p-5 text-sm text-slate-600 dark:text-slate-300"><SearchCheck size={20} className="text-indigo-500 mb-3" />Histori pembanding belum cukup konsisten. Lar Finance membutuhkan setidaknya 3 minggu berisi transaksi agar perbandingan total lebih bermakna.</div>
          ) : analysis.anomalies.length ? (
            <div className="space-y-3">
              {analysis.anomalies.map((item) => {
                const meta = severityMeta[item.severity] || severityMeta.watch;
                return <article key={item.key} className="rounded-[1.7rem] border border-white/60 dark:border-white/10 bg-white/38 dark:bg-white/[.03] p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"><div><div className="flex items-center gap-2 flex-wrap"><h3 className="text-lg font-semibold">{item.name}</h3><span className={`text-[10px] rounded-full px-2.5 py-1 font-medium ${meta.className}`}>{meta.label}</span></div><p className="text-xs text-slate-400 mt-1">{item.transactionCount} transaksi minggu ini · aktif pada {item.activeHistoryWeeks}/6 minggu pembanding</p></div><div className="sm:text-right"><p className="text-xl font-semibold text-rose-500">{rupiah(item.current)}</p><p className="text-[11px] text-slate-400 mt-1">biasanya {rupiah(item.baseline)}</p></div></div>
                  <div className="mt-4 rounded-2xl bg-rose-500/[.06] p-4"><p className="text-sm font-medium text-rose-600 dark:text-rose-300">↑ {item.reason}</p><p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Selisih {rupiah(item.difference)} dibanding baseline median.</p></div>
                </article>;
              })}
            </div>
          ) : (
            <div className="py-8 text-center"><BadgeCheck size={30} className="mx-auto text-emerald-400 mb-3" /><p className="font-medium">Ritme pengeluaran masih dekat dengan pola historis.</p><p className="text-sm text-slate-400 mt-2">Kategori baru atau kategori dengan histori terlalu sedikit tidak langsung dianggap anomali.</p></div>
          )}
        </section>

        <section className="liquid-nav rounded-[2.3rem] p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6"><BarChart3 size={20} className="text-indigo-500" /><div><p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Category baseline</p><h2 className="text-xl font-semibold mt-1">Kategori minggu ini</h2></div></div>
          {analysis.categories.length ? <div className="space-y-3">{analysis.categories.map((item) => <div key={item.key} className="rounded-2xl bg-white/36 dark:bg-white/[.03] border border-white/50 dark:border-white/10 p-4 flex items-center justify-between gap-4"><div className="min-w-0"><p className="text-sm font-medium truncate">{item.name}</p><p className="text-[11px] text-slate-400 mt-1">Median {rupiah(item.baseline)} · {item.enoughHistory ? 'baseline cukup' : 'histori belum cukup'}</p></div><div className="text-right shrink-0"><p className="text-sm font-semibold">{rupiah(item.current)}</p>{item.percentChange != null && <p className={`text-[10px] mt-1 ${item.percentChange > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>{item.percentChange > 0 ? '+' : ''}{Math.round(item.percentChange)}%</p>}</div></div>)}</div> : <div className="py-10 text-center text-sm text-slate-400">Belum ada pengeluaran minggu ini.</div>}
        </section>

        {topAnomaly && <p className="text-[11px] text-slate-400 text-center mt-5">Deteksi adalah sinyal pola, bukan penilaian apakah transaksi tersebut benar atau salah.</p>}
      </div>
    </main>
  );
}
