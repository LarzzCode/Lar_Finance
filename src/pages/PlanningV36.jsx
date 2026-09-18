import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpenText,
  CalendarClock,
  CalendarDays,
  Coins,
  HandCoins,
  Inbox,
  Landmark,
  LayoutGrid,
  PiggyBank,
  Repeat2,
  Scale,
  SearchCheck,
  Tags,
  Target,
  TrendingUp,
  Undo2,
  UserRound,
  WandSparkles,
} from 'lucide-react';

const sections = [
  {
    eyebrow: 'Planning & Intelligence',
    title: 'Rencanakan dan baca pola uang',
    description: 'Budget, jadwal, forecast, dan insight untuk memahami arah cashflow.',
    items: [
      { title: 'Budget Bulanan', description: 'Atur batas pengeluaran per kategori dan pantau realisasinya.', path: '/budget', icon: Target, tone: 'indigo' },
      { title: 'Langganan Rutin', description: 'Pantau tagihan bulanan, jatuh tempo, dan pembayaran rutin.', path: '/subscription', icon: CalendarClock, tone: 'amber' },
      { title: 'Transaksi Rutin', description: 'Simpan template gaji atau pengeluaran berulang.', path: '/recurring', icon: Repeat2, tone: 'sky' },
      { title: 'Kalender Cashflow', description: 'Lihat transaksi, transfer, dan jadwal berdasarkan tanggal.', path: '/calendar', icon: CalendarDays, tone: 'violet' },
      { title: 'Financial Forecast', description: 'Lihat proyeksi akhir bulan, safe-to-spend, dan future cashflow.', path: '/forecast', icon: TrendingUp, tone: 'emerald' },
      { title: 'Spending Insights', description: 'Bandingkan pengeluaran bulan berjalan dengan periode tanggal yang sama pada 6 bulan sebelumnya.', path: '/insights', icon: SearchCheck, tone: 'orange' },
    ],
  },
  {
    eyebrow: 'Data Quality',
    title: 'Bikin data makin rapi dan bisa dipercaya',
    description: 'Kurangi salah kategori, transaksi hilang, dan selisih saldo.',
    items: [
      { title: 'Transaction Inbox', description: 'Catat cepat sekarang, pilih kategori dan dompet saat sudah sempat review.', path: '/inbox', icon: Inbox, tone: 'indigo' },
      { title: 'Auto Categorization', description: 'Rule seperti Pertamina → Bensin untuk membantu isi kategori otomatis.', path: '/rules', icon: WandSparkles, tone: 'sky' },
      { title: 'Money Tags', description: 'Kelompokkan transaksi berdasarkan konteks seperti #motor atau #kuliah.', path: '/tags', icon: Tags, tone: 'violet' },
      { title: 'Cocokkan Saldo', description: 'Bandingkan saldo Lar Finance dengan saldo nyata dan simpan audit selisih.', path: '/reconcile', icon: Scale, tone: 'teal' },
      { title: 'Trash Transaksi', description: 'Pulihkan transaksi yang tidak sengaja dihapus selama masa restore.', path: '/trash', icon: Undo2, tone: 'slate' },
    ],
  },
  {
    eyebrow: 'Wealth',
    title: 'Lihat lebih jauh dari sekadar cashflow',
    description: 'Target, kewajiban, dan kekayaan bersih dalam satu area.',
    items: [
      { title: 'Tabungan Impian', description: 'Buat target finansial dan pantau progres tabungan.', path: '/savings', icon: PiggyBank, tone: 'emerald' },
      { title: 'Sinking Funds', description: 'Pecah pengeluaran besar seperti pajak atau servis menjadi target setoran kecil.', path: '/sinking-funds', icon: Coins, tone: 'amber' },
      { title: 'Utang & Piutang', description: 'Pantau siapa berutang, kepada siapa kamu berutang, dan sisa outstanding.', path: '/debts', icon: HandCoins, tone: 'rose' },
      { title: 'Net Worth', description: 'Gabungkan saldo, aset, piutang, utang, dan kewajiban untuk melihat kekayaan bersih.', path: '/net-worth', icon: Landmark, tone: 'indigo' },
      { title: 'Money Journal', description: 'Simpan cerita di balik angka setiap bulan agar grafik punya konteks.', path: '/notes', icon: BookOpenText, tone: 'slate' },
    ],
  },
  {
    eyebrow: 'Master & Account',
    title: 'Pengaturan dasar',
    description: 'Master kategori dan identitas akun.',
    items: [
      { title: 'Kategori', description: 'Kelola kategori pemasukan dan pengeluaran.', path: '/categories', icon: LayoutGrid, tone: 'rose' },
      { title: 'Profil & Akun', description: 'Perbarui nama, foto profil, dan pengaturan akun.', path: '/profile', icon: UserRound, tone: 'slate' },
    ],
  },
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

export default function PlanningV36() {
  return (
    <main className="min-h-screen pb-32 md:pb-16 pt-8 md:pt-32 text-slate-900 dark:text-slate-100">
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-9 md:mb-12"
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400 mb-2">Lar Finance V3.6</p>
          <h1 className="text-[2rem] md:text-[2.8rem] leading-tight font-semibold tracking-[-0.04em] mb-3">
            Planning, data quality, dan wealth
          </h1>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">
            Semakin banyak fitur tidak harus berarti semakin ramai. Semua alat Lar Finance dikelompokkan berdasarkan tujuan supaya tetap gampang dicari.
          </p>
        </motion.header>

        <div className="space-y-9 md:space-y-12">
          {sections.map((section, sectionIndex) => (
            <section key={section.eyebrow}>
              <div className="mb-4 md:mb-5">
                <p className="text-[10px] uppercase tracking-[0.16em] font-medium text-slate-400">{section.eyebrow}</p>
                <h2 className="text-xl md:text-2xl font-semibold tracking-[-0.025em] mt-1">{section.title}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{section.description}</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4 md:gap-5">
                {section.items.map(({ title, description, path, icon: Icon, tone }, index) => (
                  <motion.div
                    key={path}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: sectionIndex * 0.03 + index * 0.025 }}
                  >
                    <Link
                      to={path}
                      className="liquid-nav group block h-full rounded-[2rem] p-5 md:p-6 transition-transform hover:-translate-y-0.5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${toneClass[tone]}`}>
                          <Icon size={19} strokeWidth={1.9} />
                        </div>
                        <ArrowRight size={15} className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-1 transition-all" />
                      </div>
                      <h3 className="text-base md:text-lg font-semibold mt-5">{title}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mt-2">{description}</p>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
