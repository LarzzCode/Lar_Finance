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

  const [availableCategories, setAvailableCategories] = useState([]);
  const [availableWallets, setAvailableWallets] = useState([]);

  const [selectedTx, setSelectedTx] = useState(null); 
  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ amount: '', description: '', date: '', category_id: '', wallet_id: '' });

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const COLORS = ['#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'];

  useEffect(() => { fetchTransactions(); fetchDropdownData(); }, [currentDate]);

  const fetchDropdownData = async () => {
      const { data: cats } = await supabase.from('categories').select('*').order('name');
      const { data: walls } = await supabase.from('wallets').select('*').order('name');
      setAvailableCategories(cats || []);
      setAvailableWallets(walls || []);
  };

  const fetchTransactions = async () => {
    setLoading(true);
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd');
    
    const { data, error } = await supabase
      .from('transactions')
      .select('*, categories(name, type), wallets(name)')
      .gte('transaction_date', start)
      .lte('transaction_date', end)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error) setTransactions(data || []);
    setLoading(false);
  };

  const handleTxClick = (tx) => {
      setSelectedTx(tx);
      setIsEditMode(false);
      setEditForm({ 
          amount: tx.amount, 
          description: tx.description || '',
          date: tx.transaction_date,
          category_id: tx.category_id,
          wallet_id: tx.wallet_id
      });
  };

  const handleDelete = async () => {
      if(!confirm("Hapus transaksi ini permanen?")) return;
      try {
          const { error } = await supabase.from('transactions').delete().eq('id', selectedTx.id);
          if(error) throw error;
          toast.success("Dihapus"); setSelectedTx(null); fetchTransactions();
      } catch(e) { toast.error(e.message); }
  };

  const handleUpdate = async (e) => {
      e.preventDefault();
      try {
          const selectedWallet = availableWallets.find(w => w.id === editForm.wallet_id);
          const walletName = selectedWallet ? selectedWallet.name : 'Manual';

          const { error } = await supabase.from('transactions').update({
              amount: editForm.amount,
              description: editForm.description,
              transaction_date: editForm.date,
              category_id: editForm.category_id,
              wallet_id: editForm.wallet_id,
              payment_method: walletName
          }).eq('id', selectedTx.id);

          if(error) throw error;
          toast.success("Diperbarui"); setSelectedTx(null); fetchTransactions();
      } catch(e) { toast.error(e.message); }
  };

  const rupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
  const changeMonth = (offset) => { const newDate = new Date(currentDate); newDate.setMonth(newDate.getMonth() + offset); setCurrentDate(newDate); };

  const { totalIncome, totalExpense, chartData, categoryList, weeklyData } = useMemo(() => {
    let tInc = 0; let tExp = 0; const catGroups = {}; const weekGroups = {};
    transactions.forEach((tx) => {
      const amount = Number(tx.amount); const isIncome = tx.categories?.type === 'income';
      if (isIncome) tInc += amount; else tExp += amount;
      const matchesTab = (activeTab === 'pemasukan' && isIncome) || (activeTab === 'pengeluaran' && !isIncome);
      const query = searchQuery.toLowerCase();
      const desc = (tx.description || '').toLowerCase(); const catName = (tx.categories?.name || '').toLowerCase();
      
      if (matchesTab) {
        const key = tx.categories?.name || 'Lainnya';
        if (!catGroups[key]) catGroups[key] = { name: key, value: 0 };
        catGroups[key].value += amount;
      }
      
      if (matchesTab && (desc.includes(query) || catName.includes(query))) {
          const date = parseISO(tx.transaction_date); const weekNum = getWeekOfMonth(date, { weekStartsOn: 1 });
          const startW = startOfWeek(date, { weekStartsOn: 1 }); const endW = endOfWeek(date, { weekStartsOn: 1 });
          if (!weekGroups[weekNum]) weekGroups[weekNum] = { week: weekNum, total: 0, items: [], startDate: startW, endDate: endW };
          weekGroups[weekNum].total += amount; weekGroups[weekNum].items.push(tx);
      }
    });
    return { 
        totalIncome: tInc, 
        totalExpense: tExp, 
        chartData: Object.values(catGroups).sort((a, b) => b.value - a.value), 
        categoryList: Object.values(catGroups).sort((a, b) => b.value - a.value), 
        weeklyData: Object.values(weekGroups).sort((a, b) => b.week - a.week) 
    };
  }, [transactions, activeTab, searchQuery]);

  return (
    <div className="min-h-screen w-full bg-gray-50 font-sans text-gray-800 pb-24 pt-0 md:pt-28">
      
      {/* TOP BAR */}
      <div className="bg-white/90 backdrop-blur-md sticky top-0 z-20 shadow-sm border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
                    <h2 className="text-lg font-black text-gray-800">Laporan</h2>
                    <div className="flex bg-gray-100 rounded-full p-1">
                        <button onClick={() => setActiveTab('pengeluaran')} className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${activeTab === 'pengeluaran' ? 'bg-white shadow-sm text-rose-600' : 'text-gray-400'}`}>Pengeluaran</button>
                        <button onClick={() => setActiveTab('pemasukan')} className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${activeTab === 'pemasukan' ? 'bg-white shadow-sm text-emerald-600' : 'text-gray-400'}`}>Pemasukan</button>
                    </div>
                </div>
                <div className="flex items-center bg-gray-50 p-1 rounded-xl border border-gray-200 w-full md:w-auto justify-between md:justify-center">
                    <button onClick={() => changeMonth(-1)} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm hover:bg-gray-100 text-gray-600 font-bold">‹</button>
                    <span className="px-4 text-xs font-black text-gray-700 w-28 text-center uppercase tracking-tight">{format(currentDate, 'MMM yyyy', { locale: id })}</span>
                    <button onClick={() => changeMonth(1)} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm hover:bg-gray-100 text-gray-600 font-bold">›</button>
                </div>
            </div>
          </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* KIRI */}
            <div className="lg:col-span-4 space-y-6 h-fit lg:sticky lg:top-36">
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col items-center relative">
                    {chartData.length === 0 ? ( <div className="py-12 text-center text-gray-400 text-xs font-medium">Data kosong</div> ) : (
                        <div className="w-full h-[220px] relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={chartData} innerRadius={isMobile ? 55 : 65} outerRadius={isMobile ? 75 : 85} paddingAngle={5} dataKey="value" cornerRadius={4}>
                                        {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />)}
                                    </Pie>
                                    <Tooltip formatter={(v) => rupiah(v)} contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '12px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total</p>
                                <p className={`text-lg font-black ${activeTab === 'pemasukan' ? 'text-emerald-600' : 'text-rose-600'}`}>{rupiah(activeTab === 'pemasukan' ? totalIncome : totalExpense)}</p>
                            </div>
                        </div>
                    )}
                </div>
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-5">Rincian Kategori</h3>
                    <div className="space-y-4">
                        {categoryList.slice(0, 5).map((cat, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-3">
                                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                                    <span className="font-bold text-gray-700">{cat.name}</span>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-gray-800">{rupiah(cat.value)}</p>
                                    <p className="text-[9px] text-gray-400 font-medium mt-0.5">{((cat.value / (activeTab === 'pemasukan' ? totalIncome : totalExpense)) * 100).toFixed(0)}%</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* KANAN */}
            <div className="lg:col-span-8 space-y-6">
                <div className="bg-white p-1 rounded-2xl border border-gray-200 shadow-sm flex items-center px-4">
                    <input type="text" placeholder="Cari transaksi..." className="flex-1 bg-transparent outline-none text-sm font-medium text-gray-700 placeholder-gray-400 h-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
                {weeklyData.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200"><p className="text-gray-400 text-xs font-medium">Tidak ada data.</p></div>
                ) : (
                    <div className="space-y-6">
                        {weeklyData.map((week, wIdx) => (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: wIdx * 0.05 }} key={week.week} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                                <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                                    <div>
                                        <h4 className="font-black text-gray-800 text-xs uppercase tracking-wide">Minggu {week.week}</h4>
                                        <p className="text-[10px] text-gray-400 font-bold mt-1">{format(week.startDate, 'dd MMM')} - {format(week.endDate, 'dd MMM')}</p>
                                    </div>
                                    <p className={`font-black text-xs ${activeTab === 'pemasukan' ? 'text-emerald-600' : 'text-rose-600'}`}>{rupiah(week.total)}</p>
                                </div>
                                <div className="divide-y divide-gray-50">
                                    {week.items.map((tx) => (
                                        <div key={tx.id} onClick={() => handleTxClick(tx)} className="p-4 hover:bg-gray-50 transition-colors flex justify-between items-center cursor-pointer group">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black uppercase ${activeTab === 'pemasukan' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                                                    {tx.categories?.name ? tx.categories.name.charAt(0) : '?'}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-gray-800 truncate max-w-[150px]">{tx.description || tx.categories?.name}</p>
                                                    
                                                    {/* KETERANGAN LENGKAP: TANGGAL - DOMPET - KATEGORI */}
                                                    <div className="flex items-center gap-1.5 mt-0.5 overflow-hidden">
                                                        <span className="text-[10px] text-gray-400 font-bold uppercase whitespace-nowrap">
                                                            {format(parseISO(tx.transaction_date), 'dd MMM')}
                                                        </span>
                                                        <span className="text-[10px] text-gray-300">•</span>
                                                        
                                                        <span className="text-[10px] text-indigo-500 font-bold uppercase bg-indigo-50 px-1.5 py-0.5 rounded whitespace-nowrap">
                                                            {tx.wallets?.name || tx.payment_method || 'Manual'}
                                                        </span>
                                                        <span className="text-[10px] text-gray-300">•</span>

                                                        <span className="text-[10px] text-gray-500 font-bold uppercase truncate">
                                                            {tx.categories?.name}
                                                        </span>
                                                    </div>

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

      {/* MODAL EDIT */}
      <AnimatePresence>
          {selectedTx && (
              <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedTx(null)} />
                  <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="bg-white w-full md:max-w-md rounded-t-[2rem] md:rounded-[2rem] p-8 relative z-10 shadow-2xl max-h-[90vh] overflow-y-auto">
                      <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-8"></div>
                      {!isEditMode ? (
                          <>
                              <div className="text-center mb-8">
                                  <div className={`w-16 h-16 mx-auto rounded-3xl flex items-center justify-center text-2xl font-black uppercase mb-4 ${selectedTx.categories?.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                                      {selectedTx.categories?.name?.charAt(0)}
                                  </div>
                                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{selectedTx.categories?.name}</p>
                                  <h3 className="text-3xl font-black text-gray-800 mb-2">{rupiah(selectedTx.amount)}</h3>
                                  <p className="text-sm font-medium text-gray-600 mb-4">{selectedTx.description}</p>
                                  <div className="flex justify-center gap-2">
                                    <span className="px-3 py-1 bg-gray-100 rounded-lg text-xs font-bold text-gray-500 uppercase">📅 {format(parseISO(selectedTx.transaction_date), 'dd MMM yyyy', { locale: id })}</span>
                                    <span className="px-3 py-1 bg-indigo-50 rounded-lg text-xs font-bold text-indigo-600 uppercase">💳 {selectedTx.wallets?.name || selectedTx.payment_method}</span>
                                  </div>
                              </div>
                              <div className="flex gap-4">
                                  <button onClick={() => setIsEditMode(true)} className="flex-1 py-4 bg-gray-50 text-gray-600 font-bold rounded-2xl hover:bg-gray-100">Edit</button>
                                  <button onClick={handleDelete} className="flex-1 py-4 bg-rose-50 text-rose-600 font-bold rounded-2xl hover:bg-rose-100">Hapus</button>
                              </div>
                          </>
                      ) : (
                          <form onSubmit={handleUpdate} className="space-y-5">
                              <h3 className="text-lg font-black text-gray-800 text-center mb-6">Edit Transaksi</h3>
                              <div className="grid grid-cols-2 gap-4">
                                  <div><label className="text-[10px] font-bold text-gray-400 uppercase">Nominal</label><input type="number" required value={editForm.amount} onChange={e=>setEditForm({...editForm, amount: e.target.value})} className="w-full mt-1 p-3 bg-gray-50 rounded-xl font-bold outline-none text-sm" /></div>
                                  <div><label className="text-[10px] font-bold text-gray-400 uppercase">Tanggal</label><input type="date" required value={editForm.date} onChange={e=>setEditForm({...editForm, date: e.target.value})} className="w-full mt-1 p-3 bg-gray-50 rounded-xl font-bold outline-none text-sm" /></div>
                              </div>
                              <div><label className="text-[10px] font-bold text-gray-400 uppercase">Kategori</label><select value={editForm.category_id} onChange={e=>setEditForm({...editForm, category_id: e.target.value})} className="w-full mt-1 p-3 bg-gray-50 rounded-xl font-bold outline-none text-sm">{availableCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                              <div><label className="text-[10px] font-bold text-gray-400 uppercase">Sumber Dana</label><select value={editForm.wallet_id || ''} onChange={e=>setEditForm({...editForm, wallet_id: e.target.value})} className="w-full mt-1 p-3 bg-gray-50 rounded-xl font-bold outline-none text-sm">{availableWallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
                              <div><label className="text-[10px] font-bold text-gray-400 uppercase">Deskripsi</label><input type="text" value={editForm.description} onChange={e=>setEditForm({...editForm, description: e.target.value})} className="w-full mt-1 p-3 bg-gray-50 rounded-xl font-bold outline-none text-sm" /></div>
                              <div className="flex gap-4 pt-4"><button type="button" onClick={() => setIsEditMode(false)} className="flex-1 py-4 bg-gray-100 font-bold text-gray-500 rounded-2xl">Batal</button><button type="submit" className="flex-1 py-4 bg-indigo-600 font-bold text-white rounded-2xl shadow-lg">Simpan</button></div>
                          </form>
                      )}
                  </motion.div>
              </div>
          )}
      </AnimatePresence>
    </div>
  );
}