import { useEffect, useMemo, useState } from 'react';
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
  Search,
  SearchCheck,
  Star,
  Tags,
  Target,
  TrendingUp,
  Undo2,
  UserRound,
  WandSparkles,
  X,
} from 'lucide-react';

const DEFAULT_PINNED = ['/budget', '/subscription', '/debts', '/savings'];
const PIN_STORAGE_KEY = 'lar-finance-pinned-planning';

const sections = [
  {
    key: 'planning',
    shortLabel: 'Planning',
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
    key: 'quality',
    shortLabel: 'Data Quality',
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
    key: 'wealth',
    shortLabel: 'Wealth',
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
    key: 'master',
    shortLabel: 'Pengaturan',
    eyebrow: 'Master & Account',
    title: 'Pengaturan dasar',
    description: 'Master kategori dan identitas akun.',
    items: [
      { title: 'Kategori', description: 'Kelola kategori pemasukan dan pengeluaran.', path: '/categories', icon: LayoutGrid, tone: 'rose' },
      { title: 'Profil & Akun', description: 'Perbarui nama, foto profil, dan pengaturan akun.', path: '/profile', icon: UserRound, tone: 'slate' },
    ],
  },
];

const allItems = sections.flatMap((sec) => sec.items);

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
  const [query, setQuery] = useState('');
  const [activeSection, setActiveSection] = useState('all');
  const [pinnedPaths, setPinnedPaths] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PIN_STORAGE_KEY));
      if (Array.isArray(saved) && saved.length) return saved;
    } catch {
      // ignore invalid localStorage
    }
    return DEFAULT_PINNED;
  });

  useEffect(() => {
    try {
      localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(pinnedPaths));
    } catch {
      // ignore storage errors
    }
  }, [pinnedPaths]);

  const togglePin = (event, path) => {
    event.preventDefault();
    event.stopPropagation();
    setPinnedPaths((current) =>
      current.includes(path) ? current.filter((item) => item !== path) : [...current, path]
    );
  };

  const pinnedItems = useMemo(
    () => pinnedPaths.map((p) => allItems.find((item) => item.path === p)).filter(Boolean),
    [pinnedPaths]
  );

  const filteredSections = useMemo(() => {
    const term = query.trim().toLowerCase();
    return sections
      .filter((section) => activeSection === 'all' || section.key === activeSection)
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            !term ||
            item.title.toLowerCase().includes(term) ||
            item.description.toLowerCase().includes(term)
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [query, activeSection]);

  return (
    <main className="min-h-screen pb-32 md:pb-16 pt-8 md:pt-32 text-slate-900 dark:text-slate-100">
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-7 md:mb-9"
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400 mb-2">Lar Finance V3.6</p>
          <h1 className="text-[2rem] md:text-[2.8rem] leading-tight font-semibold tracking-[-0.04em] mb-3">
            Planning, data quality, dan wealth
          </h1>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">
            Sematkan fitur favoritmu di bagian atas atau gunakan pencarian cepat agar tidak perlu scroll jauh.
          </p>
        </motion.header>

        {/* Search & Section Filter Bar */}
        <section className="liquid-nav rounded-[2rem] p-4 md:p-5 mb-7 flex flex-col md:flex-row md:items-center justify-between gap-3.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { key: 'all', label: 'Semua' },
              ...sections.map((s) => ({ key: s.key, label: s.shortLabel })),
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveSection(tab.key)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeSection === tab.key
                    ? 'liquid-primary text-white shadow-sm'
                    : 'liquid-nav-pill text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <label className="relative md:w-72">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari menu (utang, budget, tag)..."
              className="w-full rounded-2xl pl-10 pr-9 py-2.5 text-xs sm:text-sm font-medium outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                aria-label="Bersihkan pencarian"
              >
                <X size={14} />
              </button>
            )}
          </label>
        </section>

        {/* Pinned / Quick Access Section */}
        {!query && activeSection === 'all' && pinnedItems.length > 0 && (
          <section className="mb-9">
            <div className="flex items-center justify-between gap-2 mb-3.5">
              <div className="flex items-center gap-2">
                <Star size={14} className="text-amber-500 fill-amber-500" />
                <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-slate-400">
                  Akses Cepat · Disematkan
                </p>
              </div>
              <span className="text-[11px] text-slate-400">Klik ikon bintang pada kartu untuk mengatur pintasan</span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              {pinnedItems.map(({ title, path, icon: Icon, tone }) => (
                <Link
                  key={`pinned-${path}`}
                  to={path}
                  className="liquid-nav group rounded-[1.7rem] p-4 flex items-center gap-3.5 transition-transform hover:-translate-y-0.5"
                >
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${toneClass[tone]}`}>
                    <Icon size={18} strokeWidth={1.9} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-semibold truncate">{title}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                      Buka <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Categorized Sections */}
        {filteredSections.length === 0 ? (
          <div className="liquid-nav rounded-[2rem] py-14 text-center text-sm text-slate-400">
            Tidak ada menu yang cocok dengan pencarian &ldquo;{query}&rdquo;.
          </div>
        ) : (
          <div className="space-y-9 md:space-y-12">
            {filteredSections.map((section, sectionIndex) => (
              <section key={section.eyebrow}>
                <div className="mb-4 md:mb-5">
                  <p className="text-[10px] uppercase tracking-[0.16em] font-medium text-slate-400">{section.eyebrow}</p>
                  <h2 className="text-xl md:text-2xl font-semibold tracking-[-0.025em] mt-1">{section.title}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{section.description}</p>
                </div>

                <div className="grid md:grid-cols-2 gap-4 md:gap-5">
                  {section.items.map(({ title, description, path, icon: Icon, tone }, index) => {
                    const isPinned = pinnedPaths.includes(path);
                    return (
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
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => togglePin(e, path)}
                                className={`w-8 h-8 rounded-xl flex items-center justify-center transition ${
                                  isPinned
                                    ? 'bg-amber-500/15 text-amber-500'
                                    : 'bg-white/40 dark:bg-white/[.04] text-slate-300 hover:text-amber-500'
                                }`}
                                title={isPinned ? 'Lepas dari akses cepat' : 'Sematkan ke akses cepat'}
                                aria-label={isPinned ? 'Lepas dari akses cepat' : 'Sematkan ke akses cepat'}
                              >
                                <Star size={14} className={isPinned ? 'fill-amber-500' : ''} />
                              </button>
                              <ArrowRight size={15} className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-1 transition-all" />
                            </div>
                          </div>
                          <h3 className="text-base md:text-lg font-semibold mt-5">{title}</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mt-2">{description}</p>
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
