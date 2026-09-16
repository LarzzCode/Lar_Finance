import { useEffect, useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { MoreHorizontal, Pencil, Plus, Trash2, WalletCards, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const rupiah = (value) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

export default function DompetV2() {
  const { user } = useAuth();
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [formData, setFormData] = useState({ name: '', saldo_awal: '' });
  const currentDate = new Date();

  useEffect(() => {
    if (user) fetchWalletsAndCalculate();
  }, [user]);

  const fetchWalletsAndCalculate = async () => {
    setLoading(true);

    const startDate = format(startOfMonth(currentDate), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(currentDate), 'yyyy-MM-dd');

    const [{ data: walletData, error: walletError }, { data: txData, error: txError }] = await Promise.all([
      supabase.from('wallets').select('*').order('created_at'),
      supabase
        .from('transactions')
        .select('amount, wallet_id, categories(type)')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate),
    ]);

    if (walletError || txError) {
      toast.error(walletError?.message || txError?.message || 'Gagal memuat dompet');
      setLoading(false);
      return;
    }

    const calculatedWallets = (walletData || []).map((wallet) => {
      const walletTransactions = (txData || []).filter(
        (transaction) => String(transaction.wallet_id) === String(wallet.id),
      );
      const income = walletTransactions
        .filter((transaction) => transaction.categories?.type === 'income')
        .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
      const expense = walletTransactions
        .filter((transaction) => transaction.categories?.type === 'expense')
        .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

      return {
        ...wallet,
        balance: (Number(wallet.saldo_awal) || 0) + income - expense,
        income,
        expense,
      };
    });

    setWallets(calculatedWallets);
    setLoading(false);
  };

  const summary = useMemo(
    () =>
      wallets.reduce(
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
    setFormData({ name: wallet.name, saldo_awal: wallet.saldo_awal });
    setOpenMenu(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const payload = {
      name: formData.name.trim(),
      saldo_awal: formData.saldo_awal,
      user_id: user.id,
    };

    try {
      if (editData) {
        const { error } = await supabase.from('wallets').update(payload).eq('id', editData.id);
        if (error) throw error;
        toast.success('Dompet diperbarui');
      } else {
        const { error } = await supabase.from('wallets').insert([payload]);
        if (error) throw error;
        toast.success('Dompet ditambahkan');
      }

      setIsModalOpen(false);
      setEditData(null);
      setFormData({ name: '', saldo_awal: '' });
      fetchWalletsAndCalculate();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (wallet) => {
    setOpenMenu(null);
    if (!window.confirm(`Hapus dompet "${wallet.name}"?`)) return;

    const { error } = await supabase.from('wallets').delete().eq('id', wallet.id);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success('Dompet dihapus');
    fetchWalletsAndCalculate();
  };

  return (
    <main className="min-h-screen bg-[#F6F7F9] pb-32 md:pb-16 md:pt-28 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 md:pt-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-7">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 mb-1">Wallet overview</p>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">Dompet saya.</h1>
            <p className="text-sm text-slate-500 mt-2">
              {format(currentDate, 'MMMM yyyy', { locale: id })} · {wallets.length} dompet aktif
            </p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 bg-slate-950 hover:bg-black text-white rounded-2xl px-5 py-3.5 text-xs font-black shadow-lg shadow-slate-300 transition-all"
          >
            <Plus size={16} /> Tambah dompet
          </button>
        </div>

        <section className="grid md:grid-cols-3 gap-4 mb-7">
          <div className="md:col-span-2 bg-slate-950 text-white rounded-[2rem] p-6 md:p-8 shadow-xl relative overflow-hidden">
            <div className="absolute -right-20 -top-20 w-56 h-56 rounded-full bg-indigo-500/20 blur-3xl" />
            <div className="relative">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 mb-2">Total saldo bulan ini</p>
              <p className={`text-4xl md:text-5xl font-black tracking-tight ${summary.balance < 0 ? 'text-rose-300' : 'text-white'}`}>
                {rupiah(summary.balance)}
              </p>
              <div className="grid grid-cols-2 gap-4 mt-7 pt-5 border-t border-white/10">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Masuk</p>
                  <p className="font-black text-emerald-300 mt-1">+{rupiah(summary.income)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Keluar</p>
                  <p className="font-black text-rose-300 mt-1">-{rupiah(summary.expense)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200/70 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <WalletCards size={21} />
            </div>
            <div className="mt-7">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Metode perhitungan</p>
              <p className="font-black mt-2 leading-snug">Saldo awal + pemasukan − pengeluaran bulan berjalan.</p>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="py-20 text-center text-xs font-black uppercase tracking-widest text-slate-400">Menghitung aset...</div>
        ) : wallets.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-[2rem] py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-4">
              <WalletCards size={24} />
            </div>
            <p className="font-black">Belum ada dompet.</p>
            <p className="text-sm text-slate-400 mt-1 mb-5">Tambahkan sumber dana pertamamu.</p>
            <button onClick={openCreate} className="text-sm font-black text-indigo-600">+ Tambah sekarang</button>
          </div>
        ) : (
          <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {wallets.map((wallet, index) => (
              <motion.article
                key={wallet.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="relative bg-white border border-slate-200/70 rounded-[2rem] p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-lg uppercase">
                    {wallet.name?.charAt(0) || 'W'}
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setOpenMenu((current) => (current === wallet.id ? null : wallet.id))}
                      className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 flex items-center justify-center"
                      aria-label={`Aksi untuk ${wallet.name}`}
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    <AnimatePresence>
                      {openMenu === wallet.id && (
                        <motion.div
                          initial={{ opacity: 0, y: -6, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.96 }}
                          className="absolute right-0 top-11 z-20 w-36 bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5"
                        >
                          <button onClick={() => openEdit(wallet)} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-50">
                            <Pencil size={14} /> Edit
                          </button>
                          <button onClick={() => handleDelete(wallet)} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-50">
                            <Trash2 size={14} /> Hapus
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-sm font-bold text-slate-500">{wallet.name}</p>
                  <p className={`text-2xl md:text-3xl font-black tracking-tight mt-1 ${wallet.balance < 0 ? 'text-rose-500' : 'text-slate-950'}`}>
                    {rupiah(wallet.balance)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-6 pt-5 border-t border-slate-100">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Masuk</p>
                    <p className="text-xs font-black text-emerald-600 mt-1">+{rupiah(wallet.income)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Keluar</p>
                    <p className="text-xs font-black text-rose-500 mt-1">-{rupiah(wallet.expense)}</p>
                  </div>
                </div>
              </motion.article>
            ))}
          </section>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/45 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 35, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 35, scale: 0.98 }}
              className="w-full max-w-md bg-white rounded-t-[2rem] sm:rounded-[2rem] p-6 md:p-7 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-lg font-black">{editData ? 'Edit dompet' : 'Dompet baru'}</p>
                  <p className="text-xs text-slate-400 mt-1">Data lama tidak diubah selain field yang kamu simpan.</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
                  <X size={17} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nama dompet</span>
                  <input
                    autoFocus
                    required
                    type="text"
                    value={formData.name}
                    onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                    placeholder="Contoh: BCA, Tunai, SeaBank"
                    className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 font-bold outline-none focus:bg-white focus:ring-4 focus:ring-slate-100"
                  />
                </label>

                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Saldo awal bulan ini</span>
                  <input
                    required
                    type="number"
                    value={formData.saldo_awal}
                    onChange={(event) => setFormData({ ...formData, saldo_awal: event.target.value })}
                    placeholder="0"
                    className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 font-bold outline-none focus:bg-white focus:ring-4 focus:ring-slate-100"
                  />
                  <p className="text-[10px] text-slate-400 mt-2">Perhitungan saldo tetap sama dengan versi sebelumnya.</p>
                </label>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="py-4 rounded-2xl bg-slate-100 text-slate-600 font-black text-sm">Batal</button>
                  <button type="submit" className="py-4 rounded-2xl bg-slate-950 text-white font-black text-sm shadow-lg">Simpan</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
