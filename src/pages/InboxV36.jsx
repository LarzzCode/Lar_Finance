import { useEffect, useMemo, useState } from 'react';
import { Inbox, Plus, Send, Sparkles, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { findMatchingRule, loadAccessibleCategories, rupiah } from '../lib/financeDataV35';

const parseTags = (value) =>
  [...new Set(String(value || '').split(',').map((tag) => tag.trim().replace(/^#/, '')).filter(Boolean))];

export default function InboxV36() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [rules, setRules] = useState([]);
  const [selections, setSelections] = useState({});
  const [form, setForm] = useState({
    type: 'expense',
    amount: '',
    description: '',
    transaction_date: format(new Date(), 'yyyy-MM-dd'),
    tags: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [postingId, setPostingId] = useState(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);

    const [itemRes, categoryRes, walletRes, ruleRes] = await Promise.all([
      supabase.from('transaction_inbox').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      loadAccessibleCategories(supabase, user.id),
      supabase.from('wallets').select('id, name').eq('user_id', user.id).order('name'),
      supabase.from('category_rules').select('*').eq('user_id', user.id).eq('is_active', true).order('priority'),
    ]);

    const error = itemRes.error || categoryRes.error || walletRes.error || ruleRes.error;
    if (error) toast.error(error.message || 'Gagal memuat transaction inbox');

    const rows = itemRes.data || [];
    const cats = categoryRes.data || [];
    const ws = walletRes.data || [];

    setItems(rows);
    setCategories(cats);
    setWallets(ws);
    setRules(ruleRes.data || []);

    setSelections(Object.fromEntries(rows.map((item) => {
      const validSuggested = cats.some(
        (cat) => String(cat.id) === String(item.suggested_category_id) && cat.type === item.type
      );
      const validWallet = ws.some((wallet) => String(wallet.id) === String(item.wallet_id));
      return [item.id, {
        category_id: validSuggested ? String(item.suggested_category_id) : '',
        wallet_id: validWallet ? String(item.wallet_id) : (ws[0]?.id || ''),
      }];
    })));

    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const previewRule = useMemo(
    () => findMatchingRule(rules, { type: form.type, description: form.description }),
    [rules, form.type, form.description],
  );

  const capture = async (event) => {
    event.preventDefault();
    const amount = Number(form.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) return toast.error('Nominal harus lebih dari 0');

    const suggestedCategory = previewRule
      && categories.some((cat) => String(cat.id) === String(previewRule.category_id) && cat.type === form.type)
      ? previewRule.category_id
      : null;

    const suggestedWallet = previewRule?.wallet_id
      && wallets.some((wallet) => String(wallet.id) === String(previewRule.wallet_id))
      ? previewRule.wallet_id
      : null;

    setSaving(true);
    const { error } = await supabase.from('transaction_inbox').insert([{
      user_id: user.id,
      type: form.type,
      amount,
      transaction_date: form.transaction_date,
      description: form.description.trim() || null,
      wallet_id: suggestedWallet,
      suggested_category_id: suggestedCategory,
      tags: parseTags(form.tags),
    }]);
    setSaving(false);

    if (error) return toast.error(error.message);

    toast.success('Masuk ke Transaction Inbox');
    setForm({
      type: form.type,
      amount: '',
      description: '',
      transaction_date: format(new Date(), 'yyyy-MM-dd'),
      tags: '',
    });
    load();
  };

  const post = async (item) => {
    const selected = selections[item.id] || {};
    if (!selected.category_id) return toast.error('Pilih kategori');
    if (!selected.wallet_id) return toast.error('Pilih dompet');

    setPostingId(item.id);
    const { error } = await supabase.rpc('post_inbox_item', {
      p_item_id: item.id,
      p_category_id: Number(selected.category_id),
      p_wallet_id: selected.wallet_id,
    });
    setPostingId(null);

    if (error) return toast.error(error.message || 'Gagal memposting transaksi');

    toast.success('Transaksi dipindahkan dari Inbox ke cashflow');
    load();
  };

  const remove = async (item) => {
    if (!window.confirm('Buang draft transaksi ini dari Inbox?')) return;
    const { error } = await supabase.from('transaction_inbox').delete().eq('id', item.id).eq('user_id', user.id);
    if (error) return toast.error(error.message);
    toast.success('Draft dibuang');
    load();
  };

  return (
    <main className="min-h-screen pb-32 md:pb-16 pt-8 md:pt-32 text-slate-900 dark:text-slate-100">
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <header className="mb-8 max-w-3xl">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-300 mb-2"><Inbox size={16}/><span className="text-[10px] uppercase tracking-[0.16em]">Organization / Inbox</span></div>
          <h1 className="text-[2rem] md:text-[2.7rem] font-semibold tracking-[-0.04em]">Catat cepat, rapikan belakangan</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Inbox cocok saat buru-buru. Draft di sini belum memengaruhi saldo, budget, atau laporan sampai kamu menekan “Masukkan ke cashflow”.
          </p>
        </header>

        <section className="grid lg:grid-cols-[.78fr_1.22fr] gap-5 items-start">
          <form onSubmit={capture} className="liquid-nav rounded-[2.2rem] p-5 md:p-6 lg:sticky lg:top-28 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={()=>setForm({...form,type:'expense'})} className={`h-11 rounded-2xl text-sm font-medium ${form.type==='expense'?'bg-rose-500 text-white':'bg-white/45 dark:bg-white/[.05]'}`}>Pengeluaran</button>
              <button type="button" onClick={()=>setForm({...form,type:'income'})} className={`h-11 rounded-2xl text-sm font-medium ${form.type==='income'?'bg-emerald-500 text-white':'bg-white/45 dark:bg-white/[.05]'}`}>Pemasukan</button>
            </div>

            <input required type="number" min="1" value={form.amount} onChange={(e)=>setForm({...form,amount:e.target.value})} placeholder="Nominal" className="w-full rounded-2xl px-4 py-4 text-xl font-semibold outline-none"/>
            <input value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})} placeholder="Pertamina, makan siang, gaji..." className="w-full rounded-2xl px-4 py-4 outline-none"/>
            <input type="date" value={form.transaction_date} onChange={(e)=>setForm({...form,transaction_date:e.target.value})} className="w-full rounded-2xl px-4 py-4 outline-none"/>
            <input value={form.tags} onChange={(e)=>setForm({...form,tags:e.target.value})} placeholder="Tag opsional: motor, kuliah" className="w-full rounded-2xl px-4 py-4 outline-none"/>

            {previewRule && (
              <div className="rounded-2xl bg-indigo-500/[.07] p-4 flex gap-3">
                <Sparkles size={16} className="text-indigo-500 shrink-0"/>
                <div><p className="text-xs font-medium">Rule cocok</p><p className="text-[10px] text-slate-400 mt-1">{previewRule.name || previewRule.match_value} akan dijadikan saran saat review.</p></div>
              </div>
            )}

            <button disabled={saving} className="liquid-primary w-full h-12 rounded-2xl text-white font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"><Plus size={16}/>{saving?'Menyimpan…':'Simpan ke Inbox'}</button>
          </form>

          <div className="liquid-nav rounded-[2.2rem] p-5 md:p-6">
            <div className="flex items-center justify-between gap-4 mb-5"><div><p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Pending</p><h2 className="text-xl font-semibold mt-1">{items.length} perlu direview</h2></div><Inbox size={19} className="text-indigo-500"/></div>

            {loading ? (
              <div className="space-y-3">{[1,2,3].map((item)=><div key={item} className="h-36 rounded-2xl bg-white/35 dark:bg-white/[.04] animate-pulse"/>)}</div>
            ) : !items.length ? (
              <div className="py-16 text-center"><Inbox size={28} className="mx-auto text-slate-300 mb-3"/><p className="font-medium">Inbox kosong</p><p className="text-sm text-slate-400 mt-1">Semua draft sudah dirapikan.</p></div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => {
                  const selected = selections[item.id] || {};
                  const itemCategories = categories.filter((cat) => cat.type === item.type);
                  return (
                    <article key={item.id} className="rounded-[1.8rem] bg-white/30 dark:bg-white/[.03] border border-white/55 dark:border-white/10 p-4 md:p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0"><p className="text-sm font-medium truncate">{item.description || (item.type==='income'?'Pemasukan':'Pengeluaran')}</p><p className="text-[10px] text-slate-400 mt-1">{item.transaction_date}{(item.tags||[]).length ? ` · ${item.tags.map((tag)=>'#'+tag).join(' ')}` : ''}</p></div>
                        <p className={`text-lg font-semibold whitespace-nowrap ${item.type==='income'?'text-emerald-600 dark:text-emerald-300':'text-rose-500'}`}>{item.type==='income'?'+':'-'}{rupiah(item.amount)}</p>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-2 mt-4">
                        <select value={selected.category_id || ''} onChange={(e)=>setSelections({...selections,[item.id]:{...selected,category_id:e.target.value}})} className="min-w-0 rounded-xl px-3 py-3 text-xs font-medium outline-none"><option value="">Pilih kategori</option>{itemCategories.map((cat)=><option key={cat.id} value={cat.id}>{cat.name}</option>)}</select>
                        <select value={selected.wallet_id || ''} onChange={(e)=>setSelections({...selections,[item.id]:{...selected,wallet_id:e.target.value}})} className="min-w-0 rounded-xl px-3 py-3 text-xs font-medium outline-none"><option value="">Pilih dompet</option>{wallets.map((wallet)=><option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}</select>
                      </div>

                      <div className="grid grid-cols-[1fr_auto] gap-2 mt-3">
                        <button disabled={postingId===item.id || !selected.category_id || !selected.wallet_id} onClick={()=>post(item)} className="h-11 rounded-xl bg-indigo-500 text-white text-xs font-medium inline-flex items-center justify-center gap-2 disabled:opacity-35"><Send size={14}/>{postingId===item.id?'Memposting…':'Masukkan ke cashflow'}</button>
                        <button onClick={()=>remove(item)} className="w-11 h-11 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center"><Trash2 size={14}/></button>
                      </div>
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
