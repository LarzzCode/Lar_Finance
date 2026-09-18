import { useEffect, useState } from 'react';
import { RotateCcw, Trash2, Undo2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { rupiah } from '../lib/financeDataV35';

export default function TrashV35() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('transaction_trash')
      .select('*, categories(name, type), wallets(name)')
      .eq('user_id', user.id)
      .order('trashed_at', { ascending: false });

    if (error) toast.error(error.message || 'Gagal memuat Trash');
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const restore = async (item) => {
    setBusyId(item.id);
    const { error } = await supabase.rpc('restore_transaction', { p_trash_id: item.id });
    setBusyId(null);

    if (error) return toast.error(error.message || 'Gagal memulihkan transaksi');

    toast.success('Transaksi dipulihkan');
    load();
  };

  const permanentlyDelete = async (item) => {
    if (!window.confirm('Hapus permanen transaksi ini? Setelah ini tidak bisa dipulihkan.')) return;

    setBusyId(item.id);
    const { error } = await supabase
      .from('transaction_trash')
      .delete()
      .eq('id', item.id)
      .eq('user_id', user.id);
    setBusyId(null);

    if (error) return toast.error(error.message || 'Gagal menghapus permanen');

    toast.success('Transaksi dihapus permanen');
    load();
  };

  return (
    <main className="min-h-screen pb-32 md:pb-16 pt-8 md:pt-32 text-slate-900 dark:text-slate-100">
      <div className="max-w-5xl mx-auto px-4 md:px-8">
        <header className="mb-8 max-w-3xl">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-300 mb-2">
            <Undo2 size={16} />
            <span className="text-[10px] uppercase tracking-[0.16em] font-medium">Data Quality / Safety</span>
          </div>
          <h1 className="text-[2rem] md:text-[2.7rem] font-semibold tracking-[-0.04em]">Trash transaksi</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Transaksi yang dihapus dari Laporan masuk ke sini dulu. Kamu punya waktu 30 hari untuk memulihkannya sebelum memilih hapus permanen.
          </p>
        </header>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map((item) => <div key={item} className="h-24 liquid-nav rounded-[1.8rem] animate-pulse" />)}
          </div>
        ) : !items.length ? (
          <div className="liquid-nav rounded-[2.2rem] py-16 px-6 text-center">
            <Trash2 size={30} className="mx-auto text-slate-300 mb-4" />
            <h2 className="text-xl font-semibold">Trash kosong</h2>
            <p className="text-sm text-slate-500 mt-2">Belum ada transaksi yang dipindahkan ke Trash.</p>
          </div>
        ) : (
          <section className="space-y-3">
            {items.map((item) => {
              const income = item.categories?.type === 'income';
              const expired = item.expires_at ? new Date(item.expires_at).getTime() < Date.now() : false;
              const expiresIn = item.expires_at
                ? formatDistanceToNowStrict(parseISO(item.expires_at), { locale: id, addSuffix: true })
                : '30 hari';

              return (
                <article key={item.id} className="liquid-nav rounded-[1.9rem] p-5 md:p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-semibold truncate">{item.description || item.categories?.name || 'Transaksi'}</h2>
                        {item.split_group_id && (
                          <span className="text-[9px] uppercase tracking-wide rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-300 px-2 py-1">
                            Split
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-400 mt-1">
                        {item.transaction_date || '-'} · {item.categories?.name || 'Tanpa kategori'} · {item.wallets?.name || item.payment_method || 'Manual'}
                      </p>

                      <p className="text-[10px] text-slate-400 mt-2">
                        Trash {item.trashed_at ? formatDistanceToNowStrict(parseISO(item.trashed_at), { locale: id, addSuffix: true }) : ''}
                        {' · '}kedaluwarsa {expiresIn}
                      </p>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-3">
                      <p className={`text-lg font-semibold whitespace-nowrap ${income ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-500'}`}>
                        {income ? '+' : '-'}{rupiah(item.amount)}
                      </p>

                      <button
                        disabled={busyId === item.id || expired}
                        onClick={() => restore(item)}
                        className="h-10 px-3 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-medium inline-flex items-center gap-2 disabled:opacity-35"
                      >
                        <RotateCcw size={14} /> {expired ? 'Expired' : 'Restore'}
                      </button>

                      <button
                        disabled={busyId === item.id}
                        onClick={() => permanentlyDelete(item)}
                        className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center disabled:opacity-50"
                        aria-label="Hapus permanen"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
