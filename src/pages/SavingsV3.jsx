import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Pencil, PiggyBank, Plus, Sparkles, Trash2, Trophy, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { rupiah } from '../lib/financeData';

const emptyForm = { name: '', target_amount: '', emoji: '🎯', color: 'indigo', current_amount: 0 };
const gradients = {
  indigo: 'from-indigo-500 to-violet-500', emerald: 'from-emerald-500 to-teal-500', amber: 'from-amber-400 to-orange-500', rose: 'from-rose-500 to-pink-500', sky: 'from-sky-500 to-cyan-500',
};

export default function SavingsV3() {
  const { user } = useAuth();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState('new');
  const [activeGoal, setActiveGoal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [depositAmount, setDepositAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const loadGoals = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase.from('goals').select('*').eq('user_id', user.id).order('created_at', { ascending: true });
    if (error) toast.error('Gagal memuat tabungan');
    setGoals(data || []);
    setLoading(false);
  };

  useEffect(() => { loadGoals(); }, [user]);

  const summary = useMemo(() => {
    const totalTarget = goals.reduce((sum, goal) => sum + Number(goal.target_amount || 0), 0);
    const totalSaved = goals.reduce((sum, goal) => sum + Number(goal.current_amount || 0), 0);
    const completed = goals.filter((goal) => Number(goal.target_amount || 0) > 0 && Number(goal.current_amount || 0) >= Number(goal.target_amount || 0)).length;
    return { totalTarget, totalSaved, completed, progress: totalTarget > 0 ? Math.min((totalSaved / totalTarget) * 100, 100) : 0 };
  }, [goals]);

  const close = () => { setModalOpen(false); setActiveGoal(null); setMode('new'); setForm(emptyForm); setDepositAmount(''); };
  const openNew = () => { setMode('new'); setActiveGoal(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (goal) => { setMode('edit'); setActiveGoal(goal); setForm({ name: goal.name || '', target_amount: String(goal.target_amount || ''), emoji: goal.emoji || '🎯', color: goal.color || 'indigo', current_amount: Number(goal.current_amount || 0) }); setModalOpen(true); };
  const openDeposit = (goal) => { setMode('deposit'); setActiveGoal(goal); setDepositAmount(''); setModalOpen(true); };

  const saveGoal = async (event) => {
    event.preventDefault();
    const target = Number(String(form.target_amount).replace(/[^0-9]/g, ''));
    if (!form.name.trim()) return toast.error('Nama target wajib diisi');
    if (!target || target <= 0) return toast.error('Target harus lebih dari 0');
    const payload = { user_id: user.id, name: form.name.trim(), target_amount: target, current_amount: Number(form.current_amount || 0), emoji: form.emoji || '🎯', color: form.color || 'indigo' };
    setSaving(true);
    const response = mode === 'edit' && activeGoal
      ? await supabase.from('goals').update(payload).eq('id', activeGoal.id).eq('user_id', user.id)
      : await supabase.from('goals').insert([payload]);
    setSaving(false);
    if (response.error) return toast.error(response.error.message);
    toast.success(mode === 'edit' ? 'Target diperbarui' : 'Target dibuat');
    close();
    loadGoals();
  };

  const deposit = async (event) => {
    event.preventDefault();
    const amount = Number(String(depositAmount).replace(/[^0-9]/g, ''));
    if (!activeGoal || !amount || amount <= 0) return toast.error('Nominal setoran harus lebih dari 0');
    const newTotal = Number(activeGoal.current_amount || 0) + amount;
    setSaving(true);
    const { error } = await supabase.from('goals').update({ current_amount: newTotal }).eq('id', activeGoal.id).eq('user_id', user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Berhasil menabung ${rupiah(amount)}`);
    if (newTotal >= Number(activeGoal.target_amount || 0)) {
      confetti({ particleCount: 110, spread: 70, origin: { y: 0.65 } });
      toast('Target tercapai! 🎉', { icon: '🏆', duration: 4200 });
    }
    close();
    loadGoals();
  };

  const remove = async (goal) => {
    if (!window.confirm(`Hapus target ${goal.name}?`)) return;
    const { error } = await supabase.from('goals').delete().eq('id', goal.id).eq('user_id', user.id);
    if (error) return toast.error(error.message);
    toast.success('Target dihapus');
    loadGoals();
  };

  return (
    <main className="min-h-screen pb-32 md:pb-16 pt-8 md:pt-32 text-slate-900 dark:text-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-8">
          <div className="max-w-2xl"><p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400 mb-2">Planning / Goals</p><h1 className="text-[2rem] md:text-[2.7rem] font-semibold tracking-[-0.04em] leading-tight">Tabungan impian</h1><p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Lihat progres tujuanmu tanpa kehilangan fokus pada angka yang paling penting.</p></div>
          <button onClick={openNew} className="liquid-primary text-white inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-medium"><Plus size={17} /> Target baru</button>
        </header>

        <section className="liquid-nav rounded-[2.3rem] p-6 md:p-8 mb-6 relative overflow-hidden">
          <div className="absolute -right-24 -top-24 w-64 h-64 rounded-full bg-emerald-400/15 blur-3xl" />
          <div className="relative grid lg:grid-cols-[1fr_.72fr] gap-8 lg:items-end">
            <div><p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">Total terkumpul</p><p className="text-3xl md:text-5xl font-semibold tracking-[-0.045em] mt-2">{loading ? '…' : rupiah(summary.totalSaved)}</p><p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Dari target gabungan {rupiah(summary.totalTarget)}</p></div>
            <div className="grid grid-cols-2 gap-3"><div className="rounded-2xl bg-white/35 dark:bg-white/[.04] p-4"><p className="text-[10px] uppercase tracking-wider font-medium text-slate-400">Goal aktif</p><p className="text-lg font-semibold mt-1">{goals.length}</p></div><div className="rounded-2xl bg-white/35 dark:bg-white/[.04] p-4"><p className="text-[10px] uppercase tracking-wider font-medium text-slate-400">Tercapai</p><p className="text-lg font-semibold text-emerald-600 dark:text-emerald-300 mt-1">{summary.completed}</p></div></div>
          </div>
          <div className="relative mt-7"><div className="flex justify-between text-[10px] font-medium uppercase tracking-wider text-slate-400 mb-2"><span>Progress keseluruhan</span><span>{Math.round(summary.progress)}%</span></div><div className="h-2.5 rounded-full bg-slate-200/60 dark:bg-white/10 overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${summary.progress}%` }} className="h-full rounded-full bg-emerald-500" /></div></div>
        </section>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3].map((item) => <div key={item} className="h-60 liquid-nav rounded-[2rem] animate-pulse" />)}</div>
        ) : !goals.length ? (
          <div className="liquid-nav rounded-[2.2rem] p-14 text-center"><PiggyBank size={34} className="mx-auto text-slate-300 mb-4" /><h2 className="text-xl font-semibold">Belum ada target tabungan</h2><p className="text-sm text-slate-500 mt-2 mb-5">Mulai dari dana darurat, laptop, liburan, atau tujuan lain.</p><button onClick={openNew} className="text-sm font-medium text-indigo-600 dark:text-indigo-300">Buat target pertama →</button></div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {goals.map((goal) => {
              const target = Number(goal.target_amount || 0);
              const saved = Number(goal.current_amount || 0);
              const percent = target > 0 ? Math.min((saved / target) * 100, 100) : 0;
              const done = target > 0 && saved >= target;
              const gradient = gradients[goal.color] || gradients.indigo;
              return <motion.article layout key={goal.id} className="liquid-nav rounded-[2rem] p-5 md:p-6"><div className="flex items-start justify-between gap-4 mb-5"><div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} text-white flex items-center justify-center text-2xl shadow-sm`}>{goal.emoji || '🎯'}</div><div className="flex gap-2"><button onClick={() => openEdit(goal)} className="w-9 h-9 rounded-xl bg-white/45 dark:bg-white/[.05] text-slate-500 flex items-center justify-center"><Pencil size={15} /></button><button onClick={() => remove(goal)} className="w-9 h-9 rounded-xl bg-rose-500/[.08] text-rose-500 flex items-center justify-center"><Trash2 size={15} /></button></div></div><div className="mb-5"><div className="flex items-center gap-2"><h3 className="text-lg font-semibold truncate">{goal.name}</h3>{done && <Trophy size={17} className="text-amber-500 shrink-0" />}</div><p className="text-xs text-slate-400 mt-1">{done ? 'Target tercapai' : `${rupiah(Math.max(target - saved, 0))} lagi`}</p></div><div className="flex items-end justify-between gap-4 mb-3"><div><p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Terkumpul</p><p className="text-xl font-semibold">{rupiah(saved)}</p></div><p className="text-sm text-slate-400">/ {rupiah(target)}</p></div><div className="h-2 rounded-full bg-slate-200/60 dark:bg-white/10 overflow-hidden mb-3"><motion.div initial={{ width: 0 }} animate={{ width: `${percent}%` }} className={`h-full rounded-full bg-gradient-to-r ${gradient}`} /></div><div className="flex justify-between text-[11px] text-slate-400 mb-5"><span>{Math.round(percent)}%</span><span>{done ? 'Selesai' : 'On progress'}</span></div><button onClick={() => openDeposit(goal)} className={`w-full h-11 rounded-2xl text-sm font-medium ${done ? 'bg-emerald-500/[.08] text-emerald-600 dark:text-emerald-300' : 'liquid-primary text-white'}`}>{done ? 'Tambah tabungan lagi' : '+ Nabung sekarang'}</button></motion.article>;
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {modalOpen && <div className="fixed inset-0 z-[100] bg-slate-950/40 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"><motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} className="lf-mobile-sheet liquid-nav w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 md:p-7 max-h-[90vh] overflow-y-auto"><div className="flex items-center justify-between mb-6"><div><p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">Savings goal</p><h3 className="text-xl font-semibold mt-1">{mode === 'deposit' ? `Nabung untuk ${activeGoal?.name || ''}` : mode === 'edit' ? 'Edit target' : 'Target baru'}</h3></div><button onClick={close} className="w-9 h-9 rounded-full bg-white/45 dark:bg-white/[.05] flex items-center justify-center"><X size={17} /></button></div>{mode === 'deposit' ? <form onSubmit={deposit} className="space-y-5"><div className="rounded-2xl bg-emerald-500/[.08] p-4"><Sparkles size={18} className="text-emerald-600 dark:text-emerald-300 mb-2" /><p className="text-sm text-slate-600 dark:text-slate-300">Terkumpul {rupiah(activeGoal?.current_amount)} dari {rupiah(activeGoal?.target_amount)}.</p></div><label className="block"><span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Nominal setoran</span><input autoFocus required type="number" min="1" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="0" className="mt-2 w-full p-4 rounded-2xl outline-none text-xl font-semibold" /></label><button disabled={saving} type="submit" className="w-full h-12 rounded-2xl liquid-primary text-white font-medium disabled:opacity-60">{saving ? 'Menyimpan…' : 'Simpan setoran'}</button></form> : <form onSubmit={saveGoal} className="space-y-4"><label className="block"><span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Nama target</span><input autoFocus required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Dana darurat, laptop..." className="mt-2 w-full p-4 rounded-2xl outline-none font-medium" /></label><label className="block"><span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Target nominal</span><input required min="1" type="number" value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: e.target.value })} placeholder="0" className="mt-2 w-full p-4 rounded-2xl outline-none font-medium" /></label><div className="grid grid-cols-[.55fr_1fr] gap-3"><label><span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Emoji</span><input maxLength={4} value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} className="mt-2 w-full p-4 rounded-2xl outline-none text-center text-xl" /></label><label><span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Warna</span><select value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="mt-2 w-full p-4 rounded-2xl outline-none font-medium">{Object.keys(gradients).map((color) => <option key={color} value={color}>{color}</option>)}</select></label></div><button disabled={saving} type="submit" className="w-full h-12 rounded-2xl liquid-primary text-white font-medium disabled:opacity-60">{saving ? 'Menyimpan…' : mode === 'edit' ? 'Simpan perubahan' : 'Buat target'}</button></form>}</motion.div></div>}
      </AnimatePresence>
    </main>
  );
}
