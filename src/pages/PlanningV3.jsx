import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, CalendarClock, CalendarDays, LayoutGrid, PiggyBank, Repeat2, Scale, SearchCheck, Target, Undo2, UserRound, WandSparkles } from 'lucide-react';

const items = [
  { title: 'Budget Bulanan', description: 'Atur batas pengeluaran per kategori dan pantau realisasinya terhadap pemasukan.', path: '/budget', icon: Target, tone: 'indigo' },
  { title: 'Langganan Rutin', description: 'Pantau tagihan bulanan, jatuh tempo, dan pembayaran rutin dalam satu tempat.', path: '/subscription', icon: CalendarClock, tone: 'amber' },
  { title: 'Transaksi Rutin', description: 'Simpan template gaji atau pengeluaran berulang lalu catat dengan satu konfirmasi.', path: '/recurring', icon: Repeat2, tone: 'sky' },
  { title: 'Kalender Cashflow', description: 'Baca pemasukan, pengeluaran, transfer, dan jadwal rutin berdasarkan tanggal.', path: '/calendar', icon: CalendarDays, tone: 'violet' },
  { title: 'Spending Insights', description: 'Bandingkan ritme minggu ini dengan 6 minggu sebelumnya dan temukan lonjakan pengeluaran yang tidak biasa.', path: '/insights', icon: SearchCheck, tone: 'orange' },
  { title: 'Auto Categorization', description: 'Buat rule seperti Pertamina → Bensin agar kategori terisi otomatis saat mencatat transaksi.', path: '/rules', icon: WandSparkles, tone: 'sky' },
  { title: 'Cocokkan Saldo', description: 'Bandingkan saldo aplikasi dengan saldo nyata dan simpan selisih sebagai adjustment yang bisa diaudit.', path: '/reconcile', icon: Scale, tone: 'teal' },
  { title: 'Trash Transaksi', description: 'Pulihkan transaksi yang tidak sengaja dihapus sebelum benar-benar dihapus permanen.', path: '/trash', icon: Undo2, tone: 'slate' },
  { title: 'Tabungan Impian', description: 'Buat target finansial dan lihat progres tabungan menuju tujuan yang ingin dicapai.', path: '/savings', icon: PiggyBank, tone: 'emerald' },
  { title: 'Kategori', description: 'Kelola kategori pemasukan dan pengeluaran agar laporan keuangan tetap rapi.', path: '/categories', icon: LayoutGrid, tone: 'rose' },
  { title: 'Profil & Akun', description: 'Perbarui nama, foto profil, dan akses pengaturan akun Lar Finance.', path: '/profile', icon: UserRound, tone: 'slate' },
];

const toneClass = {
  indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  rose: 'bg-rose-500/10 text-rose-500 dark:text-rose-300',
  sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-300',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
  orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-300',
  teal: 'bg-teal-500/10 text-teal-600 dark:text-teal-300',
  slate: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
};

export default function PlanningV3() {
  return (
    <main className="min-h-screen pb-32 md:pb-16 pt-8 md:pt-32 text-slate-900 dark:text-slate-100">
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8 md:mb-10">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400 mb-2">Financial planning</p>
          <h1 className="text-[2rem] md:text-[2.8rem] leading-tight font-semibold tracking-[-0.04em] mb-3">Rencanakan uangmu dengan lebih tenang</h1>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">Budget, recurring cashflow, data quality, spending insight, goals, dan master data berada dalam satu area yang ringan untuk dibaca.</p>
        </motion.header>

        <div className="grid md:grid-cols-2 gap-4 md:gap-5">
          {items.map(({ title, description, path, icon: Icon, tone }, index) => (
            <motion.div key={path} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
              <Link to={path} className="liquid-nav group block h-full rounded-[2rem] p-6 md:p-7 transition-transform hover:-translate-y-0.5">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${toneClass[tone]}`}><Icon size={21} strokeWidth={1.9} /></div>
                <h2 className="text-lg md:text-xl font-semibold mb-2">{title}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed min-h-[44px]">{description}</p>
                <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">Buka fitur <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" /></div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </main>
  );
}
