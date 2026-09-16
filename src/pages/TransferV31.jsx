import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRightLeft, CalendarDays, CheckCircle2, WalletCards } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { calculateWalletBalances, rupiah } from '../lib/financeDataV31';

export default function TransferV31() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ from: '', to: '', amount: '', date: new Date().toISOString().slice(0, 10), note: '' });

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [walletRes, txRes, transferRes] = await Promise.all([
      supabase.from('wallets').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('transactions').select('amount, wallet_id, transaction_date, categories(type)').eq('user_id', user.id),
      supabase.from('transfers').select('amount, from_wallet_id, to_wallet_id, transfer_date').eq('user_id', user.id),
    ]);
    const error = walletRes.error || txRes.error || transferRes.error;
    if (error) {
      toast.error(error.message || 'Gagal memuat dompet');
      setLoading(false);
      return;
    }
    const calculated = calculateWalletBalances(walletRes.data || [], txRes.data || [], transferRes.data || []);
    setWallets(calculated);
    setForm((current) => {
      const from = calculated.some((item) => String(item.id) === String(current.from)) ? current.from : calculated[0]?.id || '';
      const to = calculated.some((item) => String(item.id) === String(current.to) && String(item.id) !== String(from)) ? current.to : calculated.find((item) => String(item.id) !== String(from))?.id || '';
      return { ...current, from, to };
    });
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const source = useMemo(() => wallets.find((item) => String(item.id) === String(form.from)), [wallets, form.from]);
  const target = useMemo(() => wallets.find((item) => String(item.id) === String(form.to)), [wallets, form.to]);
  const amount = Number(String(form.amount).replace(/\D/g, '') || 0);
  const formattedAmount = form.amount ? new Intl.NumberFormat('id-ID').format(amount) : '';
  const afterSource = source ? Number(source.month_balance || 0) - amount : 0;
  const afterTarget = target ? Number(target.month_balance || 0) + amount : 0;
  const valid = source && target && String(source.id) !== String(target.id) && amount > 0 && amount <= Number(source.month_balance || 0);

  const submit = async (event) => {
    event.preventDefault();
    if (!source || !target) return toast.error('Pilih dompet asal dan tujuan');
    if (String(source.id) === String(target.id)) return toast.error('Dompet asal dan tujuan harus berbeda');
    if (amount <= 0) return toast.error('Nominal transfer harus lebih dari 0');
    if (amount > Number(source.month_balance || 0)) return toast.error('Saldo dompet asal tidak mencukupi');

    setSaving(true);
    const { error } = await supabase.from('transfers').insert([{
      user_id: user.id,
      from_wallet_id: source.id,
      to_wallet_id: target.id,
      amount,
      transfer_date: form.date,
      note: form.note.trim() || null,
    }]);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Transfer ke ${target.name} berhasil`);
    navigate('/wallet');
  };

  return (
    <main className="min-h-screen pb-32 md:pb-16 pt-8 md:pt-32 text-slate-900 dark:text-slate-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <button onClick={() => navigate('/wallet')} className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-700 dark:hover:text-white mb-5"><ArrowLeft size={15} /> Kembali ke dompet</button>
        <header className="mb-8 max-w-2xl">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400 mb-2">Wallet transfer</p>
          <h1 className="text-[2rem] md:text-[2.7rem] font-semibold tracking-[-0.04em] leading-tight">Pindahkan uang, bukan cashflow</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">Transfer antar dompet tidak dihitung sebagai pemasukan atau pengeluaran. Total uangmu tetap sama.</p>
        </header>

        {loading ? <div className="liquid-nav rounded-[2.4rem] h-96 animate-pulse" /> : wallets.length < 2 ? (
          <div className="liquid-nav rounded-[2.3rem] p-10 text-center"><WalletCards size={28} className="mx-auto text-slate-300 mb-3" /><p className="font-semibold">Butuh minimal dua dompet</p><p className="text-sm text-slate-400 mt-2">Tambahkan satu dompet lagi sebelum melakukan transfer.</p><button onClick={() => navigate('/wallet')} className="mt-5 text-sm font-medium text-indigo-600 dark:text-indigo-300">Buka Dompet →</button></div>
        ) : (
          <div className="grid lg:grid-cols-[1.15fr_.85fr] gap-6 items-start">
            <form onSubmit={submit} className="liquid-nav rounded-[2.4rem] p-6 md:p-8 space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <label><span className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">Dari dompet</span><select value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value, to: String(e.target.value) === String(form.to) ? '' : form.to })} className="w-full mt-2 rounded-2xl px-4 py-4 font-medium outline-none">{wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} · {rupiah(wallet.month_balance)}</option>)}</select></label>
                <label><span className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">Ke dompet</span><select value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} className="w-full mt-2 rounded-2xl px-4 py-4 font-medium outline-none"><option value="" disabled>Pilih tujuan</option>{wallets.filter((wallet) => String(wallet.id) !== String(form.from)).map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} · {rupiah(wallet.month_balance)}</option>)}</select></label>
              </div>

              <div className="text-center py-5">
                <label htmlFor="transfer-amount" className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400 block mb-2">Nominal transfer</label>
                <div className="flex items-baseline justify-center gap-2"><span className="text-lg text-slate-300">Rp</span><input id="transfer-amount" autoFocus inputMode="numeric" value={formattedAmount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/\D/g, '') })} placeholder="0" className="lf-amount-input max-w-sm w-full text-center text-[2.7rem] md:text-[3.6rem] font-semibold tracking-[-0.05em] text-indigo-600 dark:text-indigo-300" /></div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <label><span className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400"><CalendarDays size={13} /> Tanggal</span><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full mt-2 rounded-2xl px-4 py-4 font-medium outline-none" /></label>
                <label><span className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">Catatan opsional</span><input maxLength={120} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Top up cash, pindah tabungan..." className="w-full mt-2 rounded-2xl px-4 py-4 font-medium outline-none" /></label>
              </div>

              <button disabled={!valid || saving} className="liquid-primary w-full rounded-2xl py-4 text-white font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"><ArrowRightLeft size={16} /> {saving ? 'Memindahkan…' : 'Konfirmasi transfer'}</button>
            </form>

            <aside className="space-y-4 lg:sticky lg:top-28">
              <div className="liquid-nav rounded-[2rem] p-5 md:p-6"><p className="text-[10px] uppercase tracking-[0.14em] font-medium text-slate-400">Preview</p><div className="mt-5 space-y-4"><div><p className="text-xs text-slate-400">{source?.name || 'Dompet asal'}</p><p className={`text-xl font-semibold mt-1 ${afterSource < 0 ? 'text-rose-500' : ''}`}>{rupiah(afterSource)}</p></div><div className="flex justify-center"><ArrowRightLeft size={18} className="text-indigo-500" /></div><div><p className="text-xs text-slate-400">{target?.name || 'Dompet tujuan'}</p><p className="text-xl font-semibold mt-1">{rupiah(afterTarget)}</p></div></div></div>
              <div className="liquid-nav rounded-[1.8rem] p-5 flex gap-3"><CheckCircle2 size={18} className="text-emerald-500 shrink-0" /><p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">Transfer tidak akan muncul sebagai income/expense di Laporan. Hanya saldo kedua dompet yang berubah.</p></div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
