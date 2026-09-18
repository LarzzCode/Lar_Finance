import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HandCoins, Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { rupiah } from '../lib/financeDataV35';

const emptyDebt = {
  kind: 'payable',
  counterparty: '',
  original_amount: '',
  due_date: '',
  note: '',
};

export default function DebtsV36() {
  const { user } = useAuth();
  const [debts, setDebts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [debtModal, setDebtModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [activeDebt, setActiveDebt] = useState(null);
  const [form, setForm] = useState(emptyDebt);
  const [payment, setPayment] = useState({ amount: '', note: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);

    const [debtRes, paymentRes] = await Promise.all([
      supabase.from('debts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('debt_payments').select('*').eq('user_id', user.id).order('payment_date', { ascending: false }),
    ]);

    const error = debtRes.error || paymentRes.error;
    if (error) toast.error(error.message || 'Gagal memuat utang/piutang');

    setDebts(debtRes.data || []);
    setPayments(paymentRes.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const enriched = useMemo(() => debts.map((debt) => {
    const paid = payments
      .filter((item) => String(item.debt_id) === String(debt.id))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const original = Number(debt.original_amount || 0);
    return {
      ...debt,
      paid,
      outstanding: Math.max(original - paid, 0),
      percent: original > 0 ? Math.min((paid / original) * 100, 100) : 0,
    };
  }), [debts, payments]);

  const summary = useMemo(() => enriched.reduce((acc, item) => {
    if (item.kind === 'payable') acc.payable += item.outstanding;
    else acc.receivable += item.outstanding;
    return acc;
  }, { payable: 0, receivable: 0 }), [enriched]);

  const saveDebt = async (event) => {
    event.preventDefault();
    const amount = Number(form.original_amount || 0);
    if (!form.counterparty.trim()) return toast.error('Nama pihak wajib diisi');
    if (!Number.isFinite(amount) || amount <= 0) return toast.error('Nominal harus lebih dari 0');

    setSaving(true);
    const { error } = await supabase.from('debts').insert([{
      user_id: user.id,
      kind: form.kind,
      counterparty: form.counterparty.trim(),
      original_amount: amount,
      due_date: form.due_date || null,
      note: form.note.trim() || null,
    }]);
    setSaving(false);

    if (error) return toast.error(error.message);

    toast.success(form.kind === 'payable' ? 'Utang dicatat' : 'Piutang dicatat');
    setDebtModal(false);
    setForm(emptyDebt);
    load();
  };

  const addPayment = async (event) => {
    event.preventDefault();
    if (!activeDebt) return;
    const amount = Number(payment.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) return toast.error('Nominal harus lebih dari 0');
    if (amount > activeDebt.outstanding) return toast.error('Pembayaran melebihi sisa outstanding');

    setSaving(true);
    const { error } = await supabase.from('debt_payments').insert([{
      user_id: user.id,
      debt_id: activeDebt.id,
      amount,
      payment_date: format(new Date(), 'yyyy-MM-dd'),
      note: payment.note.trim() || null,
    }]);
    setSaving(false);

    if (error) return toast.error(error.message);

    toast.success('Pembayaran dicatat');
    setPaymentModal(false);
    setActiveDebt(null);
    setPayment({ amount: '', note: '' });
    load();
  };

  const remove = async (debt) => {
    if (!window.confirm(`Hapus catatan ${debt.kind === 'payable' ? 'utang' : 'piutang'} dengan ${debt.counterparty}?`)) return;
    const { error } = await supabase.from('debts').delete().eq('id', debt.id).eq('user_id', user.id);
    if (error) return toast.error(error.message);
    toast.success('Catatan dihapus');
    load();
  };

  return (
    <main className="min-h-screen pb-32 md:pb-16 pt-8 md:pt-32 text-slate-900 dark:text-slate-100">
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-8">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Wealth / Debt tracker</p>
            <h1 className="text-[2rem] md:text-[2.7rem] font-semibold tracking-[-0.04em] mt-1">Utang & piutang</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-2xl">
              Pisahkan uang yang benar-benar habis dari uang yang masih harus dibayar atau ditagih kembali.
            </p>
          </div>
          <button onClick={() => setDebtModal(true)} className="liquid-primary text-white inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-medium"><Plus size={17} /> Catatan baru</button>
        </header>

        <section className="grid sm:grid-cols-3 gap-3 mb-6">
          <div className="liquid-nav rounded-[1.8rem] p-5"><p className="text-[10px] uppercase tracking-wide text-rose-500">Utang tersisa</p><p className="text-xl font-semibold mt-2 text-rose-500">{rupiah(summary.payable)}</p></div>
          <div className="liquid-nav rounded-[1.8rem] p-5"><p className="text-[10px] uppercase tracking-wide text-emerald-600">Piutang tersisa</p><p className="text-xl font-semibold mt-2 text-emerald-600 dark:text-emerald-300">{rupiah(summary.receivable)}</p></div>
          <div className="liquid-nav rounded-[1.8rem] p-5"><p className="text-[10px] uppercase tracking-wide text-indigo-500">Net posisi</p><p className="text-xl font-semibold mt-2">{rupiah(summary.receivable - summary.payable)}</p></div>
        </section>

        <div className="liquid-nav rounded-[1.8rem] p-4 mb-5 text-xs text-slate-500 dark:text-slate-400">
          Pembayaran di sini hanya memperbarui status utang/piutang. Kalau uang benar-benar keluar/masuk dompet, catat juga transaksinya agar cashflow tetap akurat.
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 gap-4">{[1,2].map((item) => <div key={item} className="h-48 liquid-nav rounded-[2rem] animate-pulse" />)}</div>
        ) : !enriched.length ? (
          <div className="liquid-nav rounded-[2.2rem] py-16 text-center"><HandCoins size={30} className="mx-auto text-slate-300 mb-4" /><h2 className="text-xl font-semibold">Belum ada utang atau piutang</h2></div>
        ) : (
          <section className="grid md:grid-cols-2 gap-4">
            {enriched.map((debt) => {
              const done = debt.outstanding <= 0;
              return (
                <article key={debt.id} className={`liquid-nav rounded-[2rem] p-5 md:p-6 ${done ? 'opacity-65' : ''}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0"><div className="flex items-center gap-2 flex-wrap"><h2 className="text-lg font-semibold truncate">{debt.counterparty}</h2><span className={`text-[9px] uppercase tracking-wide rounded-full px-2 py-1 ${debt.kind === 'payable' ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'}`}>{debt.kind === 'payable' ? 'Utang' : 'Piutang'}</span>{done && <span className="text-[9px] text-slate-400">Lunas</span>}</div><p className="text-xs text-slate-400 mt-1">{debt.due_date ? `Jatuh tempo ${debt.due_date}` : 'Tanpa jatuh tempo'}</p></div>
                    <button onClick={() => remove(debt)} className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center"><Trash2 size={15} /></button>
                  </div>

                  <div className="mt-6"><p className="text-[10px] uppercase tracking-wide text-slate-400">Outstanding</p><p className={`text-2xl font-semibold mt-1 ${debt.kind === 'payable' ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-300'}`}>{rupiah(debt.outstanding)}</p><p className="text-xs text-slate-400 mt-1">dari {rupiah(debt.original_amount)}</p></div>
                  <div className="mt-4 h-2 rounded-full bg-slate-200/60 dark:bg-white/10 overflow-hidden"><div className="h-full bg-indigo-500 rounded-full" style={{ width: `${debt.percent}%` }} /></div>
                  {debt.note && <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">{debt.note}</p>}

                  {!done && <button onClick={() => { setActiveDebt(debt); setPayment({ amount: '', note: '' }); setPaymentModal(true); }} className="mt-5 w-full h-11 rounded-2xl bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-sm font-medium">+ Catat pembayaran</button>}
                </article>
              );
            })}
          </section>
        )}
      </div>

      <AnimatePresence>
        {debtModal && <div className="fixed inset-0 z-[110] bg-slate-950/40 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"><motion.div initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} exit={{opacity:0,y:24}} className="liquid-nav w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6"><div className="flex items-center justify-between mb-5"><h3 className="text-xl font-semibold">Catatan baru</h3><button onClick={()=>setDebtModal(false)} className="w-9 h-9 rounded-full bg-white/45 dark:bg-white/[.05] flex items-center justify-center"><X size={17}/></button></div><form onSubmit={saveDebt} className="space-y-4"><div className="grid grid-cols-2 gap-3"><button type="button" onClick={()=>setForm({...form,kind:'payable'})} className={`h-11 rounded-2xl text-sm font-medium ${form.kind==='payable'?'bg-rose-500 text-white':'bg-white/45 dark:bg-white/[.05]'}`}>Saya berutang</button><button type="button" onClick={()=>setForm({...form,kind:'receivable'})} className={`h-11 rounded-2xl text-sm font-medium ${form.kind==='receivable'?'bg-emerald-500 text-white':'bg-white/45 dark:bg-white/[.05]'}`}>Orang berutang ke saya</button></div><input required value={form.counterparty} onChange={(e)=>setForm({...form,counterparty:e.target.value})} placeholder="Nama orang / pihak" className="w-full rounded-2xl px-4 py-4 font-medium outline-none"/><input required type="number" min="1" value={form.original_amount} onChange={(e)=>setForm({...form,original_amount:e.target.value})} placeholder="Nominal awal" className="w-full rounded-2xl px-4 py-4 font-medium outline-none"/><input type="date" value={form.due_date} onChange={(e)=>setForm({...form,due_date:e.target.value})} className="w-full rounded-2xl px-4 py-4 outline-none"/><textarea rows={3} value={form.note} onChange={(e)=>setForm({...form,note:e.target.value})} placeholder="Catatan opsional" className="w-full rounded-2xl px-4 py-4 outline-none resize-none"/><button disabled={saving} className="liquid-primary w-full h-12 rounded-2xl text-white font-medium">{saving?'Menyimpan…':'Simpan'}</button></form></motion.div></div>}
        {paymentModal && activeDebt && <div className="fixed inset-0 z-[110] bg-slate-950/40 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"><motion.div initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} exit={{opacity:0,y:24}} className="liquid-nav w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6"><div className="flex items-center justify-between mb-5"><div><p className="text-[10px] uppercase tracking-wide text-slate-400">Pembayaran</p><h3 className="text-xl font-semibold mt-1">{activeDebt.counterparty}</h3><p className="text-xs text-slate-400 mt-1">Sisa {rupiah(activeDebt.outstanding)}</p></div><button onClick={()=>setPaymentModal(false)} className="w-9 h-9 rounded-full bg-white/45 dark:bg-white/[.05] flex items-center justify-center"><X size={17}/></button></div><form onSubmit={addPayment} className="space-y-4"><input autoFocus required type="number" min="1" max={activeDebt.outstanding} value={payment.amount} onChange={(e)=>setPayment({...payment,amount:e.target.value})} placeholder="Nominal pembayaran" className="w-full rounded-2xl px-4 py-4 text-xl font-semibold outline-none"/><input value={payment.note} onChange={(e)=>setPayment({...payment,note:e.target.value})} placeholder="Catatan opsional" className="w-full rounded-2xl px-4 py-4 outline-none"/><button disabled={saving} className="w-full h-12 rounded-2xl bg-indigo-500 text-white font-medium">{saving?'Menyimpan…':'Catat pembayaran'}</button></form></motion.div></div>}
      </AnimatePresence>
    </main>
  );
}
