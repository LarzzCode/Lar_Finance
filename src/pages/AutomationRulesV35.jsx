import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Pencil, Power, Trash2, WandSparkles, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { loadAccessibleCategories } from '../lib/financeDataV35';

const emptyForm = {
  name: '',
  transaction_type: 'expense',
  match_operator: 'contains',
  match_value: '',
  category_id: '',
  wallet_id: '',
  priority: '100',
};

const operatorLabel = {
  contains: 'mengandung',
  equals: 'sama dengan',
  starts_with: 'diawali',
};

export default function AutomationRulesV35() {
  const { user } = useAuth();
  const [rules, setRules] = useState([]);
  const [categories, setCategories] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    if (!user) return;
    setLoading(true);

    const [ruleRes, categoryRes, walletRes] = await Promise.all([
      supabase
        .from('category_rules')
        .select('*, categories(name, type), wallets(name)')
        .eq('user_id', user.id)
        .order('priority')
        .order('created_at'),
      loadAccessibleCategories(supabase, user.id),
      supabase.from('wallets').select('id, name').eq('user_id', user.id).order('name'),
    ]);

    const error = ruleRes.error || categoryRes.error || walletRes.error;
    if (error) toast.error(error.message || 'Gagal memuat automation rules');

    setRules(ruleRes.data || []);
    setCategories(categoryRes.data || []);
    setWallets(walletRes.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const visibleCategories = useMemo(
    () => categories.filter((item) => item.type === form.transaction_type),
    [categories, form.transaction_type],
  );

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (rule) => {
    setEditing(rule);
    setForm({
      name: rule.name || '',
      transaction_type: rule.transaction_type || 'expense',
      match_operator: rule.match_operator || 'contains',
      match_value: rule.match_value || '',
      category_id: String(rule.category_id || ''),
      wallet_id: String(rule.wallet_id || ''),
      priority: String(rule.priority ?? 100),
    });
    setModalOpen(true);
  };

  const close = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const save = async (event) => {
    event.preventDefault();

    const value = form.match_value.trim();
    if (!value) return toast.error('Kata pemicu wajib diisi');

    const category = visibleCategories.find((item) => String(item.id) === String(form.category_id));
    if (!category) return toast.error('Pilih kategori yang sesuai jenis transaksi');

    if (form.wallet_id && !wallets.some((item) => String(item.id) === String(form.wallet_id))) {
      return toast.error('Dompet tidak valid');
    }

    setSaving(true);

    const payload = {
      user_id: user.id,
      name: form.name.trim() || null,
      transaction_type: form.transaction_type,
      match_field: 'description',
      match_operator: form.match_operator,
      match_value: value,
      category_id: Number(form.category_id),
      wallet_id: form.wallet_id || null,
      priority: Number(form.priority || 100),
      updated_at: new Date().toISOString(),
    };

    const result = editing
      ? await supabase.from('category_rules').update(payload).eq('id', editing.id).eq('user_id', user.id)
      : await supabase.from('category_rules').insert([payload]);

    setSaving(false);

    if (result.error) return toast.error(result.error.message);

    toast.success(editing ? 'Rule diperbarui' : 'Rule dibuat');
    close();
    load();
  };

  const toggle = async (rule) => {
    const { error } = await supabase
      .from('category_rules')
      .update({ is_active: !rule.is_active, updated_at: new Date().toISOString() })
      .eq('id', rule.id)
      .eq('user_id', user.id);

    if (error) return toast.error(error.message);

    toast.success(rule.is_active ? 'Rule dijeda' : 'Rule diaktifkan');
    load();
  };

  const remove = async (rule) => {
    if (!window.confirm(`Hapus rule “${rule.name || rule.match_value}”?`)) return;

    const { error } = await supabase
      .from('category_rules')
      .delete()
      .eq('id', rule.id)
      .eq('user_id', user.id);

    if (error) return toast.error(error.message);

    toast.success('Rule dihapus');
    load();
  };

  return (
    <main className="min-h-screen pb-32 md:pb-16 pt-8 md:pt-32 text-slate-900 dark:text-slate-100">
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-8">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-300 mb-2">
              <WandSparkles size={16} />
              <span className="text-[10px] uppercase tracking-[0.16em] font-medium">Data Quality / Automation</span>
            </div>
            <h1 className="text-[2rem] md:text-[2.7rem] font-semibold tracking-[-0.04em]">Auto Categorization</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-2xl">
              Ajari Lar Finance pola sederhana. Contoh: kalau catatan mengandung “Pertamina”, otomatis pilih kategori Bensin.
            </p>
          </div>

          <button
            onClick={openNew}
            className="liquid-primary inline-flex items-center justify-center gap-2 text-white px-5 py-3.5 rounded-2xl text-sm font-medium"
          >
            <Plus size={17} /> Rule baru
          </button>
        </header>

        <section className="liquid-nav rounded-[2.1rem] p-5 md:p-6 mb-5">
          <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Cara kerja</p>
          <div className="grid md:grid-cols-3 gap-3 mt-4 text-sm">
            <div className="rounded-2xl bg-white/40 dark:bg-white/[.04] p-4">
              <p className="font-medium">1. Baca catatan</p>
              <p className="text-xs text-slate-400 mt-1">Lar Finance melihat teks merchant/catatan saat kamu mengetik transaksi.</p>
            </div>
            <div className="rounded-2xl bg-white/40 dark:bg-white/[.04] p-4">
              <p className="font-medium">2. Cari rule cocok</p>
              <p className="text-xs text-slate-400 mt-1">Priority lebih kecil diperiksa lebih dulu.</p>
            </div>
            <div className="rounded-2xl bg-white/40 dark:bg-white/[.04] p-4">
              <p className="font-medium">3. Isi otomatis</p>
              <p className="text-xs text-slate-400 mt-1">Kategori, dan opsional dompet, dipilih otomatis tetapi tetap bisa kamu ubah.</p>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="grid md:grid-cols-2 gap-4">
            {[1,2].map((item) => <div key={item} className="h-40 liquid-nav rounded-[2rem] animate-pulse" />)}
          </div>
        ) : !rules.length ? (
          <div className="liquid-nav rounded-[2.2rem] py-16 px-6 text-center">
            <WandSparkles size={30} className="mx-auto text-slate-300 mb-4" />
            <h2 className="text-xl font-semibold">Belum ada automation rule</h2>
            <p className="text-sm text-slate-500 mt-2 mb-5">Mulai dari merchant yang paling sering muncul: Pertamina, Indomaret, Netflix, dan sejenisnya.</p>
            <button onClick={openNew} className="text-sm font-medium text-indigo-600 dark:text-indigo-300">Buat rule pertama →</button>
          </div>
        ) : (
          <section className="grid md:grid-cols-2 gap-4">
            {rules.map((rule) => (
              <article key={rule.id} className={`liquid-nav rounded-[2rem] p-5 md:p-6 ${!rule.is_active ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-semibold truncate">{rule.name || rule.match_value}</h2>
                      <span className={`text-[9px] uppercase tracking-wide rounded-full px-2 py-1 ${
                        rule.transaction_type === 'income'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                          : 'bg-rose-500/10 text-rose-500'
                      }`}>
                        {rule.transaction_type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      Catatan {operatorLabel[rule.match_operator] || rule.match_operator} “{rule.match_value}”
                    </p>
                  </div>

                  <div className="flex gap-1">
                    <button onClick={() => openEdit(rule)} className="w-9 h-9 rounded-xl bg-white/45 dark:bg-white/[.05] flex items-center justify-center text-slate-500"><Pencil size={15} /></button>
                    <button onClick={() => toggle(rule)} className="w-9 h-9 rounded-xl bg-white/45 dark:bg-white/[.05] flex items-center justify-center text-slate-500"><Power size={15} /></button>
                    <button onClick={() => remove(rule)} className="w-9 h-9 rounded-xl bg-rose-500/[.08] flex items-center justify-center text-rose-500"><Trash2 size={15} /></button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-6">
                  <div className="rounded-2xl bg-white/35 dark:bg-white/[.035] p-4">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Kategori</p>
                    <p className="text-sm font-medium mt-1">{rule.categories?.name || 'Kategori'}</p>
                  </div>
                  <div className="rounded-2xl bg-white/35 dark:bg-white/[.035] p-4">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Dompet</p>
                    <p className="text-sm font-medium mt-1">{rule.wallets?.name || 'Tetap pilihan terakhir'}</p>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 mt-4">Priority {rule.priority}</p>
              </article>
            ))}
          </section>
        )}
      </div>

      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-[110] bg-slate-950/40 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              className="liquid-nav w-full max-w-lg rounded-t-[2rem] sm:rounded-[2rem] p-6 md:p-7 max-h-[92vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">Automation rule</p>
                  <h3 className="text-xl font-semibold mt-1">{editing ? 'Edit rule' : 'Rule baru'}</h3>
                </div>
                <button onClick={close} className="w-9 h-9 rounded-full bg-white/45 dark:bg-white/[.05] flex items-center justify-center"><X size={17} /></button>
              </div>

              <form onSubmit={save} className="space-y-4">
                <label className="block">
                  <span className="text-[10px] uppercase tracking-wide text-slate-400">Nama rule</span>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Pertamina → Bensin"
                    className="w-full mt-2 rounded-2xl px-4 py-4 font-medium outline-none"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['expense', 'Pengeluaran'],
                    ['income', 'Pemasukan'],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm({ ...form, transaction_type: key, category_id: '' })}
                      className={`h-11 rounded-2xl text-sm font-medium ${
                        form.transaction_type === key
                          ? key === 'expense'
                            ? 'bg-rose-500 text-white'
                            : 'bg-emerald-500 text-white'
                          : 'bg-white/45 dark:bg-white/[.05]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="grid sm:grid-cols-[.8fr_1.2fr] gap-3">
                  <label>
                    <span className="text-[10px] uppercase tracking-wide text-slate-400">Pencocokan</span>
                    <select
                      value={form.match_operator}
                      onChange={(e) => setForm({ ...form, match_operator: e.target.value })}
                      className="w-full mt-2 rounded-2xl px-4 py-4 font-medium outline-none"
                    >
                      <option value="contains">Mengandung</option>
                      <option value="equals">Sama persis</option>
                      <option value="starts_with">Diawali</option>
                    </select>
                  </label>

                  <label>
                    <span className="text-[10px] uppercase tracking-wide text-slate-400">Kata pemicu</span>
                    <input
                      required
                      value={form.match_value}
                      onChange={(e) => setForm({ ...form, match_value: e.target.value })}
                      placeholder="Pertamina"
                      className="w-full mt-2 rounded-2xl px-4 py-4 font-medium outline-none"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-[10px] uppercase tracking-wide text-slate-400">Kategori otomatis</span>
                  <select
                    required
                    value={form.category_id}
                    onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                    className="w-full mt-2 rounded-2xl px-4 py-4 font-medium outline-none"
                  >
                    <option value="">Pilih kategori</option>
                    {visibleCategories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-[10px] uppercase tracking-wide text-slate-400">Dompet otomatis · opsional</span>
                  <select
                    value={form.wallet_id}
                    onChange={(e) => setForm({ ...form, wallet_id: e.target.value })}
                    className="w-full mt-2 rounded-2xl px-4 py-4 font-medium outline-none"
                  >
                    <option value="">Jangan ubah dompet</option>
                    {wallets.map((wallet) => (
                      <option key={wallet.id} value={wallet.id}>{wallet.name}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-[10px] uppercase tracking-wide text-slate-400">Priority</span>
                  <input
                    type="number"
                    min="1"
                    max="9999"
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full mt-2 rounded-2xl px-4 py-4 font-medium outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Angka lebih kecil diperiksa lebih dulu.</p>
                </label>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button type="button" onClick={close} className="h-12 rounded-2xl bg-white/45 dark:bg-white/[.05] font-medium text-sm">Batal</button>
                  <button disabled={saving} className="liquid-primary h-12 rounded-2xl text-white font-medium text-sm disabled:opacity-60">
                    {saving ? 'Menyimpan…' : 'Simpan rule'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
