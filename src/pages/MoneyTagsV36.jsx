import { useEffect, useMemo, useState } from 'react';
import { Hash, Save, Search, Tags } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { rupiah } from '../lib/financeDataV35';

const parseTags = (value) =>
  [...new Set(
    String(value || '')
      .split(',')
      .map((tag) => tag.trim().replace(/^#/, ''))
      .filter(Boolean)
      .map((tag) => tag.slice(0, 40))
  )];

export default function MoneyTagsV36() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('transactions')
      .select('id, amount, transaction_date, description, tags, categories(name, type), wallets(name)')
      .eq('user_id', user.id)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) toast.error(error.message || 'Gagal memuat tags');

    const rows = data || [];
    setTransactions(rows);
    setDrafts(Object.fromEntries(rows.map((tx) => [tx.id, (tx.tags || []).join(', ')])));
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const tagStats = useMemo(() => {
    const map = new Map();
    transactions.forEach((tx) => {
      (tx.tags || []).forEach((rawTag) => {
        const tag = String(rawTag || '').trim();
        if (!tag) return;
        const key = tag.toLowerCase();
        if (!map.has(key)) map.set(key, { tag, count: 0, income: 0, expense: 0 });
        const stat = map.get(key);
        stat.count += 1;
        if (tx.categories?.type === 'income') stat.income += Number(tx.amount || 0);
        else stat.expense += Number(tx.amount || 0);
      });
    });
    return [...map.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [transactions]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return transactions.filter((tx) => {
      const matchesTag = !activeTag || (tx.tags || []).some((tag) => tag.toLowerCase() === activeTag.toLowerCase());
      const matchesQuery = !term
        || (tx.description || '').toLowerCase().includes(term)
        || (tx.categories?.name || '').toLowerCase().includes(term)
        || (tx.wallets?.name || '').toLowerCase().includes(term)
        || (tx.tags || []).some((tag) => tag.toLowerCase().includes(term));
      return matchesTag && matchesQuery;
    });
  }, [transactions, query, activeTag]);

  const saveTags = async (tx) => {
    const tags = parseTags(drafts[tx.id]);
    setSavingId(tx.id);
    const { error } = await supabase
      .from('transactions')
      .update({ tags })
      .eq('id', tx.id)
      .eq('user_id', user.id);
    setSavingId(null);

    if (error) return toast.error(error.message);

    setTransactions((current) => current.map((item) => item.id === tx.id ? { ...item, tags } : item));
    toast.success('Tags disimpan');
  };

  return (
    <main className="min-h-screen pb-32 md:pb-16 pt-8 md:pt-32 text-slate-900 dark:text-slate-100">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <header className="mb-8 max-w-3xl">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-300 mb-2"><Tags size={16}/><span className="text-[10px] uppercase tracking-[0.16em]">Organization / Money Tags</span></div>
          <h1 className="text-[2rem] md:text-[2.7rem] font-semibold tracking-[-0.04em]">Lihat uang berdasarkan konteks</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Kategori menjawab “jenis pengeluaran apa?”, sedangkan tag menjawab “pengeluaran ini untuk project/cerita apa?” — misalnya #kuliah, #motor, atau #liburanBandung.
          </p>
        </header>

        {tagStats.length > 0 && (
          <section className="mb-5">
            <div className="flex gap-2 overflow-x-auto pb-2">
              <button onClick={() => setActiveTag('')} className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium ${!activeTag ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950' : 'liquid-nav'}`}>Semua</button>
              {tagStats.map((stat) => (
                <button key={stat.tag} onClick={() => setActiveTag(stat.tag)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium ${activeTag === stat.tag ? 'bg-indigo-500 text-white' : 'liquid-nav'}`}>#{stat.tag} · {stat.count}</button>
              ))}
            </div>
          </section>
        )}

        <section className="grid lg:grid-cols-[.72fr_1.28fr] gap-5">
          <aside className="liquid-nav rounded-[2.2rem] p-5 md:p-6 lg:sticky lg:top-28 self-start">
            <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Project totals</p>
            <h2 className="text-xl font-semibold mt-1 mb-5">Ringkasan tag</h2>
            {tagStats.length ? (
              <div className="space-y-3">
                {tagStats.slice(0, 12).map((stat) => (
                  <button key={stat.tag} onClick={() => setActiveTag(stat.tag)} className="w-full text-left rounded-2xl bg-white/35 dark:bg-white/[.035] p-4">
                    <div className="flex items-center justify-between gap-3"><p className="font-medium text-sm">#{stat.tag}</p><span className="text-[10px] text-slate-400">{stat.count} transaksi</span></div>
                    <div className="grid grid-cols-2 gap-2 mt-3 text-xs"><div><p className="text-slate-400">Keluar</p><p className="font-medium text-rose-500 mt-1">{rupiah(stat.expense)}</p></div><div><p className="text-slate-400">Masuk</p><p className="font-medium text-emerald-600 dark:text-emerald-300 mt-1">{rupiah(stat.income)}</p></div></div>
                  </button>
                ))}
              </div>
            ) : <div className="py-12 text-center"><Hash size={26} className="mx-auto text-slate-300 mb-3"/><p className="text-sm text-slate-400">Belum ada tag.</p></div>}
          </aside>

          <div className="liquid-nav rounded-[2.2rem] p-5 md:p-6">
            <label className="relative block mb-5"><Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Cari transaksi, kategori, atau tag..." className="w-full rounded-2xl pl-10 pr-4 py-3.5 text-sm outline-none"/></label>

            {loading ? (
              <div className="space-y-3">{[1,2,3].map((item)=><div key={item} className="h-24 rounded-2xl bg-white/35 dark:bg-white/[.04] animate-pulse"/>)}</div>
            ) : !filtered.length ? (
              <div className="py-14 text-center text-sm text-slate-400">Tidak ada transaksi yang cocok.</div>
            ) : (
              <div className="space-y-3">
                {filtered.slice(0, 120).map((tx) => {
                  const income = tx.categories?.type === 'income';
                  return (
                    <article key={tx.id} className="rounded-[1.7rem] bg-white/30 dark:bg-white/[.03] border border-white/55 dark:border-white/10 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0"><p className="text-sm font-medium truncate">{tx.description || tx.categories?.name || 'Transaksi'}</p><p className="text-[10px] text-slate-400 mt-1">{tx.transaction_date} · {tx.categories?.name || 'Lainnya'} · {tx.wallets?.name || 'Manual'}</p></div>
                        <p className={`text-sm font-semibold whitespace-nowrap ${income ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-500'}`}>{income ? '+' : '-'}{rupiah(tx.amount)}</p>
                      </div>
                      <div className="mt-3 flex gap-2"><input value={drafts[tx.id] ?? ''} onChange={(e)=>setDrafts({...drafts,[tx.id]:e.target.value})} placeholder="kuliah, motor, liburanBandung" className="min-w-0 flex-1 rounded-xl px-3 py-2.5 text-xs outline-none"/><button disabled={savingId===tx.id} onClick={()=>saveTags(tx)} className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 flex items-center justify-center disabled:opacity-40"><Save size={14}/></button></div>
                      <p className="text-[9px] text-slate-400 mt-2">Pisahkan tag dengan koma. Tanda # opsional.</p>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
