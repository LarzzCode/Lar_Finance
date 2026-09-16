import { useEffect, useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { MoreHorizontal, Pencil, Plus, ShieldCheck, Trash2, WalletCards, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const rupiah = (value) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

export default function DompetSecure() {
  const { user } = useAuth();
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: '', saldo_awal: '' });
  const currentDate = new Date();

  useEffect(() => {
    if (user) loadWallets();
  }, [user]);

  const loadWallets = async () => {
    if (!user) return;
    setLoading(true);
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd');

    const [walletRes, txRes] = await Promise.all([
      supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at'),
      supabase
        .from('transactions')
        .select('amount, wallet_id, categories(type)')
        .eq('user_id', user.id)
        .gte('transaction_date', start)
        .lte('transaction_date', end),
    ]);

    if (walletRes.error || txRes.error) {
      toast.error(walletRes.error?.message || txRes.error?.message || 'Gagal memuat dompet');
      setLoading(false);
      return;
    }

    const calculated = (walletRes.data || []).map((wallet) => {
      const walletTx = (txRes.data || []).filter((tx) => String(tx.wallet_id) === String(wallet.id));
      const income = walletTx
        .filter((tx) => tx.categories?.type === 'income')
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      const expense = walletTx
        .filter((tx) => tx.categories?.type === 'expense')
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      return {
        ...wallet,
        balance: Number(wallet.saldo_awal || 0) + income - expense,
        income,
        expense,
      };
    });

    setWallets(calculated);
    setLoading(false);
  };

  const summary = useMemo(
    () => wallets.reduce(
      (acc, wallet) => ({
        balance: acc.balance + Number(wallet.balance || 0),
        income: acc.income + Number(wallet.income || 0),
        expense: acc.expense + Number(wallet.expense || 0),
      }),
      { balance: 0, income: 0, expense: 0 },
    ),
    [wallets],
  );

  const openCreate = () => {
    setEditData(null);
    setFormData({ name: '', saldo_awal: '' });
    setIsModalOpen(true);
  };

  const openEdit = (wallet) => {
    setEditData(wallet);
    setFormData({ name: wallet.name || '', saldo_awal: String(wallet.saldo_awal ?? '') });
    setOpenMenu(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditData(null);
    setFormData({ name: '', saldo_awal: '' });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user) return;
    const name = formData.name.trim();
    if (!name) return toast.error('Nama dompet wajib diisi');
    if (name.length > 40) return toast.error('Nama dompet maksimal 40 karakter');

    const startingBalance = Number(formData.saldo_awal || 0);
    if (!Number.isFinite(startingBalance)) return toast.error('Saldo awal tidak valid');

    setSaving(true);
    let result;
    if (editData) {
      result = await supabase
        .from('wallets')
        .update({ name, saldo_awal: startingBalance })
        .eq('id', editData.id)
        .eq('user_id', user.id);
    } else {
      result = await supabase.from('wallets').insert([{ name, saldo_awal: startingBalance, user_id: user.id }]);
    }
    setSaving(false);

    if (result.error) return toast.error(result.error.message);
    toast.success(editData ? 'Dompet diperbarui' : 'Dompet ditambahkan');
    closeModal();
    loadWallets();
  };

  const handleDelete = async (wallet) => {
    if (!user) return;
    setOpenMenu(null);

    const { count, error: countError } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('wallet_id', wallet.id);

    if (countError) return toast.error(`Tidak bisa memeriksa dompet: ${countError.message}`);
    if ((count || 0) > 0) {
      toast.error(`Dompet "${wallet.name}" masih dipakai ${count} transaksi. Edit namanya jika perlu, jangan dihapus.`);
      return;
    }

    if (!window.confirm(`Hapus dompet "${wallet.name}"? Dompet ini tidak memiliki transaksi terkait.`)) return;

    const { error } = await supabase
      .from('wallets')
      .delete()
      .eq('id', wallet.id)
      .eq('user_id', user.id);

    if (error) return toast.error(error.message);
    toast.success('Dompet dihapus');
    loadWallets();
  };

  return (
    <main className="min-h-screen bg-[#F6F7F9] pb-32 md:pb-16 md:pt-28 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 md:pt-6">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-7">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 mb-1">Wallet overview</p>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">Dompet saya.</h1>
            <p className="text-sm text-slate-500 mt-2">{format(currentDate, 'MMMM yyyy', { locale: id })} · {wallets.length} dompet aktif</p>
          </div>
          <button onClick={openCreate} className="inline-flex items-center justify-center gap-2 bg-slate-950 hover:bg-black text-white rounded-2xl px-5 py-3.5 text-xs font-black shadow-lg shadow-slate-300">
            <Plus size={16} /> Tambah dompet
          </button>
        </header>

        <section className="grid md:grid-cols-3 gap-4 mb-7">
          <div className="md:col-span-2 bg-slate-950 text-white rounded-[2rem] p-6 md:p-8 shadow-xl relative overflow-hidden">
            <div className="absolute -right-20 -top-20 w-56 h-56 rounded-full bg-indigo-500/20 blur-3xl" />
            <div className="relative">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 mb-2">Total saldo bulan ini</p>
              <p className={`text-4xl md:text-5xl font-black tracking-tight ${summary.balance < 0 ? 'text-rose-300' : 'text-white'}`}>{loading ? '…' : rupiah(summary.balance)}</p>
              <div className="grid grid-cols-2 gap-4 mt-7 pt-5 border-t border-white/10">
                <div><p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Masuk</p><p className="font-black text-emerald-300 mt-1">+{rupiah(summary.income)}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Keluar</p><p className="font-black text-rose-300 mt-1">-{rupiah(summary.expense)}</p></div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200/70 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><ShieldCheck size={21} /></div>
            <div className="mt-7">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Data guard</p>
              <p className="font-black mt-2 leading-snug">Dompet yang sudah dipakai transaksi tidak bisa dihapus dari UI.</p>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="py-20 text-center text-xs font-black uppercase tracking-widest text-slate-400">Menghitung aset...</div>
        ) : wallets.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-[2rem] py-16 text-center">
            <WalletCards size={28} className="mx-auto text-slate-300 mb-4" />
            <p className="font-black">Belum ada dompet.</p>
            <p className="text-sm text-slate-400 mt-1 mb-5">Tambahkan sumber dana pertamamu.</p>
            <button onClick={openCreate} className="text-sm font-black text-indigo-600">+ Tambah sekarang</button>
          </div>
        ) : (
          <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {wallets.map((wallet, index) => (
              <motion.article key={wallet.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} className="relative bg-white border border-slate-200/70 rounded-[2rem] p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-lg uppercase">{wallet.name?.charAt(0) || 'W'}</div>
                  <div className="relative">
                    <button onClick={() => setOpenMenu((current) => (current === wallet.id ? null : wallet.id))} className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 flex items-center justify-center" aria-label={`Aksi untuk ${wallet.name}`}><MoreHorizontal size={18} /></button>
                    <AnimatePresence>
                      {openMenu === wallet.id && (
                        <motion.div initial={{ opacity: 0, y: -6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.96 }} className="absolute right-0 top-11 z-20 w-40 bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5">
                          <button onClick={() => openEdit(wallet)} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-50"><Pencil size={14} /> Edit</button>
                          <button onClick={() => handleDelete(wallet)} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-50"><Trash2 size={14} /> Hapus aman</button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-sm font-bold text-slate-500">{wallet.name}</p>
                  <p className={`text-2xl md:text-3xl font-black tracking-tight mt-1 ${wallet.balance < 0 ? 'text-rose-500' : 'text-slate-950'}`}>{rupiah(wallet.balance)}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-6 pt-5 border-t border-slate-100">
                  <div><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Masuk</p><p className="text-xs font-black text-emerald-600 mt-1">+{rupiah(wallet.income)}</p></div>
                  <div><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Keluar</p><p className="text-xs font-black text-rose-500 mt-1">-{rupiah(wallet.expense)}</p></div>
                </div>
              </motion.article>
            ))}
          </section>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/45 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, y: 35, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 35, scale: 0.98 }} className="w-full max-w-md bg-white rounded-t-[2rem] sm:rounded-[2rem] p-6 md:p-7 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div><p className="text-lg font-black">{editData ? 'Edit dompet' : 'Dompet baru'}</p><p className="text-xs text-slate-400 mt-1">Perubahan hanya diterapkan ke dompet milik akun aktif.</p></div>
                <button onClick={closeModal} className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"><X size={17} /></button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nama dompet</span><input autoFocus required maxLength={40} type="text" value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} placeholder="Contoh: BCA, Tunai, SeaBank" className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 font-bold outline-none focus:bg-white focus:ring-4 focus:ring-slate-100" /></label>
                <label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Saldo awal bulan ini</span><input required type="number" value={formData.saldo_awal} onChange={(event) => setFormData({ ...formData, saldo_awal: event.target.value })} placeholder="0" className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 font-bold outline-none focus:bg-white focus:ring-4 focus:ring-slate-100" /><p className="text-[10px] text-slate-400 mt-2">Rumus tetap: saldo awal + pemasukan − pengeluaran bulan berjalan.</p></label>
                <div className="grid grid-cols-2 gap-3 pt-2"><button type="button" onClick={closeModal} className="py-4 rounded-2xl bg-slate-100 text-slate-600 font-black text-sm">Batal</button><button type="submit" disabled={saving} className="py-4 rounded-2xl bg-slate-950 text-white font-black text-sm shadow-lg disabled:opacity-60">{saving ? 'Menyimpan...' : 'Simpan'}</button></div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
