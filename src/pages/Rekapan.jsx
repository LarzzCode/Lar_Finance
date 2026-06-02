import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { startOfMonth, endOfMonth, format, getWeekOfMonth, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { id } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import * as icons from 'lucide-react'; 

// --- KOMPONEN PENAFSIR IKON DINAMIS ---
const DynamicIcon = ({ name, size = 20, className = "" }) => {
  const LucideIcon = icons[name] || icons['HelpCircle'];
  if (!LucideIcon) return null;
  return <LucideIcon size={size} className={className} />;
};

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
      .select('*, categories(name, type, icon), wallets(name)')
      .gte('transaction_date', start)
      .lte('transaction_date', end)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error) setTransactions(data || []);
    setLoading(false);
  };

  const rupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
  const changeMonth = (offset) => { const newDate = new Date(currentDate); newDate.setMonth(newDate.getMonth() + offset); setCurrentDate(newDate); };

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
          toast.success("Data Dihapus"); setSelectedTx(null); fetchTransactions();
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
          toast.success("Data Diperbarui"); setSelectedTx(null); fetchTransactions();
      } catch(e) { toast.error(e.message); }
  };

  const handleExportExcel = () => {
    if (transactions.length === 0) {
        toast.error("Belum ada data di bulan ini");
        return;
    }

    const tInc = transactions.filter(t => t.categories?.type === 'income').reduce((acc, curr) => acc + Number(curr.amount), 0);
    const tExp = transactions.filter(t => t.categories?.type === 'expense').reduce((acc, curr) => acc + Number(curr.amount), 0);

    const titleRows = [
        ['LAPORAN KEUANGAN BULANAN'],
        [`Periode: ${format(currentDate, 'MMMM yyyy', { locale: id }).toUpperCase()}`],
        [],
        ['RINGKASAN'],
        ['Total Pemasukan', '', rupiah(tInc)],
        ['Total Pengeluaran', '', rupiah(tExp)],
        ['Saldo Bersih', '', rupiah(tInc - tExp)],
        [],
        ['RINCIAN TRANSAKSI'],
        ['Tanggal', 'Kategori', 'Sumber Dana', 'Deskripsi', 'Nominal', 'Arus Kas']
    ];

    const dataRows = transactions.map((tx) => [
        format(parseISO(tx.transaction_date), 'dd MMM yyyy', { locale: id }),
        tx.categories?.name || 'Lainnya',
        tx.wallets?.name || tx.payment_method || 'Manual',
        tx.description || '-',
        rupiah(Number(tx.amount)),
        tx.categories?.type === 'income' ? 'Pemasukan (+)' : 'Pengeluaran (-)'
    ]);

    const ws = XLSX.utils.aoa_to_sheet([...titleRows, ...dataRows]);

    ws['!cols'] = [
        { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 40 }, { wch: 20 }, { wch: 15 } 
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan");
    
    const fileName = `Laporan_Keuangan_${format(currentDate, 'MMM_yyyy', { locale: id })}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success("Excel Aesthetic Diunduh! 📄✨");
  };

  const { totalIncome, totalExpense, chartData, categoryList, weeklyData, todayTotal } = useMemo(() => {
    let tInc = 0; let tExp = 0; let tToday = 0;
    const catGroups = {}; const weekGroups = {};
    const actualTodayStr = format(new Date(), 'yyyy-MM-dd');

    transactions.forEach((tx) => {
      const amount = Number(tx.amount); const isIncome = tx.categories?.type === 'income';
      if (isIncome) tInc += amount; else tExp += amount;
      const matchesTab = (activeTab === 'pemasukan' && isIncome) || (activeTab === 'pengeluaran' && !isIncome);
      const query = searchQuery.toLowerCase();
      const desc = (tx.description || '').toLowerCase(); const catName = (tx.categories?.name || '').toLowerCase();
      
      if (matchesTab) {
        if (tx.transaction_date === actualTodayStr) tToday += amount;

        const key = tx.categories?.name || 'Lainnya';
        if (!catGroups[key]) catGroups[key] = { name: key, value: 0 };
        catGroups[key].value += amount;
      }
      
      if (matchesTab && (desc.includes(query) || catName.includes(query))) {
          const date = parseISO(tx.transaction_date); 
          const weekNum = getWeekOfMonth(date, { weekStartsOn: 5 });
          const startW = startOfWeek(date, { weekStartsOn: 5 }); 
          const endW = endOfWeek(date, { weekStartsOn: 5 });
          
          if (!weekGroups[weekNum]) weekGroups[weekNum] = { week: weekNum, total: 0, items: [], startDate: startW, endDate: endW };
          weekGroups[weekNum].total += amount; weekGroups[weekNum].items.push(tx);
      }
    });
    return { 
        totalIncome: tInc, 
        totalExpense: tExp, 
        todayTotal: tToday,
        chartData: Object.values(catGroups).sort((a, b) => b.value - a.value), 
        categoryList: Object.values(catGroups).sort((a, b) => b.value - a.value), 
        weeklyData: Object.values(weekGroups).sort((a, b) => b.week - a.week) 
    };
  }, [transactions, activeTab, searchQuery]);

  return (
    <div className="min-h-screen w-full bg-[#FAFAFA] font-sans text-gray-800 pb-24 pt-0 md:pt-28">
      
      {/* TOP BAR - Glassmorphism Aesthetic */}
      <div className="bg-white/80 backdrop-blur-xl sticky top-0 z-20 border-b border-gray-100/50 shadow-[0_4px_30px_rgba(0,0,0,0.03)]">
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                
                {/* Header Title & Tabs */}
                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
                    <h2 className="text-xl font-black text-gray-900 tracking-tight">Laporan</h2>
                    <div className="flex bg-gray-100/80 p-1.5 rounded-2xl border border-gray-100">
                        <button onClick={() => setActiveTab('pengeluaran')} className={`px-5 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${activeTab === 'pengeluaran' ? 'bg-white shadow-[0_2px_10px_rgba(0,0,0,0.05)] text-rose-500' : 'text-gray-400 hover:text-gray-600'}`}>Pengeluaran</button>
                        <button onClick={() => setActiveTab('pemasukan')} className={`px-5 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${activeTab === 'pemasukan' ? 'bg-white shadow-[0_2px_10px_rgba(0,0,0,0.05)] text-emerald-500' : 'text-gray-400 hover:text-gray-600'}`}>Pemasukan</button>
                    </div>
                </div>
                
                {/* Controls: Export & Month Selector */}
                <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                    
                    <button 
                        onClick={handleExportExcel} 
                        className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest shadow-sm hover:shadow-md hover:border-gray-300 transition-all active:scale-95 group"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-400 group-hover:text-emerald-500 transition-colors">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        Excel
                    </button>

                    <div className="flex items-center bg-white p-1 rounded-2xl border border-gray-200 shadow-sm">
                        <button onClick={() => changeMonth(-1)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-50 text-gray-400 hover:text-gray-800 transition-colors">‹</button>
                        <span className="px-4 text-xs font-black text-gray-800 w-28 text-center uppercase tracking-wide">{format(currentDate, 'MMM yyyy', { locale: id })}</span>
                        <button onClick={() => changeMonth(1)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-50 text-gray-400 hover:text-gray-800 transition-colors">›</button>
                    </div>
                </div>

            </div>
          </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* KIRI */}
            <div className="lg:col-span-4 space-y-6 h-fit lg:sticky lg:top-36">
                
                {/* KARTU RINGKASAN HARI INI */}
                <motion.div 
                    initial={{ opacity: 0, y: -10 }} 
                    animate={{ opacity: 1, y: 0 }}
                    key={activeTab}
                    className={`relative p-7 rounded-[2rem] border shadow-[0_8px_30px_rgba(0,0,0,0.02)] transition-all duration-500 overflow-hidden ${
                        activeTab === 'pemasukan' 
                        ? 'bg-emerald-50/50 border-emerald-100/50' 
                        : 'bg-rose-50/50 border-rose-100/50'
                    }`}
                >
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="relative flex h-2.5 w-2.5">
                              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${activeTab === 'pemasukan' ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${activeTab === 'pemasukan' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                            </span>
                            
                            <span className={`text-[11px] font-medium uppercase tracking-widest ${activeTab === 'pemasukan' ? 'text-emerald-700' : 'text-rose-700'}`}>
                                TRANSAKSI HARI INI
                            </span>
                        </div>
                        
                        <h3 className={`text-3xl font-black tracking-tight mb-1.5 ${activeTab === 'pemasukan' ? 'text-emerald-950' : 'text-rose-950'}`}>
                            {rupiah(todayTotal)}
                        </h3>
                        
                        <p className={`text-xs font-medium ${activeTab === 'pemasukan' ? 'text-emerald-600/80' : 'text-rose-600/80'}`}>
                            Total {activeTab === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'} • {format(new Date(), 'dd MMM yyyy', { locale: id })}
                        </p>
                    </div>
                    <div className={`absolute -bottom-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-40 pointer-events-none ${activeTab === 'pemasukan' ? 'bg-emerald-200' : 'bg-rose-200'}`}></div>
                </motion.div>

                {/* CHART PIE */}
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col items-center relative">
                    {chartData.length === 0 ? ( <div className="py-12 text-center text-gray-300 text-xs font-bold uppercase tracking-widest">Data kosong</div> ) : (
                        <div className="w-full h-[220px] relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={chartData} innerRadius={isMobile ? 55 : 65} outerRadius={isMobile ? 75 : 85} paddingAngle={5} dataKey="value" cornerRadius={6}>
                                        {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />)}
                                    </Pie>
                                    <Tooltip formatter={(v) => rupiah(v)} contentStyle={{ borderRadius: '16px', border: '1px solid #f3f4f6', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', fontSize: '12px', fontWeight: 'bold' }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Total Bulan Ini</p>
                                <p className={`text-xl font-black tracking-tight ${activeTab === 'pemasukan' ? 'text-emerald-500' : 'text-rose-500'}`}>{rupiah(activeTab === 'pemasukan' ? totalIncome : totalExpense)}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* RINCIAN KATEGORI */}
                <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6">Rincian Kategori</h3>
                    <div className="space-y-5">
                        {categoryList.slice(0, 5).map((cat, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-3">
                                    <span className="w-3.5 h-3.5 rounded-full shadow-inner" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                                    <span className="font-bold text-gray-700">{cat.name}</span>
                                </div>
                                <div className="text-right">
                                    <p className="font-black text-gray-900">{rupiah(cat.value)}</p>
                                    <p className="text-[9px] text-gray-400 font-bold mt-0.5">{((cat.value / (activeTab === 'pemasukan' ? totalIncome : totalExpense)) * 100).toFixed(0)}%</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* KANAN */}
            <div className="lg:col-span-8 space-y-6">
                
                {/* Search Bar Aesthetic */}
                <div className="bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm flex items-center px-4 transition-shadow focus-within:shadow-md focus-within:border-gray-200">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-gray-300 mr-2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                    <input type="text" placeholder="Cari transaksi..." className="flex-1 bg-transparent outline-none text-sm font-bold text-gray-800 placeholder-gray-300 h-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>

                {weeklyData.length === 0 ? (
                    <div className="text-center py-24 bg-white rounded-[2rem] border border-dashed border-gray-200"><p className="text-gray-300 text-xs font-bold uppercase tracking-widest">Tidak ada data.</p></div>
                ) : (
                    <div className="space-y-6">
                        {weeklyData.map((week, wIdx) => (
                            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: wIdx * 0.05 }} key={week.week} className="bg-white rounded-[2rem] border border-gray-100 shadow-[0_2px_15px_rgba(0,0,0,0.02)] overflow-hidden">
                                <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                                    <div>
                                        <h4 className="font-black text-gray-900 text-xs uppercase tracking-wider">Jumat ke-{week.week}</h4>
                                        <p className="text-[10px] text-gray-400 font-bold mt-1 tracking-wide">{format(week.startDate, 'dd MMM')} - {format(week.endDate, 'dd MMM')}</p>
                                    </div>
                                    <p className={`font-black text-sm tracking-tight ${activeTab === 'pemasukan' ? 'text-emerald-500' : 'text-rose-500'}`}>{rupiah(week.total)}</p>
                                </div>
                                <div className="divide-y divide-gray-50">
                                    {week.items.map((tx) => (
                                        <div key={tx.id} onClick={() => handleTxClick(tx)} className="p-4 hover:bg-gray-50 transition-colors flex justify-between items-center cursor-pointer group">
                                            <div className="flex items-center gap-4">
                                                
                                                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm ${activeTab === 'pemasukan' ? 'bg-emerald-50 text-emerald-500 border border-emerald-100' : 'bg-rose-50 text-rose-500 border border-rose-100'}`}>
                                                    <DynamicIcon name={tx.categories?.icon} size={20} />
                                                </div>

                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-gray-900 truncate max-w-[150px]">{tx.description || tx.categories?.name}</p>
                                                    <div className="flex items-center gap-1.5 mt-1 overflow-hidden">
                                                        <span className="text-[9px] text-gray-400 font-bold uppercase whitespace-nowrap">
                                                            {format(parseISO(tx.transaction_date), 'dd MMM')}
                                                        </span>
                                                        <span className="text-[9px] text-gray-300">•</span>
                                                        <span className="text-[9px] text-gray-500 font-bold uppercase truncate">
                                                            {tx.wallets?.name || tx.payment_method || 'Manual'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <p className={`text-xs font-black ${activeTab === 'pemasukan' ? 'text-emerald-500' : 'text-gray-900'}`}>{rupiah(tx.amount)}</p>
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

      {/* MODAL EDIT & DETAIL AESTHETIC */}
      <AnimatePresence>
          {selectedTx && (
              <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setSelectedTx(null)} />
                  <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="bg-white w-full md:max-w-md rounded-t-[2rem] md:rounded-[2rem] p-8 relative z-10 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
                      <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-8"></div>
                      {!isEditMode ? (
                          <>
                              {/* MODE DETAIL TRANSAKSI */}
                              <div className="text-center mb-8">
                                  <div className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-5 shadow-sm border ${selectedTx.categories?.type === 'income' ? 'bg-emerald-50 border-emerald-100 text-emerald-500' : 'bg-rose-50 border-rose-100 text-rose-500'}`}>
                                      <DynamicIcon name={selectedTx.categories?.icon} size={40} />
                                  </div>
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{selectedTx.categories?.name}</p>
                                  <h3 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">{rupiah(selectedTx.amount)}</h3>
                                  <p className="text-sm font-bold text-gray-500 mb-6">{selectedTx.description}</p>
                                  <div className="flex justify-center gap-3">
                                    <span className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-bold text-gray-500 uppercase">📅 {format(parseISO(selectedTx.transaction_date), 'dd MMM yyyy', { locale: id })}</span>
                                    <span className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-bold text-gray-500 uppercase">💳 {selectedTx.wallets?.name || selectedTx.payment_method}</span>
                                  </div>
                              </div>
                              <div className="flex gap-4">
                                  <button onClick={() => setIsEditMode(true)} className="flex-1 py-4 bg-white border border-gray-200 text-gray-700 font-bold rounded-2xl hover:bg-gray-50 shadow-sm transition-colors">Edit</button>
                                  <button onClick={handleDelete} className="flex-1 py-4 bg-rose-50 text-rose-600 font-bold rounded-2xl hover:bg-rose-100 transition-colors">Hapus</button>
                              </div>
                          </>
                      ) : (
                          /* MODE FORM EDIT TRANSAKSI */
                          <form onSubmit={handleUpdate} className="space-y-5">
                              <h3 className="text-lg font-black text-gray-900 text-center mb-6">Edit Transaksi</h3>
                              
                              {/* Nominal */}
                              <div>
                                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1.5">Nominal (Rp)</label>
                                  <input 
                                      type="number" 
                                      required 
                                      value={editForm.amount} 
                                      onChange={e=>setEditForm({...editForm, amount: e.target.value})} 
                                      className={`w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-black text-2xl outline-none focus:bg-white focus:border-gray-300 transition-colors ${selectedTx.categories?.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`} 
                                  />
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                  {/* Tanggal */}
                                  <div>
                                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1.5">Tanggal</label>
                                      <input 
                                          type="date" 
                                          required 
                                          value={editForm.date} 
                                          onChange={e=>setEditForm({...editForm, date: e.target.value})} 
                                          className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-xl font-bold text-gray-800 outline-none focus:bg-white focus:border-gray-300 transition-colors text-sm" 
                                      />
                                  </div>
                                  
                                  {/* Sumber Dana */}
                                  <div>
                                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1.5">Sumber Dana</label>
                                      <div className="relative">
                                          <select 
                                              value={editForm.wallet_id || ''} 
                                              onChange={e=>setEditForm({...editForm, wallet_id: e.target.value})} 
                                              className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-xl font-bold text-gray-800 outline-none focus:bg-white focus:border-gray-300 transition-colors appearance-none cursor-pointer text-sm"
                                          >
                                              {availableWallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                          </select>
                                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                              <DynamicIcon name="ChevronDown" size={16} />
                                          </span>
                                      </div>
                                  </div>
                              </div>

                              {/* Kategori Dropdown dengan Ikon */}
                              <div>
                                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1.5">Kategori</label>
                                  <div className="flex gap-3">
                                      <div className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center border shadow-sm ${selectedTx.categories?.type === 'income' ? 'bg-emerald-50 border-emerald-100 text-emerald-500' : 'bg-rose-50 border-rose-100 text-rose-500'}`}>
                                          <DynamicIcon name={availableCategories.find(c => String(c.id) === String(editForm.category_id))?.icon || 'LayoutGrid'} size={24} />
                                      </div>
                                      <div className="relative flex-1">
                                          <select 
                                              value={editForm.category_id} 
                                              onChange={e=>setEditForm({...editForm, category_id: e.target.value})} 
                                              className="w-full h-full p-3.5 bg-gray-50 border border-gray-100 rounded-xl font-bold text-gray-800 outline-none focus:bg-white focus:border-gray-300 transition-colors appearance-none cursor-pointer text-sm"
                                          >
                                              {availableCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                          </select>
                                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                              <DynamicIcon name="ChevronDown" size={16} />
                                          </span>
                                      </div>
                                  </div>
                              </div>

                              {/* Deskripsi */}
                              <div>
                                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1.5">Catatan</label>
                                  <textarea 
                                      rows="2" 
                                      value={editForm.description} 
                                      onChange={e=>setEditForm({...editForm, description: e.target.value})} 
                                      className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl font-medium text-gray-800 outline-none focus:bg-white focus:border-gray-300 transition-colors resize-none text-sm placeholder-gray-300" 
                                      placeholder="Tulis catatan opsional..." 
                                  />
                              </div>

                              {/* Action Buttons */}
                              <div className="flex gap-4 pt-4">
                                  <button type="button" onClick={() => setIsEditMode(false)} className="flex-1 py-4 bg-gray-50 border border-gray-200 font-bold text-gray-500 rounded-2xl hover:bg-gray-100 transition-colors">Batal</button>
                                  <button type="submit" className="flex-1 py-4 bg-gray-900 font-bold text-white rounded-2xl shadow-lg hover:bg-black transition-colors tracking-wide">Simpan Perubahan</button>
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