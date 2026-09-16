import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Pencil, PiggyBank, Plus, Sparkles, Trash2, Trophy, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const rupiah = (value) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const emptyForm = {
  name: '',
  target_amount: '',
  emoji: '🎯',
  color: 'indigo',
  current_amount: 0,
};

const toneMap = {
  indigo: 'from-indigo-500 to-violet-500',
  emerald: 'from-emerald-500 to-teal-500',
  amber: 'from-amber-400 to-orange-500',
  rose: 'from-rose-500 to-pink-500',
  sky: 'from-sky-500 to-cyan-500',
};

export default function SavingsV2() {
  const { user } = useAuth();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState('new');
  const [activeGoal, setActiveGoal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [depositAmount, setDepositAmount] = useState('');

  const loadGoals = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (error) toast.error('Gagal memuat tabungan');
    setGoals(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadGoals();
  }, [user]);

  const summary = useMemo(() => {
    const totalTarget = goals.reduce((sum, goal) => sum + Number(goal.target_amount || 0), 0);
    const totalSaved = goals.reduce((sum, goal) => sum + Number(goal.current_amount || 0), 0);
    const completed = goals.filter((goal) => Number(goal.current_amount || 0) >= Number(goal.target_amount || 0) && Number(goal.target_amount || 0) > 0).length;
    return { totalTarget, totalSaved, completed, progress: totalTarget > 0 ? Math.min((totalSaved / totalTarget) * 100, 100) : 0 };
  }, [goals]);

  const openNew = () => {
    setMode('new');
    setActiveGoal(null);
    setForm(emptyForm);
    setDepositAmount('');
    setModalOpen(true);
  };

  const openEdit = (goal) => {
    setMode('edit');
    setActiveGoal(goal);
    setForm({
      name: goal.name || '',
      target_amount: String(goal.target_amount || ''),
      emoji: goal.emoji || '🎯',
      color: goal.color || 'indigo',
      current_amount: Number(goal.current_amount || 0),
    });
    setModalOpen(true);
  };

  const openDeposit = (goal) => {
    setMode('deposit');
    setActiveGoal(goal);
    setDepositAmount('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setActiveGoal(null);
    setMode('new');
    setForm(emptyForm);
    setDepositAmount('');
  };

  const saveGoal = async (event) => {
    event.preventDefault();
    const payload = {
      user_id: user.id,
      name: form.name,
      target_amount: Number(String(form.target_amount).replace(/[^0-9]/g, '')),
      current_amount: Number(form.current_amount || 0),
      emoji: form.emoji || '🎯',
      color: form.color || 'indigo',
    };

    let response;
    if (mode === 'edit' && activeGoal) {
      response = await supabase.from('goals').update(payload).eq('id', activeGoal.id).eq('user_id', user.id);
    } else {
      response = await supabase.from('goals').insert([payload]);
    }

    if (response.error) return toast.error(response.error.message);
    toast.success(mode === 'edit' ? 'Target diperbarui' : 'Target tabungan dibuat');
    closeModal();
    loadGoals();
  };

  const handleDeposit = async (event) => {
    event.preventDefault();
    if (!activeGoal || !depositAmount) return;
    const amount = Number(String(depositAmount).replace(/[^0-9]/g, ''));
    const newTotal = Number(activeGoal.current_amount || 0) + amount;
    const { error } = await supabase
      .from('goals')
      .update({ current_amount: newTotal })
      .eq('id', activeGoal.id)
      .eq('user_id', user.id);

    if (error) return toast.error(error.message);
    toast.success(`Berhasil menabung ${rupiah(amount)}`);
    if (newTotal >= Number(activeGoal.target_amount || 0)) {
      confetti({ particleCount: 130, spread: 70, origin: { y: 0.65 } });
      toast('Target tercapai! 🎉', { icon: '🏆', duration: 4500 });
    }
    closeModal();
    loadGoals();
  };

  const handleDelete = async (goal) => {
    if (!window.confirm(`Hapus target ${goal.name}?`)) return;
    const { error } = await supabase.from('goals').delete().eq('id', goal.id).eq('user_id', user.id);
    if (error) return toast.error(error.message);
    toast.success('Target dihapus');
    loadGoals();
  };

  return (
    <main className="min-h-screen bg-[#F7F8FA] text-slate-900 pb-28 md:pb-16 pt-8 md:pt-32">
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-7">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 mb-2">Planning / Goals</p>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">Tabungan impian</h1>
            <p className="text-sm text-slate-500 mt-2">Pecah tujuan besar menjadi progres kecil yang bisa dilihat setiap hari.</p>
          </div>
          <button onClick={openNew} className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-slate-950 text-white text-sm font-bold shadow-lg shadow-slate-900/10"><Plus size={17} /> Target baru</button>
        </header>

        <section className="rounded-[2rem] bg-[#0B1220] text-white p-6 md:p-8 mb-6 relative overflow-hidden shadow-xl shadow-slate-900/10">
          <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-emerald-500/15 blur-3xl" />
          <div className="relative z-10 grid lg:grid-cols-[1fr_0.8fr] gap-7 lg:items-end">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 mb-2">Total progress</p>
              <p className="text-3xl md:text-5xl font-black tracking-tight">{loading ? '…' : rupiah(summary.totalSaved)}</p>
              <p className="text-sm text-slate-400 mt-3">Dari target gabungan {rupiah(summary.totalTarget)}.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4"><p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Goal aktif</p><p className="font-black text-lg">{goals.length}</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4"><p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Tercapai</p><p className="font-black text-lg text-emerald-300">{summary.completed}</p></div>
            </div>
          </div>
          <div className="relative z-10 mt-7">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2"><span>Progress keseluruhan</span><span>{Math.round(summary.progress)}%</span></div>
            <div className="h-3 rounded-full bg-white/10 overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${summary.progress}%` }} className="h-full rounded-full bg-emerald-400" /></div>
          </div>
        </section>

        {loading ? (
          <div className="py-20 text-center text-sm text-slate-400">Memuat target…</div>
        ) : !goals.length ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2rem] p-12 md:p-16 text-center">
            <PiggyBank size={34} className="mx-auto text-slate-300 mb-4" />
            <h2 className="text-xl font-black">Belum ada target tabungan</h2>
            <p className="text-sm text-slate-500 mt-2 mb-5">Buat tujuan pertama, misalnya dana darurat, laptop, atau liburan.</p>
            <button onClick={openNew} className="px-5 py-3 rounded-2xl bg-slate-950 text-white text-sm font-bold">Buat target pertama</button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {goals.map((goal) => {
              const target = Number(goal.target_amount || 0);
              const saved = Number(goal.current_amount || 0);
              const percent = target > 0 ? Math.min((saved / target) * 100, 100) : 0;
              const done = target > 0 && saved >= target;
              const gradient = toneMap[goal.color] || toneMap.indigo;

              return (
                <motion.div layout key={goal.id} className="bg-white border border-slate-200 rounded-[2rem] p-5 md:p-6 shadow-sm hover:shadow-xl hover:shadow-slate-900/5 transition-shadow">
                  <div className="flex items-start justify-between gap-4 mb-5">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} text-white flex items-center justify-center text-2xl shadow-sm`}>{goal.emoji || '🎯'}</div>
                    <div className="flex gap-2"><button onClick={() => openEdit(goal)} className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center"><Pencil size={15} /></button><button onClick={() => handleDelete(goal)} className="w-9 h-9 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center"><Trash2 size={15} /></button></div>
                  </div>
                  <div className="mb-5">
                    <div className="flex items-center gap-2 mb-1"><h3 className="text-lg font-black truncate">{goal.name}</h3>{done && <Trophy size={17} className="text-amber-500 shrink-0" />}</div>
                    <p className="text-xs text-slate-400">{done ? 'Target sudah tercapai' : `${rupiah(Math.max(target - saved, 0))} lagi untuk tercapai`}</p>
                  </div>
                  <div className="flex items-end justify-between gap-4 mb-3"><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Terkumpul</p><p className="text-xl font-black">{rupiah(saved)}</p></div><p className="text-sm font-bold text-slate-400">/ {rupiah(target)}</p></div>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden mb-3"><motion.div initial={{ width: 0 }} animate={{ width: `${percent}%` }} className={`h-full rounded-full bg-gradient-to-r ${gradient}`} /></div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-5"><span>{Math.round(percent)}%</span><span>{done ? 'Selesai' : 'On progress'}</span></div>
                  <button onClick={() => openDeposit(goal)} className={`w-full h-11 rounded-2xl text-sm font-bold ${done ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-950 text-white'}`}>{done ? 'Tambah tabungan lagi' : '+ Nabung sekarang'}</button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-[100] bg-slate-950/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} className="bg-white w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 md:p-7 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Savings goal</p><h3 className="text-xl font-black">{mode === 'deposit' ? `Nabung untuk ${activeGoal?.name || ''}` : mode === 'edit' ? 'Edit target' : 'Target baru'}</h3></div>
                <button onClick={closeModal} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"><X size={18} /></button>
              </div>

              {mode === 'deposit' ? (
                <form onSubmit={handleDeposit} className="space-y-5">
                  <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4"><Sparkles size={18} className="text-emerald-600 mb-2" /><p className="text-sm text-emerald-800 font-semibold">Terkumpul sekarang {rupiah(activeGoal?.current_amount)} dari {rupiah(activeGoal?.target_amount)}.</p></div>
                  <div><label className="text-[11px] font-bold text-slate-500">Nominal setoran</label><input autoFocus required type="number" min="1" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="0" className="mt-1 w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:ring-4 focus:ring-slate-100 text-2xl font-black" /></div>
                  <button type="submit" className="w-full h-12 rounded-2xl bg-slate-950 text-white font-bold">Simpan setoran</button>
                </form>
              ) : (
                <form onSubmit={saveGoal} className="space-y-4">
                  <div><label className="text-[11px] font-bold text-slate-500">Nama target</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Dana darurat, laptop..." className="mt-1 w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none font-semibold" /></div>
                  <div><label className="text-[11px] font-bold text-slate-500">Target nominal</label><input required type="number" min="1" value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: e.target.value })} placeholder="0" className="mt-1 w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none font-bold" /></div>
                  <div className="grid grid-cols-[0.7fr_1.3fr] gap-4">
                    <div><label className="text-[11px] font-bold text-slate-500">Emoji</label><input value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} className="mt-1 w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none text-center text-xl" /></div>
                    <div><label className="text-[11px] font-bold text-slate-500">Warna</label><select value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="mt-1 w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none"><option value="indigo">Indigo</option><option value="emerald">Emerald</option><option value="amber">Amber</option><option value="rose">Rose</option><option value="sky">Sky</option></select></div>
                  </div>
                  <button type="submit" className="w-full h-12 rounded-2xl bg-slate-950 text-white font-bold">{mode === 'edit' ? 'Simpan perubahan' : 'Buat target'}</button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
