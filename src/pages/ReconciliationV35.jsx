import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, RefreshCw, Scale, WalletCards } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { calculateWalletBalances, rupiah } from '../lib/financeDataV35';

export default function ReconciliationV35() {
  const { user } = useAuth();
  const [wallets, setWallets] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedWallet, setSelectedWallet] = useState('');
  const [actualBalance, setActualBalance] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);

    const [walletRes, txRes, transferRes, adjustmentRes, historyRes] = await Promise.all([
      supabase.from('wallets').select('*').eq('user_id', user.id).order('created_at'),
      supabase
        .from('transactions')
        .select('amount, wallet_id, transaction_date, categories(type)')
        .eq('user_id', user.id),
      supabase
        .from('transfers')
        .select('amount, from_wallet_id, to_wallet_id, transfer_date')
        .eq('user_id', user.id),
      supabase
        .from('wallet_adjustments')
        .select('amount, wallet_id, adjustment_date, actual_balance, created_at')
        .eq('user_id', user.id),
      supabase
        .from('wallet_adjustments')
        .select('id, amount, adjustment_date, expected_balance, actual_balance, reason, created_at, wallets(name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(12),
    ]);

    const error =
      walletRes.error
      || txRes.error
      || transferRes.error
      || adjustmentRes.error
      || historyRes.error;

    if (error) {
      toast.error(error.message || 'Gagal memuat rekonsiliasi');
      setLoading(false);
      return;
    }

    const calculated = calculateWalletBalances(
      walletRes.data || [],
      txRes.data || [],
      transferRes.data || [],
      adjustmentRes.data || [],
    );

    setWallets(calculated);
    setHistory(historyRes.data || []);
    setSelectedWallet((current) =>
      calculated.some((item) => String(item.id) === String(current))
        ? current
        : calculated[0]?.id || ''
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const wallet = useMemo(
    () => wallets.find((item) => String(item.id) === String(selectedWallet)),
    [wallets, selectedWallet],
  );

  const actual = actualBalance === '' ? null : Number(actualBalance);
  const expected = Number(wallet?.month_balance || 0);
  const difference = actual == null || !Number.isFinite(actual) ? null : actual - expected;

  const reconcile = async (event) => {
    event.preventDefault();

    if (!wallet) return toast.error('Pilih dompet');
    if (actual == null || !Number.isFinite(actual)) return toast.error('Masukkan saldo nyata');

    if (difference === 0) {
      toast.success('Saldo sudah cocok. Tidak ada adjustment yang dibuat.');
      return;
    }

    setSaving(true);

    const { error } = await supabase.from('wallet_adjustments').insert([{
      user_id: user.id,
      wallet_id: wallet.id,
      amount: difference,
      adjustment_date: format(new Date(), 'yyyy-MM-dd'),
      expected_balance: expected,
      actual_balance: actual,
      reason: reason.trim() || 'Rekonsiliasi saldo',
    }]);

    setSaving(false);

    if (error) return toast.error(error.message);

    toast.success('Saldo berhasil direkonsiliasi');
    setActualBalance('');
    setReason('');
    load();
  };

  return (
    <main className="min-h-screen pb-32 md:pb-16 pt-8 md:pt-32 text-slate-900 dark:text-slate-100">
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <header className="mb-8 max-w-3xl">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-300 mb-2">
            <Scale size={16} />
            <span className="text-[10px] uppercase tracking-[0.16em] font-medium">Data Quality / Reconciliation</span>
          </div>
          <h1 className="text-[2rem] md:text-[2.7rem] font-semibold tracking-[-0.04em]">Cocokkan saldo nyata</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
            Bandingkan saldo Lar Finance dengan mobile banking atau uang tunai yang benar-benar kamu punya. Selisih dicatat sebagai adjustment, bukan mengubah histori transaksi lama.
          </p>
        </header>

        {loading ? (
          <div className="liquid-nav rounded-[2.3rem] h-80 animate-pulse" />
        ) : !wallets.length ? (
          <div className="liquid-nav rounded-[2.2rem] p-12 text-center">
            <WalletCards size={30} className="mx-auto text-slate-300 mb-4" />
            <p className="font-semibold">Belum ada dompet untuk direkonsiliasi.</p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_.82fr] gap-5 items-start">
            <form onSubmit={reconcile} className="liquid-nav rounded-[2.3rem] p-6 md:p-8 space-y-6">
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Dompet</span>
                <select
                  value={selectedWallet}
                  onChange={(e) => {
                    setSelectedWallet(e.target.value);
                    setActualBalance('');
                  }}
                  className="w-full mt-2 rounded-2xl px-4 py-4 font-medium outline-none"
                >
                  {wallets.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-[1.8rem] bg-white/40 dark:bg-white/[.04] border border-white/60 dark:border-white/10 p-5">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">Menurut Lar Finance</p>
                  <p className="text-2xl font-semibold mt-2">{rupiah(expected)}</p>
                </div>

                <label className="rounded-[1.8rem] bg-white/40 dark:bg-white/[.04] border border-white/60 dark:border-white/10 p-5">
                  <span className="text-[10px] uppercase tracking-wide text-slate-400">Saldo nyata sekarang</span>
                  <input
                    autoFocus
                    type="number"
                    value={actualBalance}
                    onChange={(e) => setActualBalance(e.target.value)}
                    placeholder="0"
                    className="w-full bg-transparent mt-2 text-2xl font-semibold outline-none"
                  />
                </label>
              </div>

              {difference != null && (
                <div className={`rounded-2xl p-4 flex items-center justify-between gap-4 ${
                  difference === 0
                    ? 'bg-emerald-500/[.08] text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-500/[.09] text-amber-700 dark:text-amber-300'
                }`}>
                  <div>
                    <p className="text-xs font-medium">{difference === 0 ? 'Saldo cocok' : 'Selisih ditemukan'}</p>
                    <p className="text-[11px] opacity-80 mt-1">
                      {difference === 0
                        ? 'Tidak perlu membuat adjustment.'
                        : 'Adjustment membuat saldo aplikasi sama dengan saldo nyata tanpa menghapus transaksi.'}
                    </p>
                  </div>
                  <p className="font-semibold whitespace-nowrap">
                    {difference > 0 ? '+' : ''}{rupiah(difference)}
                  </p>
                </div>
              )}

              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Catatan selisih · opsional</span>
                <textarea
                  rows={3}
                  maxLength={180}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Contoh: lupa mencatat biaya admin bank..."
                  className="w-full mt-2 rounded-2xl px-4 py-4 font-medium outline-none resize-none"
                />
              </label>

              <button
                disabled={saving || actual == null || !Number.isFinite(actual)}
                className="liquid-primary w-full h-12 rounded-2xl text-white font-medium text-sm inline-flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {difference === 0 ? <CheckCircle2 size={16} /> : <RefreshCw size={16} />}
                {saving ? 'Mencocokkan…' : difference === 0 ? 'Saldo sudah cocok' : 'Terapkan rekonsiliasi'}
              </button>
            </form>

            <aside className="liquid-nav rounded-[2.2rem] p-5 md:p-6 lg:sticky lg:top-28">
              <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Audit trail</p>
              <h2 className="text-xl font-semibold mt-1 mb-5">Rekonsiliasi terbaru</h2>

              {history.length ? (
                <div className="space-y-3">
                  {history.map((item) => (
                    <div key={item.id} className="rounded-2xl bg-white/35 dark:bg-white/[.035] border border-white/55 dark:border-white/10 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{item.wallets?.name || 'Dompet'}</p>
                          <p className="text-[10px] text-slate-400 mt-1">{item.adjustment_date}</p>
                        </div>
                        <p className={`text-sm font-semibold ${Number(item.amount) >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-500'}`}>
                          {Number(item.amount) > 0 ? '+' : ''}{rupiah(item.amount)}
                        </p>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-3">
                        {rupiah(item.expected_balance)} → {rupiah(item.actual_balance)}
                      </p>
                      {item.reason && <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{item.reason}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center text-sm text-slate-400">Belum ada rekonsiliasi.</div>
              )}
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
