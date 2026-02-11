import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { startOfMonth, endOfMonth, format, getWeekOfMonth, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { id } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export default function Rekapan() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pengeluaran');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // STATE BARU: Untuk Modal Edit/Hapus
  const [selectedTx, setSelectedTx] = useState(null); 
  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ amount: '', description: '' });

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const COLORS = ['#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'];

  useEffect(() => { fetchTransactions(); }, [currentDate]);

  const fetchTransactions = async () => {
    setLoading(true);
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd');

    const { data, error } = await supabase
      .from('transactions')
      .select('*, categories(name, type, icon)')
      .gte('transaction_date', start)
      .lte('transaction_date', end)
      .order('transaction_date', { ascending: false });

    if (!error) setTransactions(data || []);
    setLoading(false);
  };

  // --- LOGIKA AKSI (Edit & Hapus) ---
  const handleTxClick = (tx) => {
      setSelectedTx(tx);
      setIsEditMode(false);
      setEditForm({ amount: tx.amount, description: tx.description || '' });
  };

  const handleDelete = async () => {
      if(!confirm("Hapus transaksi ini permanen?")) return;
      try {
          const { error } = await supabase.from('transactions').delete().eq('id', selectedTx.id);
          if(error) throw error;
          toast.success("Transaksi dihapus");
          setSelectedTx(null);
          fetchTransactions();
      } catch(e) { toast.error(e.message); }
  };

  const handleUpdate = async (e) => {
      e.preventDefault();
      try {
          const { error } = await supabase.from('transactions').update({
              amount: editForm.amount,
              description: editForm.description
          }).eq('id', selectedTx.id);
          if(error) throw error;
          toast.success("Transaksi diperbarui");
          setSelectedTx(null);
          fetchTransactions();
      } catch(e) { toast.error(e.message); }
  };
  // ----------------------------------

  const rupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

  const changeMonth = (offset) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentDate(newDate);
  };

  const { totalIncome, totalExpense, chartData, categoryList, weeklyData } = useMemo(() => {
    let tInc = 0; let tExp = 0;
    const catGroups = {}; const weekGroups = {};

    transactions.forEach((tx) => {
      const amount = Number(tx.amount);
      const isIncome = tx.categories?.type === 'income';
      if (isIncome) tInc += amount; else tExp += amount;

      const matchesTab = (activeTab === 'pemasukan' && isIncome) || (activeTab === 'pengeluaran' && !isIncome);
      const query = searchQuery.toLowerCase();
      const desc = (tx.description || '').toLowerCase();
      const catName = (tx.categories?.name || 'Tanpa Kategori').toLowerCase();
      const matchesSearch = desc.includes(query) || catName.includes(query);

      if (matchesTab) {
        const key = tx.categories?.name || 'Lainnya';
        if (!catGroups[key]) catGroups[key] = { name: key, value: 0, icon: tx.categories?.icon || '📁' };
        catGroups[key].value += amount;
      }

      if (matchesTab && matchesSearch) {
          const date = parseISO(tx.transaction_date);
          const weekNum = getWeekOfMonth(date, { weekStartsOn: 1 });
          const startW = startOfWeek(date, { weekStartsOn: 1 });
          const endW = endOfWeek(date, { weekStartsOn: 1 });

          if (!weekGroups[weekNum]) weekGroups[weekNum] = { week: weekNum, total: 0, items: [], startDate: startW, endDate: endW };
          weekGroups[weekNum].total += amount;
          weekGroups[weekNum].items.push(tx);
      }
    });

    return {
      totalIncome: tInc, totalExpense: tExp,
      chartData: Object.values(catGroups).sort((a, b) => b.value - a.value),
      categoryList: Object.values(catGroups).sort((a, b) => b.value - a.value),
      weeklyData: Object.values(weekGroups).sort((a, b) => b.week - a.week)
    };
  }, [transactions, activeTab, searchQuery]);

  return (
    <div className="min-h-screen w-full bg-gray-50 font-sans text-gray-800 pb-24 pt-0 md:pt-28">
      
      {/* TOP BAR */}
      <div className="bg-white/90 backdrop-blur-md sticky top-0 z-20 shadow-sm border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-3">
            <div className="flex flex-col md:flex-row justify-between items-center gap-3">
                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
                    <h2 className="text-lg font-black text-gray-800">Laporan 📊</h2>
                    <div className="flex bg-gray-100 rounded-full p-1">
                        <button onClick={() => setActiveTab('pengeluaran')} className={`px-4 py-1.5 rounded-full text-[10px] font-bold transition-all ${activeTab === 'pengeluaran' ? 'bg-white shadow-sm text-rose-500' : 'text-gray-400'}`}>Pengeluaran</button>
                        <button onClick={() => setActiveTab('pemasukan')} className={`px-4 py-1.5 rounded-full text-[10px] font-bold transition-all ${activeTab === 'pemasukan' ? 'bg-white shadow-sm text-emerald-500' : 'text-gray-400'}`}>Pemasukan</button>
                    </div>
                </div>
                <div className="flex items-center bg-gray-50 p-1 rounded-xl border border-gray-200 w-full md:w-auto justify-between md:justify-center">
                    <button onClick={() => changeMonth(-1)} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm hover:bg-gray-100">‹</button>
                    <span className="px-4 text-xs font-black text-gray-700 w-28 text-center uppercase tracking-tight">{format(currentDate, 'MMM yyyy', { locale: id })}</span>
                    <button onClick={() => changeMonth(1)} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm hover:bg-gray-100">›</button>
                </div>
            </div>
          </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* KIRI: Chart */}
            <div className="lg:col-span-4 space-y-4 h-fit lg:sticky lg:top-36">
                <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col items-center relative">
                    {chartData.length === 0 ? ( <div className="py-10 text-center text-gray-400 text-xs font-medium">Belum ada data 😴</div> ) : (
                        <div className="w-full h-[200px] md:h-[230px] relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={chartData} innerRadius={isMobile ? 55 : 65} outerRadius={isMobile ? 75 : 85} paddingAngle={5} dataKey="value" cornerRadius={6}>
                                        {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />)}
                                    </Pie>
                                    <Tooltip formatter={(v) => rupiah(v)} contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '12px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <p className="text-[9px] font-bold text-gray-400 uppercase">Total {activeTab}</p>
                                <p className={`text-base md:text-lg font-black ${activeTab === 'pemasukan' ? 'text-emerald-600' : 'text-rose-600'}`}>{rupiah(activeTab === 'pemasukan' ? totalIncome : totalExpense)}</p>
                            </div>
                        </div>
                    )}
                </div>
                {/* Top Category List */}
                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Top Kategori</h3>
                    <div className="space-y-3">
                        {categoryList.slice(0, 5).map((cat, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                                    <span className="font-bold text-gray-700">{cat.name}</span>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-gray-800">{rupiah(cat.value)}</p>
                                    <p className="text-[9px] text-gray-400 font-medium">{((cat.value / (activeTab === 'pemasukan' ? totalIncome : totalExpense)) * 100).toFixed(0)}%</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* KANAN: List Mingguan (DENGAN KLIK HANDLER) */}
            <div className="lg:col-span-8 space-y-4">
                <div className="bg-white p-1 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-2">
                    <div className="w-10 h-10 flex items-center justify-center text-gray-400">🔍</div>
                    <input type="text" placeholder={`Cari transaksi ${activeTab}...`} className="flex-1 bg-transparent outline-none text-xs font-bold text-gray-700 placeholder-gray-400 h-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>

                {weeklyData.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-gray-200">
                        <p className="text-gray-400 text-xs font-medium">Tidak ada transaksi ditemukan.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {weeklyData.map((week, wIdx) => (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: wIdx * 0.05 }} key={week.week} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                                <div className="bg-gray-50/50 px-5 py-3 border-b border-gray-100 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-gray-800 text-white w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[10px]">W{week.week}</div>
                                        <div>
                                            <h4 className="font-black text-gray-800 text-xs">Minggu {week.week}</h4>
                                            <p className="text-[9px] text-gray-400 font-bold uppercase">{format(week.startDate, 'dd MMM')} - {format(week.endDate, 'dd MMM')}</p>
                                        </div>
                                    </div>
                                    <p className={`font-black text-xs ${activeTab === 'pemasukan' ? 'text-emerald-600' : 'text-rose-600'}`}>{rupiah(week.total)}</p>
                                </div>
                                <div className="divide-y divide-gray-50">
                                    {week.items.map((tx) => (
                                        <div 
                                            key={tx.id} 
                                            onClick={() => handleTxClick(tx)} // HANDLE KLIK DISINI
                                            className="p-3 hover:bg-gray-50 transition-colors flex justify-between items-center group cursor-pointer active:bg-gray-100"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-sm group-hover:scale-110 transition-transform">
                                                    {tx.categories?.icon || '📁'}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-gray-800 truncate max-w-[110px] md:max-w-xs">{tx.description || tx.categories?.name}</p>
                                                    <p className="text-[9px] text-gray-400 font-medium uppercase">{format(parseISO(tx.transaction_date), 'dd MMM')} • {tx.categories?.name}</p>
                                                </div>
                                            </div>
                                            <p className={`text-xs font-bold ${activeTab === 'pemasukan' ? 'text-emerald-600' : 'text-gray-800'}`}>{rupiah(tx.amount)}</p>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* MODAL EDIT / HAPUS */}
      <AnimatePresence>
          {selectedTx && (
              <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
                  {/* Backdrop */}
                  <motion.div 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedTx(null)} 
                  />
                  
                  {/* Card Modal */}
                  <motion.div 
                      initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
                      className="bg-white w-full md:max-w-sm rounded-t-[2rem] md:rounded-[2rem] p-6 relative z-10 shadow-2xl"
                  >
                      <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-6"></div>

                      {!isEditMode ? (
                          <>
                              <div className="text-center mb-6">
                                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-3xl mx-auto mb-3">
                                      {selectedTx.categories?.icon || '📄'}
                                  </div>
                                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{selectedTx.categories?.name}</p>
                                  <h3 className="text-2xl font-black text-gray-800 mt-1">{rupiah(selectedTx.amount)}</h3>
                                  <p className="text-sm font-bold text-gray-500 mt-1">{selectedTx.description}</p>
                                  <p className="text-xs text-gray-400 mt-2">{format(parseISO(selectedTx.transaction_date), 'dd MMMM yyyy', { locale: id })}</p>
                              </div>

                              <div className="flex gap-3">
                                  <button onClick={() => setIsEditMode(true)} className="flex-1 py-3 bg-indigo-50 text-indigo-600 font-bold rounded-xl hover:bg-indigo-100">Edit</button>
                                  <button onClick={handleDelete} className="flex-1 py-3 bg-rose-50 text-rose-600 font-bold rounded-xl hover:bg-rose-100">Hapus</button>
                              </div>
                          </>
                      ) : (
                          <form onSubmit={handleUpdate} className="space-y-4">
                              <h3 className="text-lg font-black text-gray-800 text-center mb-4">Edit Transaksi</h3>
                              <div>
                                  <label className="text-[10px] font-bold text-gray-400 uppercase">Nominal</label>
                                  <input type="number" value={editForm.amount} onChange={e=>setEditForm({...editForm, amount: e.target.value})} className="w-full mt-1 p-3 bg-gray-50 rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-100" />
                              </div>
                              <div>
                                  <label className="text-[10px] font-bold text-gray-400 uppercase">Deskripsi</label>
                                  <input type="text" value={editForm.description} onChange={e=>setEditForm({...editForm, description: e.target.value})} className="w-full mt-1 p-3 bg-gray-50 rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-100" />
                              </div>
                              <div className="flex gap-3 pt-2">
                                  <button type="button" onClick={() => setIsEditMode(false)} className="flex-1 py-3 bg-gray-100 font-bold text-gray-500 rounded-xl">Batal</button>
                                  <button type="submit" className="flex-1 py-3 bg-indigo-600 font-bold text-white rounded-xl">Simpan</button>
                              </div>
                          </form>
                      )}
                  </motion.div>
              </div>
          )}
      </AnimatePresence>

    </div>
  );
}