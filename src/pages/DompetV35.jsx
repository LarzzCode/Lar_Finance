import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRightLeft, MoreHorizontal, Pencil, Plus, Scale, ShieldCheck, Trash2, WalletCards, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { calculateWalletBalances, rupiah } from '../lib/financeDataV35';

export default function DompetV35() {
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
    const [walletRes, txRes, transferRes, adjustmentRes] = await Promise.all([
      supabase.from('wallets').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('transactions').select('amount, wallet_id, transaction_date, categories(type)').eq('user_id', user.id),
      supabase.from('transfers').select('amount, from_wallet_id, to_wallet_id, transfer_date').eq('user_id', user.id),
      supabase.from('wallet_adjustments').select('amount, wallet_id, adjustment_date, actual_balance, created_at').eq('user_id', user.id),
    ]);
    const error = walletRes.error || txRes.error || transferRes.error || adjustmentRes.error;
    if (error) {
      toast.error(error.message || 'Gagal memuat dompet');
      setLoading(false);
      return;
    }
    setWallets(calculateWalletBalances(walletRes.data || [], txRes.data || [], transferRes.data || [], adjustmentRes.data || []));
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const summary = useMemo(() => wallets.reduce((acc, wallet) => ({
    balance: acc.balance + Number(wallet.current_balance || 0),
    totalIncome: acc.totalIncome + Number(wallet.total_income || 0),
    totalExpense: acc.totalExpense + Number(wallet.total_expense || 0),
    transferIn: acc.transferIn + Number(wallet.total_transfer_in || 0),
    transferOut: acc.transferOut + Number(wallet.total_transfer_out || 0),
  }), { balance: 0, totalIncome: 0, totalExpense: 0, transferIn: 0, transferOut: 0 }), [wallets]);

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
    const [txRes, transferOutRes, transferInRes, adjustmentRes, trashRes] = await Promise.all([
      supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('wallet_id', wallet.id),
      supabase.from('transfers').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('from_wallet_id', wallet.id),
      supabase.from('transfers').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('to_wallet_id', wallet.id),
      supabase.from('wallet_adjustments').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('wallet_id', wallet.id),
      supabase.from('transaction_trash').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('wallet_id', wallet.id),
    ]);
    const error = txRes.error || transferOutRes.error || transferInRes.error || adjustmentRes.error || trashRes.error;
    if (error) return toast.error(error.message);
    const refs = (txRes.count || 0) + (transferOutRes.count || 0) + (transferInRes.count || 0) + (adjustmentRes.count || 0) + (trashRes.count || 0);
    if (refs > 0) return toast.error(`Dompet masih punya ${refs} histori transaksi/transfer dan tidak bisa dihapus.`);
    if (!window.confirm(`Hapus dompet "${wallet.name}"?`)) return;
    const { error: deleteError } = await supabase.from('wallets').delete().eq('id', wallet.id).eq('user_id', user.id);
    if (deleteError) return toast.error(deleteError.message);
    toast.success('Dompet dihapus');
    load();
  };

  return (
    <main className="min-h-screen pb-32 md:pb-16 pt-8 md:pt-32 text-slate-900 dark:text-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-8">
          <div><p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400 mb-2">Wallet overview</p><h1 className="text-[2rem] md:text-[2.6rem] font-semibold tracking-[-0.04em]">Dompet saya</h1><p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Saldo sekarang dihitung kumulatif dari saldo awal + seluruh pemasukan − seluruh pengeluaran + transfer, sejak dompet mulai digunakan.</p></div>
          <div className="flex flex-wrap gap-2"><Link to="/reconcile" className="liquid-nav inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-xs font-semibold"><Scale size={16} /> Cocokkan saldo</Link><Link to="/transfer" className="liquid-nav inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-xs font-semibold"><ArrowRightLeft size={16} /> Transfer</Link><button onClick={openCreate} className="liquid-primary inline-flex items-center justify-center gap-2 text-white rounded-2xl px-5 py-3.5 text-xs font-semibold"><Plus size={16} /> Tambah dompet</button></div>
        </header>

        <section className="grid lg:grid-cols-[1.2fr_.8fr] gap-4 mb-7">
          <div className="relative overflow-hidden rounded-[2.2rem] border border-white/10 bg-slate-950/90 text-white p-6 md:p-8 shadow-[0_20px_70px_rgba(15,23,42,.18)] backdrop-blur-2xl"><div className="absolute -right-20 -top-20 w-56 h-56 rounded-full bg-indigo-400/20 blur-3xl" /><div className="relative"><p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400 mb-3">Total saldo saat ini</p><p className={`text-4xl md:text-5xl font-semibold tracking-[-0.04em] ${summary.balance < 0 ? 'text-rose-300' : 'text-white'}`}>{loading ? '…' : rupiah(summary.balance)}</p><p className="text-xs text-slate-400 mt-3">Angka ini tidak di-reset tiap bulan. Rekonsiliasi tetap bisa dipakai sebagai anchor bila saldo nyata berbeda.</p></div></div>
          <div className="grid grid-cols-2 gap-4"><div className="liquid-nav rounded-[1.8rem] p-5"><p className="text-[9px] font-medium uppercase tracking-[0.15em] text-emerald-600">Total pemasukan</p><p className="text-lg font-semibold mt-2 text-emerald-600">+{rupiah(summary.totalIncome)}</p></div><div className="liquid-nav rounded-[1.8rem] p-5"><p className="text-[9px] font-medium uppercase tracking-[0.15em] text-rose-500">Total pengeluaran</p><p className="text-lg font-semibold mt-2 text-rose-500">-{rupiah(summary.totalExpense)}</p></div><div className="col-span-2 liquid-nav rounded-[1.8rem] p-5 flex gap-3"><ShieldCheck size={18} className="text-indigo-500 shrink-0" /><div><p className="font-semibold text-sm">Safe wallet guard</p><p className="text-xs text-slate-400 mt-1">Dompet dengan histori transaksi atau transfer tetap terlindungi dari penghapusan.</p></div></div></div>
        </section>

        {loading ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{[1,2,3].map((item) => <div key={item} className="h-48 liquid-nav rounded-[2rem] animate-pulse" />)}</div> : !wallets.length ? <div className="liquid-nav rounded-[2rem] py-16 text-center"><WalletCards size={30} className="mx-auto text-slate-300 mb-4" /><p className="font-semibold">Belum ada dompet.</p><button onClick={openCreate} className="mt-4 text-sm font-medium text-indigo-600">+ Tambah dompet pertama</button></div> : (
          <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {wallets.map((wallet, index) => <motion.article key={wallet.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }} className="liquid-nav rounded-[2rem] p-6 relative">
              <div className="flex items-start justify-between gap-4"><div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-semibold text-lg uppercase">{wallet.name?.charAt(0) || 'W'}</div><div className="relative"><button onClick={() => setOpenMenu((current) => current === wallet.id ? null : wallet.id)} className="w-9 h-9 rounded-xl bg-white/45 dark:bg-white/[.04] flex items-center justify-center"><MoreHorizontal size={18} /></button><AnimatePresence>{openMenu === wallet.id && <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="absolute right-0 top-11 z-20 w-40 liquid-nav rounded-2xl p-1.5"><button onClick={() => openEdit(wallet)} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium"><Pencil size={14} /> Edit</button><button onClick={() => remove(wallet)} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium text-rose-500"><Trash2 size={14} /> Hapus aman</button></motion.div>}</AnimatePresence></div></div>
              <div className="mt-6"><p className="text-sm text-slate-500 dark:text-slate-400">{wallet.name}</p><p className={`text-2xl md:text-3xl font-semibold tracking-[-0.03em] mt-1 ${wallet.current_balance < 0 ? 'text-rose-500' : ''}`}>{rupiah(wallet.current_balance)}</p><p className="text-[10px] text-slate-400 mt-1">Saldo saat ini</p></div>
              <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-white/50 dark:border-white/10"><div><p className="text-[9px] uppercase tracking-wider text-slate-400">Transfer masuk</p><p className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 mt-1">+{rupiah(wallet.total_transfer_in)}</p></div><div><p className="text-[9px] uppercase tracking-wider text-slate-400">Transfer keluar</p><p className="text-xs font-semibold text-slate-500 mt-1">-{rupiah(wallet.total_transfer_out)}</p></div><div><p className="text-[9px] uppercase tracking-wider text-slate-400">Rekonsiliasi</p><p className="text-xs font-semibold mt-1 text-emerald-600 dark:text-emerald-300">{wallet.latest_reconciliation ? 'Aktif' : 'Belum ada'}</p></div></div>
            </motion.article>)}
          </section>
        )}
      </div>

      <AnimatePresence>{modalOpen && <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/35 backdrop-blur-md"><motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} className="liquid-nav w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 md:p-7"><div className="flex items-center justify-between mb-6"><div><p className="text-lg font-semibold">{editData ? 'Edit dompet' : 'Dompet baru'}</p><p className="text-xs text-slate-400 mt-1">Saldo awal menjadi titik awal perhitungan kumulatif dompet.</p></div><button onClick={close} className="w-9 h-9 rounded-full bg-white/45 dark:bg-white/[.05] flex items-center justify-center"><X size={17} /></button></div><form onSubmit={save} className="space-y-5"><label className="block"><span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Nama dompet</span><input autoFocus required maxLength={40} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="BCA, Tunai, SeaBank..." className="w-full mt-2 rounded-2xl px-4 py-4 font-medium outline-none" /></label><label className="block"><span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Saldo awal</span><input required type="number" value={form.saldo_awal} onChange={(e) => setForm({ ...form, saldo_awal: e.target.value })} placeholder="0" className="w-full mt-2 rounded-2xl px-4 py-4 font-medium outline-none" /></label><div className="grid grid-cols-2 gap-3"><button type="button" onClick={close} className="h-12 rounded-2xl bg-white/45 dark:bg-white/[.05] font-medium text-sm">Batal</button><button disabled={saving} className="liquid-primary h-12 rounded-2xl text-white font-semibold text-sm disabled:opacity-60">{saving ? 'Menyimpan…' : 'Simpan'}</button></div></form></motion.div></div>}</AnimatePresence>
    </main>
  );
}
