import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, Coins, Pencil, Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, differenceInCalendarMonths, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { rupiah } from '../lib/financeDataV35';

const emptyFund = { name: '', target_amount: '', target_date: '', emoji: '🎯' };

export default function SinkingFundsV36() {
  const { user } = useAuth();
  const [funds, setFunds] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fundModal, setFundModal] = useState(false);
  const [contributionModal, setContributionModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [activeFund, setActiveFund] = useState(null);
  const [form, setForm] = useState(emptyFund);
  const [contribution, setContribution] = useState({ amount: '', note: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [fundRes, contributionRes] = await Promise.all([
      supabase.from('sinking_funds').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('sinking_fund_contributions').select('*').eq('user_id', user.id).order('contribution_date', { ascending: false }),
    ]);
    const error = fundRes.error || contributionRes.error;
    if (error) toast.error(error.message || 'Gagal memuat sinking funds');
    setFunds(fundRes.data || []);
    setContributions(contributionRes.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const enriched = useMemo(() => funds.map((fund) => {
    const current = contributions
      .filter((item) => String(item.fund_id) === String(fund.id))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const target = Number(fund.target_amount || 0);
    const remaining = Math.max(target - current, 0);
    const months = fund.target_date
      ? Math.max(differenceInCalendarMonths(parseISO(fund.target_date), new Date()) + 1, 1)
      : null;
    return {
      ...fund,
      current,
      remaining,
      percent: target > 0 ? Math.min((current / target) * 100, 100) : 0,
      monthlySuggestion: months ? remaining / months : null,
    };
  }), [funds, contributions]);

  const totals = useMemo(() => enriched.reduce((acc, item) => ({
    target: acc.target + Number(item.target_amount || 0),
    current: acc.current + item.current,
  }), { target: 0, current: 0 }), [enriched]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyFund);
    setFundModal(true);
  };

  const openEdit = (fund) => {
    setEditing(fund);
    setForm({
      name: fund.name || '',
      target_amount: String(fund.target_amount || ''),
      target_date: fund.target_date || '',
      emoji: fund.emoji || '🎯',
    });
    setFundModal(true);
  };

  const saveFund = async (event) => {
    event.preventDefault();
    const target = Number(form.target_amount || 0);
    if (!form.name.trim()) return toast.error('Nama dana wajib diisi');
    if (!Number.isFinite(target) || target <= 0) return toast.error('Target harus lebih dari 0');

    setSaving(true);
    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      target_amount: target,
      target_date: form.target_date || null,
      emoji: form.emoji.trim() || '🎯',
      updated_at: new Date().toISOString(),
    };
    const result = editing
      ? await supabase.from('sinking_funds').update(payload).eq('id', editing.id).eq('user_id', user.id)
      : await supabase.from('sinking_funds').insert([payload]);
    setSaving(false);
    if (result.error) return toast.error(result.error.message);
    toast.success(editing ? 'Sinking fund diperbarui' : 'Sinking fund dibuat');
    setFundModal(false);
    load();
  };

  const addContribution = async (event) => {
    event.preventDefault();
    const amount = Number(contribution.amount || 0);
    if (!activeFund) return;
    if (!Number.isFinite(amount) || amount <= 0) return toast.error('Nominal harus lebih dari 0');

    setSaving(true);
    const { error } = await supabase.from('sinking_fund_contributions').insert([{
      user_id: user.id,
      fund_id: activeFund.id,
      amount,
      contribution_date: format(new Date(), 'yyyy-MM-dd'),
      note: contribution.note.trim() || null,
    }]);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Setoran sinking fund dicatat');
    setContributionModal(false);
    setContribution({ amount: '', note: '' });
    setActiveFund(null);
    load();
  };

  const remove = async (fund) => {
    if (!window.confirm(`Hapus sinking fund “${fund.name}” beserta histori setornya?`)) return;
    const { error } = await supabase.from('sinking_funds').delete().eq('id', fund.id).eq('user_id', user.id);
    if (error) return toast.error(error.message);
    toast.success('Sinking fund dihapus');
    load();
  };

  return (
    <main className="min-h-screen pb-32 md:pb-16 pt-8 md:pt-32 text-slate-900 dark:text-slate-100">
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-8">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Wealth / Sinking Funds</p>
            <h1 className="text-[2rem] md:text-[2.7rem] font-semibold tracking-[-0.04em] mt-1">Siapkan pengeluaran besar pelan-pelan</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-2xl">
              Pajak, servis, liburan, atau gadget tidak perlu terasa seperti bom. Pecah target besar menjadi setoran kecil yang terencana.
            </p>
          </div>
          <button onClick={openNew} className="liquid-primary text-white inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-medium"><Plus size={17} /> Fund baru</button>
        </header>

        <section className="grid sm:grid-cols-3 gap-3 mb-6">
          <div className="liquid-nav rounded-[1.8rem] p-5"><p className="text-[10px] uppercase tracking-wide text-slate-400">Target total</p><p className="text-xl font-semibold mt-2">{rupiah(totals.target)}</p></div>
          <div className="liquid-nav rounded-[1.8rem] p-5"><p className="text-[10px] uppercase tracking-wide text-emerald-600">Terkumpul</p><p className="text-xl font-semibold mt-2 text-emerald-600 dark:text-emerald-300">{rupiah(totals.current)}</p></div>
          <div className="liquid-nav rounded-[1.8rem] p-5"><p className="text-[10px] uppercase tracking-wide text-indigo-500">Fund aktif</p><p className="text-xl font-semibold mt-2">{funds.length}</p></div>
        </section>

        <div className="liquid-nav rounded-[1.8rem] p-4 mb-5 text-xs text-slate-500 dark:text-slate-400">
          Sinking Fund adalah <strong>alokasi perencanaan</strong>, bukan transaksi bank. Menambah setoran di sini tidak otomatis mengurangi saldo dompet agar cashflow tidak double-count.
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 gap-4">{[1,2].map((item) => <div key={item} className="h-52 liquid-nav rounded-[2rem] animate-pulse" />)}</div>
        ) : !enriched.length ? (
          <div className="liquid-nav rounded-[2.2rem] py-16 text-center"><Coins size={30} className="mx-auto text-slate-300 mb-4" /><h2 className="text-xl font-semibold">Belum ada sinking fund</h2><button onClick={openNew} className="mt-4 text-sm font-medium text-indigo-600">Buat target pertama →</button></div>
        ) : (
          <section className="grid md:grid-cols-2 gap-4">
            {enriched.map((fund) => (
              <article key={fund.id} className="liquid-nav rounded-[2rem] p-5 md:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3 min-w-0"><span className="text-2xl">{fund.emoji}</span><div className="min-w-0"><h2 className="text-lg font-semibold truncate">{fund.name}</h2><p className="text-xs text-slate-400 mt-1">{fund.target_date ? `Target ${fund.target_date}` : 'Tanpa deadline'}</p></div></div>
                  <div className="flex gap-1"><button onClick={() => openEdit(fund)} className="w-9 h-9 rounded-xl bg-white/45 dark:bg-white/[.05] flex items-center justify-center"><Pencil size={15} /></button><button onClick={() => remove(fund)} className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center"><Trash2 size={15} /></button></div>
                </div>

                <div className="mt-6 flex items-end justify-between gap-4"><div><p className="text-[10px] uppercase tracking-wide text-slate-400">Terkumpul</p><p className="text-2xl font-semibold mt-1">{rupiah(fund.current)}</p></div><p className="text-xs text-slate-400">/ {rupiah(fund.target_amount)}</p></div>
                <div className="mt-3 h-2 rounded-full bg-slate-200/60 dark:bg-white/10 overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${fund.percent}%` }} className="h-full rounded-full bg-emerald-500" /></div>
                <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-slate-400"><span>{Math.round(fund.percent)}%</span><span>Sisa {rupiah(fund.remaining)}</span></div>

                {fund.monthlySuggestion != null && fund.remaining > 0 && (
                  <div className="mt-4 rounded-2xl bg-indigo-500/[.06] p-3"><p className="text-[10px] uppercase tracking-wide text-indigo-500">Saran setoran</p><p className="text-sm font-medium mt-1">{rupiah(fund.monthlySuggestion)} / bulan</p></div>
                )}

                <button onClick={() => { setActiveFund(fund); setContribution({ amount: '', note: '' }); setContributionModal(true); }} className="mt-5 w-full h-11 rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-sm font-medium">+ Catat setoran</button>
              </article>
            ))}
          </section>
        )}
      </div>

      <AnimatePresence>
        {fundModal && <div className="fixed inset-0 z-[110] bg-slate-950/40 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"><motion.div initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} exit={{opacity:0,y:24}} className="liquid-nav w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6"><div className="flex items-center justify-between mb-5"><h3 className="text-xl font-semibold">{editing ? 'Edit sinking fund' : 'Sinking fund baru'}</h3><button onClick={() => setFundModal(false)} className="w-9 h-9 rounded-full bg-white/45 dark:bg-white/[.05] flex items-center justify-center"><X size={17}/></button></div><form onSubmit={saveFund} className="space-y-4"><div className="grid grid-cols-[80px_1fr] gap-3"><input value={form.emoji} onChange={(e)=>setForm({...form,emoji:e.target.value})} className="rounded-2xl px-4 py-4 text-center text-xl outline-none" maxLength={4}/><input required value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} placeholder="Pajak motor, liburan..." className="rounded-2xl px-4 py-4 font-medium outline-none"/></div><input required type="number" min="1" value={form.target_amount} onChange={(e)=>setForm({...form,target_amount:e.target.value})} placeholder="Target nominal" className="w-full rounded-2xl px-4 py-4 font-medium outline-none"/><label className="block"><span className="text-[10px] uppercase tracking-wide text-slate-400">Target tanggal · opsional</span><input type="date" value={form.target_date} onChange={(e)=>setForm({...form,target_date:e.target.value})} className="w-full mt-2 rounded-2xl px-4 py-4 outline-none"/></label><button disabled={saving} className="liquid-primary w-full h-12 rounded-2xl text-white font-medium">{saving?'Menyimpan…':'Simpan'}</button></form></motion.div></div>}
        {contributionModal && activeFund && <div className="fixed inset-0 z-[110] bg-slate-950/40 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"><motion.div initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} exit={{opacity:0,y:24}} className="liquid-nav w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6"><div className="flex items-center justify-between mb-5"><div><p className="text-[10px] uppercase tracking-wide text-slate-400">Setoran</p><h3 className="text-xl font-semibold mt-1">{activeFund.name}</h3></div><button onClick={() => setContributionModal(false)} className="w-9 h-9 rounded-full bg-white/45 dark:bg-white/[.05] flex items-center justify-center"><X size={17}/></button></div><form onSubmit={addContribution} className="space-y-4"><input autoFocus required type="number" min="1" value={contribution.amount} onChange={(e)=>setContribution({...contribution,amount:e.target.value})} placeholder="Nominal setoran" className="w-full rounded-2xl px-4 py-4 text-xl font-semibold outline-none"/><input value={contribution.note} onChange={(e)=>setContribution({...contribution,note:e.target.value})} placeholder="Catatan opsional" className="w-full rounded-2xl px-4 py-4 outline-none"/><button disabled={saving} className="w-full h-12 rounded-2xl bg-emerald-500 text-white font-medium">{saving?'Menyimpan…':'Catat setoran'}</button></form></motion.div></div>}
      </AnimatePresence>
    </main>
  );
}
