import { useEffect, useMemo, useState } from 'react';
import { Archive, CalendarClock, Download, X } from 'lucide-react';
import { differenceInCalendarDays, endOfMonth, format, startOfDay } from 'date-fns';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { exportFinanceBackup } from '../lib/excelBackupV38';

const storageKey = (userId, month) => `lar-finance-backup-reminder:${userId}:${month}`;

export default function MonthlyBackupReminder() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const now = useMemo(() => new Date(), []);
  const month = format(now, 'yyyy-MM');
  const daysLeft = differenceInCalendarDays(endOfMonth(now), startOfDay(now));

  useEffect(() => {
    if (!user || daysLeft < 0 || daysLeft > 2) return;

    const check = async () => {
      const raw = localStorage.getItem(storageKey(user.id, month));
      if (raw) {
        try {
          const state = JSON.parse(raw);
          if (state.completed) return;
          if (state.snoozeUntil && new Date(state.snoozeUntil) > new Date()) return;
        } catch {
          // Ignore invalid old local state.
        }
      }

      const start = `${month}-01`;
      const end = format(endOfMonth(now), 'yyyy-MM-dd');
      const { count, error } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('transaction_date', start)
        .lte('transaction_date', end);

      if (!error && (count || 0) > 0) setVisible(true);
    };

    check();
  }, [user, month, daysLeft, now]);

  if (!visible || !user) return null;

  const rememberState = (state) => {
    localStorage.setItem(storageKey(user.id, month), JSON.stringify(state));
  };

  const backupNow = async () => {
    setDownloading(true);
    try {
      const result = await exportFinanceBackup({ supabase, user });
      rememberState({ completed: true, completedAt: new Date().toISOString(), filename: result.filename });
      setVisible(false);
      toast.success(`Backup selesai · ${result.transactionCount} transaksi`);
    } catch (error) {
      toast.error(error?.message || 'Backup Excel gagal dibuat');
    } finally {
      setDownloading(false);
    }
  };

  const remindTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    rememberState({ completed: false, snoozeUntil: tomorrow.toISOString() });
    setVisible(false);
  };

  return (
    <div className="fixed inset-0 z-[140] bg-slate-950/35 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="liquid-nav w-full max-w-lg rounded-t-[2rem] sm:rounded-[2rem] p-6 md:p-7 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
            <Archive size={21} />
          </div>
          <button onClick={remindTomorrow} className="w-9 h-9 rounded-full bg-white/45 dark:bg-white/[.05] flex items-center justify-center" aria-label="Tutup dan ingatkan besok">
            <X size={16} />
          </button>
        </div>

        <div className="mt-5">
          <p className="text-[10px] uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">Backup bulanan direkomendasikan</p>
          <h2 className="text-2xl font-semibold tracking-[-0.03em] mt-2">Akhir bulan sudah dekat</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
            {daysLeft === 0 ? 'Hari ini adalah hari terakhir bulan ini.' : `Tersisa ${daysLeft} hari sampai akhir bulan.`}
            {' '}Backup menyimpan <strong>seluruh histori akun</strong>, bukan hanya transaksi bulan ini.
          </p>
        </div>

        <div className="mt-5 rounded-2xl bg-white/35 dark:bg-white/[.035] border border-white/60 dark:border-white/10 p-4 flex gap-3">
          <CalendarClock size={17} className="text-slate-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            File berisi transaksi raw, ringkasan per bulan, kategori, dompet, transfer, rekonsiliasi, dan Trash. Simpan di Drive/komputer sebagai arsip mandiri.
          </p>
        </div>

        <div className="grid sm:grid-cols-[.8fr_1.2fr] gap-3 mt-6">
          <button onClick={remindTomorrow} className="h-12 rounded-2xl bg-white/45 dark:bg-white/[.05] text-sm font-medium">
            Ingatkan besok
          </button>
          <button disabled={downloading} onClick={backupNow} className="liquid-primary h-12 rounded-2xl text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
            <Download size={16} /> {downloading ? 'Membuat backup…' : 'Backup Excel sekarang'}
          </button>
        </div>
      </div>
    </div>
  );
}
