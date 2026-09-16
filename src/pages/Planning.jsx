import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CalendarClock,
  LayoutGrid,
  PiggyBank,
  Target,
  UserRound,
} from 'lucide-react';

const items = [
  {
    title: 'Budget Bulanan',
    description: 'Atur batas pengeluaran per kategori dan pantau realisasinya terhadap pemasukan.',
    path: '/budget',
    icon: Target,
    tone: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  },
  {
    title: 'Langganan Rutin',
    description: 'Pantau tagihan bulanan, jatuh tempo, dan pembayaran rutin dalam satu tempat.',
    path: '/subscription',
    icon: CalendarClock,
    tone: 'bg-amber-50 text-amber-600 border-amber-100',
  },
  {
    title: 'Tabungan Impian',
    description: 'Buat target finansial dan lihat progres tabungan menuju tujuan yang ingin dicapai.',
    path: '/savings',
    icon: PiggyBank,
    tone: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  },
  {
    title: 'Kategori',
    description: 'Kelola kategori pemasukan dan pengeluaran agar laporan keuangan tetap rapi.',
    path: '/categories',
    icon: LayoutGrid,
    tone: 'bg-rose-50 text-rose-500 border-rose-100',
  },
  {
    title: 'Profil & Akun',
    description: 'Perbarui nama, foto profil, dan akses pengaturan akun Lar Finance.',
    path: '/profile',
    icon: UserRound,
    tone: 'bg-slate-50 text-slate-700 border-slate-200',
  },
];

export default function Planning() {
  return (
    <main className="min-h-screen bg-[#F7F8FA] text-slate-900 pb-28 md:pb-16 pt-8 md:pt-32">
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8 md:mb-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 mb-2">Financial planning</p>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-3">Rencanakan uangmu, bukan cuma mencatatnya.</h1>
          <p className="text-slate-500 max-w-2xl leading-relaxed">Budget, tagihan rutin, tujuan tabungan, dan kategori keuangan sekarang berada dalam satu area yang lebih mudah dipahami.</p>
        </motion.header>

        <div className="grid md:grid-cols-2 gap-4 md:gap-5">
          {items.map(({ title, description, path, icon: Icon, tone }, index) => (
            <motion.div
              key={path}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link to={path} className="group block h-full bg-white border border-slate-200 rounded-[2rem] p-6 md:p-7 shadow-sm hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/5 transition-all">
                <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center mb-6 ${tone}`}>
                  <Icon size={22} />
                </div>
                <h2 className="text-xl font-black mb-2">{title}</h2>
                <p className="text-sm text-slate-500 leading-relaxed min-h-[44px]">{description}</p>
                <div className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-slate-700 group-hover:text-slate-950">
                  Buka fitur <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </main>
  );
}
