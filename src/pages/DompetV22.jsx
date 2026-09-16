import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MoreHorizontal, Pencil, Plus, ShieldCheck, Trash2, WalletCards, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { calculateWalletBalances, rupiah } from '../lib/financeData';

export default function DompetV22() {
  const { user } = useAuth();
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', saldo_awal: '' });

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [walletRes, txRes] = await Promise.all([
      supabase.from('wallets').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('transactions').select('amount, wallet_id, transaction_date, categories(type)').eq('user_id', user.id),
    ]);
    if (walletRes.error || txRes.error) {
      toast.error(walletRes.error?.message || txRes.error?.message || 'Gagal memuat dompet');
      setLoading(false);
      return;
    }
    setWallets(calculateWalletBalances(walletRes.data || [], txRes.data || []));
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const summary = useMemo(() => wallets.reduce((acc, wallet) => ({
    balance: acc.balance + Number(wallet.current_balance || 0),
    monthIncome: acc.monthIncome + Number(wallet.month_income || 0),
    monthExpense: acc.monthExpense + Number(wallet.month_expense || 0),
  }), { balance: 0, monthIncome: 0, monthExpense: 0 }), [wallets]);

  const openCreate = () => { setEditData(null); setForm({ name: '', saldo_awal: '' }); setModalOpen(true); };
  const openEdit = (wallet) => { setEditData(wallet); setForm({ name: wallet.name || '', saldo_awal: String(wallet.saldo_awal ?? '') }); setOpenMenu(null); setModalOpen(true); };
  const close = () => { setModalOpen(false); setEditData(null); setForm({ name: '', saldo_awal: '' }); };

  const save = async (event) => {
    event.preventDefault();
    const name = form.name.trim();
    const startingBalance = Number(form.saldo_awal || 0);
    if (!name) return toast.error('Nama dompet wajib diisi');
    if (!Number.isFinite(startingBalance)) return toast.error('Saldo awal tidak valid');
    setSaving(true);
    const result = editData
      ? await supabase.from('wallets').update({ name, saldo_awal: startingBalance }).eq('id', editData.id).eq('user_id', user.id)
      : await supabase.from('wallets').insert([{ name, saldo_awal: startingBalance, user_id: user.id }]);
    setSaving(false);
    if (result.error) return toast.error(result.error.message);
    toast.success(editData ? 'Dompet diperbarui' : 'Dompet ditambahkan');
    close();
    load();
  };

  const remove = async (wallet) => {
    setOpenMenu(null);
    const { count, error: countError } = await supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('wallet_id', wallet.id);
    if (countError) return toast.error(countError.message);
    if ((count || 0) > 0) return toast.error(`Dompet masih dipakai ${count} transaksi dan tidak bisa dihapus.`);
    if (!window.confirm(`Hapus dompet "${wallet.name}"?`)) return;
    const { error } = await supabase.from('wallets').delete().eq('id', wallet.id).eq('user_id', user.id);
    if (error) return toast.error(error.message);
    toast.success('Dompet dihapus');
    load();
  };

  return (
    <main className="min-h-screen bg-[#F6F7F9] pb-32 md:pb-16 md:pt-28 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 md:pt-6">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-7">
          <div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 mb-1">Wallet overview</p><h1 className="text-3xl md:text-4xl font-black tracking-tight">Dompet saya.</h1><p className="text-sm text-slate-500 mt-2">Saldo sekarang dihitung kumulatif; arus bulan berjalan ditampilkan terpisah.</p></div>
          <button onClick={openCreate} className="inline-flex items-center justify-center gap-2 bg-slate-950 hover:bg-black text-white rounded-2xl px-5 py-3.5 text-xs font-black shadow-lg shadow-slate-300"><Plus size={16} /> Tambah dompet</button>
        </header>

        <section className="grid lg:grid-cols-[1.2fr_0.8fr] gap-4 mb-7">
          <div className="bg-slate-950 text-white rounded-[2rem] p-6 md:p-8 shadow-xl relative overflow-hidden">
            <div className="absolute -right-20 -top-20 w-56 h-56 rounded-full bg-indigo-500/20 blur-3xl" />
            <div className="relative"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 mb-2">Total saldo saat ini</p><p className={`text-4xl md:text-5xl font-black tracking-tight ${summary.balance < 0 ? 'text-rose-300' : 'text-white'}`}>{loading ? '…' : rupiah(summary.balance)}</p><p className="text-xs text-slate-500 mt-3">Saldo awal seluruh dompet + seluruh transaksi historis.</p></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-emerald-50 border border-emerald-100 rounded-[2rem] p-5"><p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Masuk bulan ini</p><p className="text-lg md:text-xl font-black mt-2 text-emerald-700">+{rupiah(summary.monthIncome)}</p></div>
            <div className="bg-rose-50 border border-rose-100 rounded-[2rem] p-5"><p className="text-[10px] font-black uppercase tracking-wider text-rose-500">Keluar bulan ini</p><p className="text-lg md:text-xl font-black mt-2 text-rose-600">-{rupiah(summary.monthExpense)}</p></div>
            <div className="col-span-2 bg-white border border-slate-200 rounded-[2rem] p-5 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><ShieldCheck size={19} /></div><div><p className="font-black text-sm">Safe wallet guard</p><p className="text-xs text-slate-400 mt-1">Dompet yang punya histori transaksi tidak bisa dihapus.</p></div></div>
          </div>
        </section>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{[1,2,3].map((item) => <div key={item} className="h-48 rounded-[2rem] bg-slate-200 animate-pulse" />)}</div>
        ) : !wallets.length ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-[2rem] py-16 text-center"><WalletCards size={30} className="mx-auto text-slate-300 mb-4" /><p className="font-black">Belum ada dompet.</p><p className="text-sm text-slate-400 mt-1 mb-5">Tambahkan rekening, e-wallet, atau kas untuk mulai mencatat.</p><button onClick={openCreate} className="text-sm font-black text-indigo-600">+ Tambah dompet pertama</button></div>
        ) : (
          <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {wallets.map((wallet, index) => (
              <motion.article key={wallet.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }} className="relative bg-white border border-slate-200/70 rounded-[2rem] p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4"><div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-lg uppercase">{wallet.name?.charAt(0) || 'W'}</div><div className="relative"><button onClick={() => setOpenMenu((current) => current === wallet.id ? null : wallet.id)} className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 flex items-center justify-center"><MoreHorizontal size={18} /></button><AnimatePresence>{openMenu === wallet.id && <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="absolute right-0 top-11 z-20 w-40 bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5"><button onClick={() => openEdit(wallet)} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-50"><Pencil size={14} /> Edit</button><button onClick={() => remove(wallet)} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-50"><Trash2 size={14} /> Hapus aman</button></motion.div>}</AnimatePresence></div></div>
                <div className="mt-6"><p className="text-sm font-bold text-slate-500">{wallet.name}</p><p className={`text-2xl md:text-3xl font-black tracking-tight mt-1 ${wallet.current_balance < 0 ? 'text-rose-500' : 'text-slate-950'}`}>{rupiah(wallet.current_balance)}</p><p className="text-[10px] text-slate-400 mt-1">Saldo saat ini</p></div>
                <div className="grid grid-cols-2 gap-3 mt-6 pt-5 border-t border-slate-100"><div><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Masuk bulan ini</p><p className="text-xs font-black text-emerald-600 mt-1">+{rupiah(wallet.month_income)}</p></div><div><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Keluar bulan ini</p><p className="text-xs font-black text-rose-500 mt-1">-{rupiah(wallet.month_expense)}</p></div></div>
              </motion.article>
            ))}
          </section>
        )}
      </div>

      <AnimatePresence>{modalOpen && <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/45 backdrop-blur-sm"><motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} className="w-full max-w-md bg-white rounded-t-[2rem] sm:rounded-[2rem] p-6 md:p-7 shadow-2xl"><div className="flex items-center justify-between mb-6"><div><p className="text-lg font-black">{editData ? 'Edit dompet' : 'Dompet baru'}</p><p className="text-xs text-slate-400 mt-1">Saldo awal adalah baseline sebelum histori transaksi yang tersimpan.</p></div><button onClick={close} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"><X size={17} /></button></div><form onSubmit={save} className="space-y-5"><label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nama dompet</span><input autoFocus required maxLength={40} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="BCA, Tunai, SeaBank..." className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 font-bold outline-none focus:ring-4 focus:ring-slate-100" /></label><label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Saldo awal</span><input required type="number" value={form.saldo_awal} onChange={(e) => setForm({ ...form, saldo_awal: e.target.value })} placeholder="0" className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 font-bold outline-none focus:ring-4 focus:ring-slate-100" /></label><div className="grid grid-cols-2 gap-3"><button type="button" onClick={close} className="h-12 rounded-2xl bg-slate-100 font-black text-sm">Batal</button><button disabled={saving} type="submit" className="h-12 rounded-2xl bg-slate-950 text-white font-black text-sm disabled:opacity-60">{saving ? 'Menyimpan...' : 'Simpan'}</button></div></form></motion.div></div>}</AnimatePresence>
    </main>
  );
}
