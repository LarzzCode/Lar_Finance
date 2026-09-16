import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MoreHorizontal, Pencil, Plus, ShieldCheck, Trash2, WalletCards, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { calculateWalletBalances, rupiah } from '../lib/financeData';

export default function DompetV3() {
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
    balance: acc.balance + Number(wallet.month_balance || 0),
    monthIncome: acc.monthIncome + Number(wallet.month_income || 0),
    monthExpense: acc.monthExpense + Number(wallet.month_expense || 0),
  }), { balance: 0, monthIncome: 0, monthExpense: 0 }), [wallets]);

  const openCreate = () => {
    setEditData(null);
    setForm({ name: '', saldo_awal: '' });
    setModalOpen(true);
  };

  const openEdit = (wallet) => {
    setEditData(wallet);
    setForm({ name: wallet.name || '', saldo_awal: String(wallet.saldo_awal ?? '') });
    setOpenMenu(null);
    setModalOpen(true);
  };

  const close = () => {
    setModalOpen(false);
    setEditData(null);
    setForm({ name: '', saldo_awal: '' });
  };

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
    const { count, error: countError } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('wallet_id', wallet.id);

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
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-8">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400 mb-2">Wallet overview</p>
            <h1 className="text-3xl md:text-[2.55rem] font-semibold tracking-[-0.04em]">Dompet saya.</h1>
            <p className="text-sm text-slate-500 mt-2">Saldo dompet memakai saldo awal + aktivitas transaksi bulan berjalan.</p>
          </div>
          <button onClick={openCreate} className="liquid-primary inline-flex items-center justify-center gap-2 text-white rounded-2xl px-5 py-3.5 text-xs font-semibold">
            <Plus size={16} /> Tambah dompet
          </button>
        </header>

        <section className="grid lg:grid-cols-[1.2fr_0.8fr] gap-4 mb-7">
          <div className="relative overflow-hidden rounded-[2.2rem] border border-white/10 bg-slate-950/90 text-white p-6 md:p-8 shadow-[0_20px_70px_rgba(15,23,42,.18)] backdrop-blur-2xl">
            <div className="absolute -right-20 -top-20 w-56 h-56 rounded-full bg-indigo-400/20 blur-3xl" />
            <div className="absolute -left-16 -bottom-20 w-52 h-52 rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="relative">
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400 mb-3">Total saldo bulan ini</p>
              <p className={`text-4xl md:text-5xl font-semibold tracking-[-0.04em] ${summary.balance < 0 ? 'text-rose-300' : 'text-white'}`}>
                {loading ? '…' : rupiah(summary.balance)}
              </p>
              <p className="text-xs text-slate-400 mt-3">Saldo awal seluruh dompet + pemasukan bulan ini − pengeluaran bulan ini.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-[2rem] border border-emerald-100/70 bg-emerald-50/70 backdrop-blur-xl p-5">
              <p className="text-[9px] font-medium uppercase tracking-[0.15em] text-emerald-600">Masuk bulan ini</p>
              <p className="text-lg md:text-xl font-semibold mt-2 text-emerald-700">+{rupiah(summary.monthIncome)}</p>
            </div>
            <div className="rounded-[2rem] border border-rose-100/70 bg-rose-50/70 backdrop-blur-xl p-5">
              <p className="text-[9px] font-medium uppercase tracking-[0.15em] text-rose-500">Keluar bulan ini</p>
              <p className="text-lg md:text-xl font-semibold mt-2 text-rose-600">-{rupiah(summary.monthExpense)}</p>
            </div>
            <div className="col-span-2 rounded-[2rem] border border-white/60 bg-white/55 backdrop-blur-2xl p-5 flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-indigo-50/80 text-indigo-600 flex items-center justify-center"><ShieldCheck size={18} /></div>
              <div>
                <p className="font-semibold text-sm">Safe wallet guard</p>
                <p className="text-xs text-slate-400 mt-1">Dompet yang punya histori transaksi tetap dilindungi dari penghapusan.</p>
              </div>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{[1,2,3].map((item) => <div key={item} className="h-48 rounded-[2rem] bg-white/50 backdrop-blur-xl animate-pulse" />)}</div>
        ) : !wallets.length ? (
          <div className="rounded-[2rem] border border-dashed border-slate-300/70 bg-white/50 backdrop-blur-xl py-16 text-center">
            <WalletCards size={30} className="mx-auto text-slate-300 mb-4" />
            <p className="font-semibold">Belum ada dompet.</p>
            <p className="text-sm text-slate-400 mt-1 mb-5">Tambahkan rekening, e-wallet, atau kas untuk mulai mencatat.</p>
            <button onClick={openCreate} className="text-sm font-semibold text-indigo-600">+ Tambah dompet pertama</button>
          </div>
        ) : (
          <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {wallets.map((wallet, index) => (
              <motion.article
                key={wallet.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="relative rounded-[2rem] border border-white/60 bg-white/55 backdrop-blur-2xl p-6 shadow-[0_18px_50px_rgba(15,23,42,.07)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50/90 text-indigo-600 flex items-center justify-center font-semibold text-lg uppercase">{wallet.name?.charAt(0) || 'W'}</div>
                  <div className="relative">
                    <button onClick={() => setOpenMenu((current) => current === wallet.id ? null : wallet.id)} className="w-9 h-9 rounded-xl bg-white/60 hover:bg-white/85 text-slate-500 flex items-center justify-center border border-white/70">
                      <MoreHorizontal size={18} />
                    </button>
                    <AnimatePresence>
                      {openMenu === wallet.id && (
                        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="absolute right-0 top-11 z-20 w-40 rounded-2xl bg-white/90 backdrop-blur-2xl border border-white/70 shadow-xl p-1.5">
                          <button onClick={() => openEdit(wallet)} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium hover:bg-slate-50"><Pencil size={14} /> Edit</button>
                          <button onClick={() => remove(wallet)} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium text-rose-500 hover:bg-rose-50"><Trash2 size={14} /> Hapus aman</button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-sm font-medium text-slate-500">{wallet.name}</p>
                  <p className={`text-2xl md:text-3xl font-semibold tracking-[-0.03em] mt-1 ${wallet.month_balance < 0 ? 'text-rose-500' : 'text-slate-950'}`}>{rupiah(wallet.month_balance)}</p>
                  <p className="text-[10px] text-slate-400 mt-1">Saldo bulan ini</p>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-6 pt-5 border-t border-slate-100/80">
                  <div><p className="text-[9px] font-medium uppercase tracking-wider text-slate-400">Masuk</p><p className="text-xs font-semibold text-emerald-600 mt-1">+{rupiah(wallet.month_income)}</p></div>
                  <div><p className="text-[9px] font-medium uppercase tracking-wider text-slate-400">Keluar</p><p className="text-xs font-semibold text-rose-500 mt-1">-{rupiah(wallet.month_expense)}</p></div>
                </div>
              </motion.article>
            ))}
          </section>
        )}
      </div>

      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/35 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} className="w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] bg-white/90 backdrop-blur-2xl border border-white/70 p-6 md:p-7 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div><p className="text-lg font-semibold">{editData ? 'Edit dompet' : 'Dompet baru'}</p><p className="text-xs text-slate-400 mt-1">Saldo awal dipakai sebagai baseline saldo bulan berjalan.</p></div>
                <button onClick={close} className="w-9 h-9 rounded-full bg-slate-100/80 flex items-center justify-center"><X size={17} /></button>
              </div>

              <form onSubmit={save} className="space-y-5">
                <label className="block"><span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Nama dompet</span><input autoFocus required maxLength={40} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="BCA, Tunai, SeaBank..." className="w-full mt-2 bg-white/60 border border-white/80 rounded-2xl px-4 py-4 font-medium outline-none focus:ring-4 focus:ring-indigo-100/50" /></label>
                <label className="block"><span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Saldo awal bulan</span><input required type="number" value={form.saldo_awal} onChange={(e) => setForm({ ...form, saldo_awal: e.target.value })} placeholder="0" className="w-full mt-2 bg-white/60 border border-white/80 rounded-2xl px-4 py-4 font-medium outline-none focus:ring-4 focus:ring-indigo-100/50" /></label>
                <div className="grid grid-cols-2 gap-3"><button type="button" onClick={close} className="h-12 rounded-2xl bg-white/65 border border-white/70 font-medium text-sm">Batal</button><button disabled={saving} type="submit" className="liquid-primary h-12 rounded-2xl text-white font-semibold text-sm disabled:opacity-60">{saving ? 'Menyimpan...' : 'Simpan'}</button></div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
