import { useEffect, useMemo, useState } from 'react';
import { BookOpenText, ChevronLeft, ChevronRight, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { addMonths, format, startOfMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function FinancialNotesV36() {
  const { user } = useAuth();
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [notes, setNotes] = useState([]);
  const [form, setForm] = useState({ title: '', body: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const monthKey = format(month, 'yyyy-MM-01');

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('financial_notes')
      .select('*')
      .eq('user_id', user.id)
      .order('note_month', { ascending: false });

    if (error) toast.error(error.message || 'Gagal memuat financial notes');

    const rows = data || [];
    setNotes(rows);
    const current = rows.find((item) => item.note_month === monthKey);
    setForm({ title: current?.title || '', body: current?.body || '' });
    setLoading(false);
  };

  useEffect(() => { load(); }, [user, monthKey]);

  const currentNote = useMemo(
    () => notes.find((item) => item.note_month === monthKey),
    [notes, monthKey],
  );

  const save = async () => {
    if (!user) return;
    setSaving(true);

    const payload = {
      user_id: user.id,
      note_month: monthKey,
      title: form.title.trim() || null,
      body: form.body,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('financial_notes')
      .upsert(payload, { onConflict: 'user_id,note_month' });

    setSaving(false);

    if (error) return toast.error(error.message);

    toast.success('Catatan bulan disimpan');
    load();
  };

  const selectNote = (note) => {
    const [year, monthNumber] = note.note_month.split('-').map(Number);
    setMonth(new Date(year, monthNumber - 1, 1));
  };

  return (
    <main className="min-h-screen pb-32 md:pb-16 pt-8 md:pt-32 text-slate-900 dark:text-slate-100">
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <header className="mb-8 max-w-3xl">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-300 mb-2"><BookOpenText size={16}/><span className="text-[10px] uppercase tracking-[0.16em]">Organization / Money Journal</span></div>
          <h1 className="text-[2rem] md:text-[2.7rem] font-semibold tracking-[-0.04em]">Cerita di balik angka</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Grafik cuma menunjukkan angka. Money Journal menyimpan konteks: servis motor, pendapatan turun, ada project besar, atau alasan bulan tertentu terasa berbeda.
          </p>
        </header>

        <div className="grid lg:grid-cols-[.72fr_1.28fr] gap-5 items-start">
          <aside className="liquid-nav rounded-[2.2rem] p-5 md:p-6 lg:sticky lg:top-28">
            <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Arsip bulanan</p>
            <h2 className="text-xl font-semibold mt-1 mb-5">Catatan sebelumnya</h2>

            {notes.length ? (
              <div className="space-y-2">
                {notes.slice(0, 18).map((note) => (
                  <button
                    key={note.id}
                    onClick={() => selectNote(note)}
                    className={`w-full text-left rounded-2xl p-4 transition ${
                      note.note_month === monthKey
                        ? 'bg-indigo-500/10 border border-indigo-500/15'
                        : 'bg-white/35 dark:bg-white/[.035]'
                    }`}
                  >
                    <p className="text-sm font-medium">{format(new Date(note.note_month + 'T00:00:00'), 'MMMM yyyy', { locale: id })}</p>
                    <p className="text-[11px] text-slate-400 mt-1 truncate">{note.title || note.body || 'Catatan bulan'}</p>
                  </button>
                ))}
              </div>
            ) : <div className="py-10 text-center text-sm text-slate-400">Belum ada catatan.</div>}
          </aside>

          <section className="liquid-nav rounded-[2.3rem] p-5 md:p-7">
            <div className="flex items-center justify-between gap-4 mb-6">
              <button onClick={() => setMonth((current) => addMonths(current, -1))} className="w-10 h-10 rounded-xl bg-white/45 dark:bg-white/[.05] flex items-center justify-center"><ChevronLeft size={16}/></button>
              <div className="text-center"><p className="text-[10px] uppercase tracking-wide text-slate-400">Financial note</p><h2 className="text-xl font-semibold mt-1">{format(month, 'MMMM yyyy', { locale: id })}</h2></div>
              <button onClick={() => setMonth((current) => addMonths(current, 1))} className="w-10 h-10 rounded-xl bg-white/45 dark:bg-white/[.05] flex items-center justify-center"><ChevronRight size={16}/></button>
            </div>

            {loading ? (
              <div className="h-72 rounded-2xl bg-white/35 dark:bg-white/[.04] animate-pulse" />
            ) : (
              <div className="space-y-4">
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Judul singkat, mis. September: servis motor"
                  className="w-full rounded-2xl px-4 py-4 font-medium outline-none"
                />
                <textarea
                  rows={14}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  placeholder="Apa yang terjadi dengan uangmu bulan ini? Apa yang bikin pengeluaran naik/turun? Apa yang ingin kamu perbaiki bulan depan?"
                  className="w-full rounded-2xl px-4 py-4 text-sm leading-relaxed outline-none resize-y"
                />
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[10px] text-slate-400">{currentNote ? 'Catatan bulan ini sudah pernah disimpan.' : 'Belum ada catatan untuk bulan ini.'}</p>
                  <button onClick={save} disabled={saving} className="liquid-primary h-11 px-5 rounded-2xl text-white text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50"><Save size={15}/>{saving?'Menyimpan…':'Simpan catatan'}</button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
