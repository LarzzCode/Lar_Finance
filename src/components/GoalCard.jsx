import { motion } from 'framer-motion';

export default function GoalCard({ goal, onNabung, onEdit, onDelete }) {
  // Hitung Persentase
  const percentage = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
  
  // Format Rupiah
  const rupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

  // Pilihan Warna Gradient Berdasarkan Database
  const gradients = {
    blue: 'from-blue-500 to-indigo-600',
    pink: 'from-pink-500 to-rose-500',
    green: 'from-emerald-400 to-teal-500',
    orange: 'from-orange-400 to-amber-500',
    purple: 'from-violet-500 to-purple-600',
  };

  const bgGradient = gradients[goal.color] || gradients.blue;

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 relative overflow-hidden group"
    >
      {/* Background Hiasan Pudar */}
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${bgGradient} opacity-5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none`}></div>

      {/* Header Kartu */}
      <div className="flex justify-between items-start mb-4">
        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${bgGradient} flex items-center justify-center text-2xl shadow-lg shadow-gray-200 text-white`}>
          {goal.emoji}
        </div>
        <div className="flex gap-1">
            <button onClick={() => onEdit(goal)} className="p-2 text-gray-300 hover:text-indigo-500 transition-colors">✎</button>
            <button onClick={() => onDelete(goal.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors">✕</button>
        </div>
      </div>

      {/* Info Target */}
      <h3 className="font-bold text-gray-800 text-lg mb-1">{goal.name}</h3>
      <div className="flex justify-between text-xs font-semibold text-gray-400 mb-3">
        <span>Terkumpul: <span className="text-gray-600">{rupiah(goal.current_amount)}</span></span>
        <span>Target: {rupiah(goal.target_amount)}</span>
      </div>

      {/* PROGRESS BAR (INTI FITUR) */}
      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden mb-4 relative">
        <motion.div 
          className={`h-full bg-gradient-to-r ${bgGradient}`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>

      {/* Tombol Nabung */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => onNabung(goal)}
        className={`w-full py-3 rounded-xl font-bold text-white shadow-lg shadow-indigo-100 bg-gradient-to-r ${bgGradient} hover:shadow-xl transition-all flex items-center justify-center gap-2`}
      >
        <span>+ Nabung</span>
      </motion.button>
    </motion.div>
  );
}