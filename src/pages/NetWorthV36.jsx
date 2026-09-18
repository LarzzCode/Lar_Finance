import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Building2, Plus, Scale, Trash2, WalletCards, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { calculateWalletBalances, rupiah } from '../lib/financeDataV35';

const emptyForm = { item_type: 'asset', name: '', value: '', category: '' };

export default function NetWorthV36() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [debts, setDebts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);

    const [itemRes, walletRes, txRes, transferRes, adjustmentRes, debtRes, paymentRes] = await Promise.all([
      supabase.from('net_worth_items').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('wallets').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('transactions').select('amount, wallet_id, transaction_date, categories(type)').eq('user_id', user.id),
      supabase.from('transfers').select('amount, from_wallet_id, to_wallet_id, transfer_date').eq('user_id', user.id),
      supabase.from('wallet_adjustments').select('amount, wallet_id, adjustment_date, actual_balance, created_at').eq('user_id', user.id),
      supabase.from('debts').select('*').eq('user_id', user.id),
      supabase.from('debt_payments').select('*').eq('user_id', user.id),
    ]);

    const error = itemRes.error || walletRes.error || txRes.error || transferRes.error || adjustmentRes.error || debtRes.error || paymentRes.error;
    if (error) {
      toast.error(error.message || 'Gagal memuat net worth');
      setLoading(false);
      return;
    }

    setItems(itemRes.data || []);
    setWallets(calculateWalletBalances(
      walletRes.data || [],
      txRes.data || [],
      transferRes.data || [],
      adjustmentRes.data || [],
    ));
    setDebts(debtRes.data || []);
    setPayments(paymentRes.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const debtPosition = useMemo(() => debts.reduce((acc, debt) => {
    const paid = payments
      .filter((item) => String(item.debt_id) === String(debt.id))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const outstanding = Math.max(Number(debt.original_amount || 0) - paid, 0);
    if (debt.kind === 'receivable') acc.receivable += outstanding;
    else acc.payable += outstanding;
    return acc;
  }, { receivable: 0, payable: 0 }), [debts, payments]);

  const summary = useMemo(() => {
    const walletAssets = wallets.reduce((sum, wallet) => sum + Number(wallet.month_balance || 0), 0);
    const manualAssets = items.filter((item) => item.item_type === 'asset').reduce((sum, item) => sum + Number(item.value || 0), 0);
    const manualLiabilities = items.filter((item) => item.item_type === 'liability').reduce((sum, item) => sum + Number(item.value || 0), 0);
    const assets = walletAssets + manualAssets + debtPosition.receivable;
    const liabilities = manualLiabilities + debtPosition.payable;
    return {
      walletAssets,
      manualAssets,
      manualLiabilities,
      assets,
      liabilities,
      netWorth: assets - liabilities,
    };
  }, [wallets, items, debtPosition]);

  const save = async (event) => {
    event.preventDefault();
    const value = Number(form.value || 0);
    if (!form.name.trim()) return toast.error('Nama item wajib diisi');
    if (!Number.isFinite(value) || value < 0) return toast.error('Nilai tidak valid');

    setSaving(true);
    const { error } = await supabase.from('net_worth_items').insert([{
      user_id: user.id,
      item_type: form.item_type,
      name: form.name.trim(),
      value,
      category: form.category.trim() || null,
    }]);
    setSaving(false);

    if (error) return toast.error(error.message);

    toast.success('Item net worth ditambahkan');
    setModalOpen(false);
    setForm(emptyForm);
    load();
  };

  const remove = async (item) => {
    if (!window.confirm(`Hapus “${item.name}” dari Net Worth?`)) return;
    const { error } = await supabase.from('net_worth_items').delete().eq('id', item.id).eq('user_id', user.id);
    if (error) return toast.error(error.message);
    toast.success('Item dihapus');
    load();
  };

  return (
    <main className="min-h-screen pb-32 md:pb-16 pt-8 md:pt-32 text-slate-900 dark:text-slate-100">
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-8">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-300 mb-2"><Scale size={16} /><span className="text-[10px] uppercase tracking-[0.16em]">Wealth / Net Worth</span></div>
            <h1 className="text-[2rem] md:text-[2.7rem] font-semibold tracking-[-0.04em]">Kekayaan bersihmu</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-2xl">
              Bukan cuma “bulan ini keluar berapa”, tapi posisi aset dikurangi kewajiban secara keseluruhan.
            </p>
          </div>
          <button onClick={() => setModalOpen(true)} className="liquid-primary text-white inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-medium"><Plus size={17}/> Item manual</button>
        </header>

        {loading ? (
          <div className="liquid-nav rounded-[2.5rem] h-72 animate-pulse" />
        ) : (
          <>
            <section className="relative overflow-hidden rounded-[2.5rem] bg-slate-950 text-white p-6 md:p-9 mb-5">
              <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-500/20 blur-3xl rounded-full" />
              <div className="relative">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Net Worth</p>
                <p className={`text-[2.8rem] md:text-[4.5rem] font-semibold tracking-[-0.055em] mt-4 ${summary.netWorth < 0 ? 'text-rose-300' : ''}`}>{rupiah(summary.netWorth)}</p>
                <p className="text-sm text-slate-400 mt-3">Total aset {rupiah(summary.assets)} − kewajiban {rupiah(summary.liabilities)}</p>
              </div>
            </section>

            <section className="grid md:grid-cols-3 gap-4 mb-5">
              <div className="liquid-nav rounded-[1.9rem] p-5"><WalletCards size={18} className="text-indigo-500 mb-4"/><p className="text-[10px] uppercase tracking-wide text-slate-400">Saldo dompet</p><p className="text-xl font-semibold mt-1">{rupiah(summary.walletAssets)}</p></div>
              <div className="liquid-nav rounded-[1.9rem] p-5"><Building2 size={18} className="text-emerald-500 mb-4"/><p className="text-[10px] uppercase tracking-wide text-slate-400">Piutang</p><p className="text-xl font-semibold mt-1 text-emerald-600 dark:text-emerald-300">{rupiah(debtPosition.receivable)}</p></div>
              <div className="liquid-nav rounded-[1.9rem] p-5"><Scale size={18} className="text-rose-500 mb-4"/><p className="text-[10px] uppercase tracking-wide text-slate-400">Utang</p><p className="text-xl font-semibold mt-1 text-rose-500">{rupiah(debtPosition.payable)}</p></div>
            </section>

            <section className="grid lg:grid-cols-2 gap-5">
              <div className="liquid-nav rounded-[2.2rem] p-5 md:p-6">
                <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Manual assets</p>
                <h2 className="text-xl font-semibold mt-1 mb-5">Aset tambahan</h2>
                <div className="space-y-3">
                  {items.filter((item) => item.item_type === 'asset').map((item) => (
                    <div key={item.id} className="rounded-2xl bg-white/35 dark:bg-white/[.035] p-4 flex items-center justify-between gap-4">
                      <div className="min-w-0"><p className="text-sm font-medium truncate">{item.name}</p><p className="text-[10px] text-slate-400 mt-1">{item.category || 'Aset manual'}</p></div>
                      <div className="flex items-center gap-2"><p className="text-sm font-semibold">{rupiah(item.value)}</p><button onClick={() => remove(item)} className="w-8 h-8 rounded-xl text-rose-500"><Trash2 size={14}/></button></div>
                    </div>
                  ))}
                  {!items.some((item) => item.item_type === 'asset') && <p className="py-8 text-center text-sm text-slate-400">Belum ada aset manual.</p>}
                </div>
              </div>

              <div className="liquid-nav rounded-[2.2rem] p-5 md:p-6">
                <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Manual liabilities</p>
                <h2 className="text-xl font-semibold mt-1 mb-5">Kewajiban tambahan</h2>
                <div className="space-y-3">
                  {items.filter((item) => item.item_type === 'liability').map((item) => (
                    <div key={item.id} className="rounded-2xl bg-white/35 dark:bg-white/[.035] p-4 flex items-center justify-between gap-4">
                      <div className="min-w-0"><p className="text-sm font-medium truncate">{item.name}</p><p className="text-[10px] text-slate-400 mt-1">{item.category || 'Kewajiban manual'}</p></div>
                      <div className="flex items-center gap-2"><p className="text-sm font-semibold text-rose-500">{rupiah(item.value)}</p><button onClick={() => remove(item)} className="w-8 h-8 rounded-xl text-rose-500"><Trash2 size={14}/></button></div>
                    </div>
                  ))}
                  {!items.some((item) => item.item_type === 'liability') && <p className="py-8 text-center text-sm text-slate-400">Belum ada kewajiban manual.</p>}
                </div>
              </div>
            </section>

            <div className="liquid-nav rounded-[1.8rem] p-4 mt-5 text-xs text-slate-500 dark:text-slate-400">
              Saldo dompet, utang, dan piutang ditarik otomatis. Gunakan item manual hanya untuk aset/kewajiban yang belum punya modul sendiri—misalnya deposito, emas, atau cicilan di luar Debt Tracker.
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {modalOpen && <div className="fixed inset-0 z-[110] bg-slate-950/40 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"><motion.div initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} exit={{opacity:0,y:24}} className="lf-mobile-sheet liquid-nav w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6"><div className="flex items-center justify-between mb-5"><h3 className="text-xl font-semibold">Item Net Worth</h3><button onClick={()=>setModalOpen(false)} className="w-9 h-9 rounded-full bg-white/45 dark:bg-white/[.05] flex items-center justify-center"><X size={17}/></button></div><form onSubmit={save} className="space-y-4"><div className="grid grid-cols-2 gap-3"><button type="button" onClick={()=>setForm({...form,item_type:'asset'})} className={`h-11 rounded-2xl text-sm font-medium ${form.item_type==='asset'?'bg-emerald-500 text-white':'bg-white/45 dark:bg-white/[.05]'}`}>Aset</button><button type="button" onClick={()=>setForm({...form,item_type:'liability'})} className={`h-11 rounded-2xl text-sm font-medium ${form.item_type==='liability'?'bg-rose-500 text-white':'bg-white/45 dark:bg-white/[.05]'}`}>Kewajiban</button></div><input required value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} placeholder="Deposito, emas, cicilan..." className="w-full rounded-2xl px-4 py-4 font-medium outline-none"/><input required type="number" min="0" value={form.value} onChange={(e)=>setForm({...form,value:e.target.value})} placeholder="Nilai saat ini" className="w-full rounded-2xl px-4 py-4 font-medium outline-none"/><input value={form.category} onChange={(e)=>setForm({...form,category:e.target.value})} placeholder="Kategori opsional" className="w-full rounded-2xl px-4 py-4 outline-none"/><button disabled={saving} className="liquid-primary w-full h-12 rounded-2xl text-white font-medium">{saving?'Menyimpan…':'Simpan item'}</button></form></motion.div></div>}
      </AnimatePresence>
    </main>
  );
}
