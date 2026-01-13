import { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AiInsight({ transactions }) {
  // STATE
  const [isMobileOpen, setIsMobileOpen] = useState(true); 
  const [isDesktopHovered, setIsDesktopHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [side, setSide] = useState('right'); 
  const constraintsRef = useRef(null);

  // 1. AUTO-HIDE MOBILE
  useEffect(() => {
    let timer;
    if (isMobileOpen) {
      timer = setTimeout(() => {
        setIsMobileOpen(false);
      }, 5000);
    }
    return () => clearTimeout(timer);
  }, [isMobileOpen]);

  // 2. DETEKSI SISI (Kanan/Kiri)
  const handleDragEnd = (event, info) => {
    setTimeout(() => setIsDragging(false), 100);
    if (info.point.x < window.innerWidth / 2) {
      setSide('left');
    } else {
      setSide('right');
    }
  };

 // 3. OTAK AI
  const insight = useMemo(() => {
    // Cek Data Kosong
    if (!transactions || transactions.length === 0) {
      return {
        title: 'Data Kosong',
        message: 'Yuk mulai catat transaksimu hari ini!',
        icon: '👋',
        color: 'from-gray-500 to-gray-600',
        textColor: 'text-gray-600',
        ring: 'ring-gray-200'
      };
    }

    let income = 0;
    let expense = 0;
    let todayExpense = 0;

    // Ambil Tanggal Hari Ini (Local Time YYYY-MM-DD)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    const expenseCategories = {};

    transactions.forEach(t => {
      const amount = Number(t.amount);
      const isExpense = t.categories?.type === 'expense';
      
      // Ambil tanggal transaksi (10 digit pertama: YYYY-MM-DD)
      const rawDate = t.transaction_date || ''; 
      const txDate = rawDate.substring(0, 10); 

      if (!isExpense) income += amount;
      else {
        expense += amount;
        const catName = t.categories?.name || 'Lainnya';
        expenseCategories[catName] = (expenseCategories[catName] || 0) + amount;
        
        // Cek Limit Harian
        if (txDate === todayStr) {
          todayExpense += amount;
        }
      }
    });

    const balance = income - expense;
    const expenseRatio = income > 0 ? (expense / income) * 100 : 0;
    
    let topCategory = '', topCategoryAmount = 0;
    Object.entries(expenseCategories).forEach(([cat, amount]) => {
      if (amount > topCategoryAmount) {
        topCategoryAmount = amount;
        topCategory = cat;
      }
    });

    // --- RULES ENGINE ---

    // 1. LIMIT 50RB (DANGER) - Prioritas Utama
    if (todayExpense > 50000) {
        return {
            title: 'Limit Harian Jebol BOSS!',
            message: `Hari ini habis Rp ${new Intl.NumberFormat('id-ID').format(todayExpense)}. Stop jajan!`,
            icon: '🔥',
            color: 'from-red-600 to-rose-700',
            textColor: 'text-red-700',
            ring: 'ring-red-300'
        };
    }

    // 2. LIMIT 30RB (WARNING)
    if (todayExpense > 30000) {
        return {
            title: 'Waduh hati-hati boss harian menipis',
            message: `Hari ini terpakai Rp ${new Intl.NumberFormat('id-ID').format(todayExpense)}. Hemat ya!`,
            icon: '🤔',
            color: 'from-orange-400 to-amber-500',
            textColor: 'text-orange-600',
            ring: 'ring-orange-200'
        };
    }

    // 3. LOGIKA BULANAN
    if (expense > income && income > 0) return {
      title: 'Zona Bahaya!', message: `Defisit Rp ${new Intl.NumberFormat('id-ID').format(Math.abs(balance))}.`,
      icon: '🚨', color: 'from-red-500 to-rose-600', textColor: 'text-red-600', ring: 'ring-red-200'
    };
    if (topCategory && (topCategoryAmount / expense) > 0.4 && expense > 0) return {
      title: 'Pola Boros', message: `Kamu sering jajan "${topCategory}". Kurangi ya!`,
      icon: '🧐', color: 'from-orange-400 to-pink-500', textColor: 'text-orange-600', ring: 'ring-orange-200'
    };
    if (expenseRatio > 80) return {
      title: 'Hati-hati', message: '80% gaji terpakai. Hemat mode on!',
      icon: '⚠️', color: 'from-amber-400 to-orange-500', textColor: 'text-amber-600', ring: 'ring-amber-200'
    };
    if (expenseRatio < 50 && income > 0) return {
      title: 'Keuangan Prima', message: 'Pengeluaran < 50%. Mantap!',
      icon: '💎', color: 'from-emerald-400 to-teal-500', textColor: 'text-emerald-600', ring: 'ring-emerald-200'
    };
    
    return {
      title: 'Amann boss', message: 'Arus kas sehat. Pertahankan!',
      icon: '✨', color: 'from-blue-500 to-indigo-600', textColor: 'text-blue-600', ring: 'ring-blue-200'
    };

  }, [transactions]);

  const handleMobileClick = () => {
    if (!isDragging) setIsMobileOpen(!isMobileOpen);
  };

  return (
    <>
      <div ref={constraintsRef} className="fixed inset-0 pointer-events-none z-[90]" />

      {/* MOBILE (DRAGGABLE) */}
      <motion.div 
        drag dragConstraints={constraintsRef} dragElastic={0.1} dragMomentum={false}
        onDragStart={() => setIsDragging(true)} onDragEnd={handleDragEnd}
        className="md:hidden fixed top-24 right-5 z-[101] flex flex-col justify-center cursor-move touch-none"
      >
        <div className={`relative flex items-center ${side === 'left' ? 'flex-row' : 'flex-row-reverse'}`}>
          <motion.button
            whileTap={{ scale: 0.9 }} onClick={handleMobileClick}
            className={`w-12 h-12 rounded-full bg-gradient-to-br ${insight.color} flex items-center justify-center text-2xl shadow-lg shadow-gray-400/40 border-2 border-white ring-2 ${insight.ring} pointer-events-auto z-20`}
          >
            {insight.icon}
          </motion.button>
          <AnimatePresence>
            {isMobileOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, x: side === 'left' ? -20 : 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: side === 'left' ? -20 : 20 }}
                className={`bg-white/95 backdrop-blur-md p-3 rounded-2xl shadow-xl border border-gray-100 max-w-[160px] pointer-events-auto z-10 ${side === 'left' ? 'ml-3' : 'mr-3'}`}
              >
                 <div className="flex justify-between items-start">
                    <div>
                        <p className={`text-[10px] font-bold ${insight.textColor} uppercase mb-0.5`}>{insight.title}</p>
                        <p className="text-[11px] text-gray-600 leading-tight">{insight.message}</p>
                    </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* DESKTOP (HOVER) */}
      <motion.div 
        drag dragConstraints={constraintsRef} dragMomentum={false}
        onDragStart={() => setIsDragging(true)} onDragEnd={handleDragEnd}
        onMouseEnter={() => !isDragging && setIsDesktopHovered(true)} onMouseLeave={() => setIsDesktopHovered(false)}
        className="hidden md:flex fixed top-32 right-8 z-[101] flex-col justify-center cursor-move"
      >
        <div className="relative flex items-center">
            <AnimatePresence>
                {isDesktopHovered && !isDragging && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, x: side === 'left' ? 20 : -20 }}
                        animate={{ opacity: 1, scale: 1, x: side === 'left' ? 16 : -16 }}
                        exit={{ opacity: 0, scale: 0.9, x: side === 'left' ? 10 : -10 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        className={`absolute w-64 bg-white/90 backdrop-blur-xl p-4 rounded-2xl shadow-2xl border border-white/50 pointer-events-none ${side === 'left' ? 'left-full ml-2 origin-left' : 'right-full mr-2 origin-right'}`}
                    >
                         <div className="flex items-center gap-2 mb-2 border-b border-gray-100 pb-2">
                            <span className="text-xl">{insight.icon}</span>
                            <h3 className={`font-bold text-sm ${insight.textColor}`}>{insight.title}</h3>
                         </div>
                         <p className="text-xs text-gray-600 leading-relaxed font-medium">{insight.message}</p>
                         <div className={`absolute top-1/2 w-3 h-3 bg-white rotate-45 transform -translate-y-1/2 ${side === 'left' ? '-left-1.5' : '-right-1.5'}`}></div>
                    </motion.div>
                )}
            </AnimatePresence>
            <motion.div
                animate={isDesktopHovered && !isDragging ? { scale: 1.1 } : { scale: 1 }}
                className={`w-14 h-14 rounded-full bg-gradient-to-br ${insight.color} flex items-center justify-center text-3xl shadow-2xl shadow-indigo-500/20 border-4 border-white cursor-pointer ring-4 ${insight.ring} ring-opacity-50`}
            >
                {insight.icon}
            </motion.div>
        </div>
      </motion.div>
    </>
  );
}