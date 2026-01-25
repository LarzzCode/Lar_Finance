import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, format, getWeek } from 'date-fns';
import { id } from 'date-fns/locale'; 
import { 
  PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Sector 
} from 'recharts';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion'; 
import EditModal from '../components/EditModal';

// --- HELPER CHART ---
const renderActiveShapeMobile = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 5} startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
};

// --- MAIN COMPONENT ---
export default function Rekapan() {
  // 1. STATE & FILTER
  const [filter, setFilter] = useState('monthly'); 
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // 2. VIEW MODE
  const [viewMode, setViewMode] = useState('report'); 
  const [reportType, setReportType] = useState('daily'); 

  // 3. DATA
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });
  const [chartData, setChartData] = useState([]); 
  const [dailyData, setDailyData] = useState([]); 
  const [activeIndex, setActiveIndex] = useState(0);

  // 4. UTILS
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchData();
  }, [filter, selectedDate]);

  // --- LOGIC FETCH DATA ---
  const fetchData = async () => {
    const targetDate = new Date(selectedDate);
    let start, end;
    const fmt = 'yyyy-MM-dd';

    if (filter === 'weekly') {
      start = format(startOfWeek(targetDate, { weekStartsOn: 1 }), fmt);
      end = format(endOfWeek(targetDate, { weekStartsOn: 1 }), fmt);
    } else if (filter === 'monthly') {
      start = format(startOfMonth(targetDate), fmt);
      end = format(endOfMonth(targetDate), fmt);
    } else {
      start = format(startOfYear(targetDate), fmt);
      end = format(endOfYear(targetDate), fmt);
    }

    const { data } = await supabase
      .from('transactions')
      .select('*, categories(name, type)')
      .gte('transaction_date', start)
      .lte('transaction_date', end)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (data) {
      setTransactions(data);
      processSummary(data);
      processChartData(data);
    }
  };

  const processSummary = (data) => {
    let inc = 0, exp = 0;
    data.forEach(t => {
      if (t.categories?.type === 'income') inc += Number(t.amount);
      else exp += Number(t.amount);
    });
    setSummary({ income: inc, expense: exp, balance: inc - exp });
  };

  const processChartData = (data) => {
    // Pie Chart
    const expenseOnly = data.filter(t => t.categories?.type === 'expense');
    const groupedCategory = expenseOnly.reduce((acc, curr) => {
      const catName = Array.isArray(curr.categories) ? curr.categories[0]?.name : curr.categories?.name;
      const key = catName || 'Lainnya';
      acc[key] = (acc[key] || 0) + Number(curr.amount);
      return acc;
    }, {});
    const pieArray = Object.keys(groupedCategory)
        .map(key => ({ name: key, value: groupedCategory[key] }))
        .sort((a, b) => b.value - a.value);
    setChartData(pieArray);

    // Area Chart
    const groupedDate = data.reduce((acc, curr) => {
      const date = format(new Date(curr.transaction_date), 'dd/MM');
      if (!acc[date]) acc[date] = { date, income: 0, expense: 0 };
      if (curr.categories?.type === 'income') acc[date].income += Number(curr.amount);
      else acc[date].expense += Number(curr.amount);
      return acc;
    }, {});
    
    const barArray = Object.values(groupedDate).sort((a, b) => {
        const [dA, mA] = a.date.split('/');
        const [dB, mB] = b.date.split('/');
        return new Date(2024, mA-1, dA) - new Date(2024, mB-1, dB);
    });
    setDailyData(barArray);
  };

  // --- LOGIC SMART REPORT (TIMELINE) ---
  const groupedReportData = useMemo(() => {
    const expenseData = transactions.filter(t => t.categories?.type === 'expense');
    const groups = expenseData.reduce((acc, t) => {
        const dateObj = new Date(t.transaction_date);
        let key, label, subLabel, icon;

        if (reportType === 'daily') {
            key = format(dateObj, 'yyyy-MM-dd');
            label = format(dateObj, 'EEEE, dd MMM', { locale: id });
            subLabel = 'Harian';
            icon = '📅';
        } else if (reportType === 'weekly') {
            const weekNum = getWeek(dateObj, { weekStartsOn: 1 });
            key = `W-${weekNum}`;
            label = `Minggu ke-${weekNum}`;
            subLabel = format(dateObj, 'MMMM yyyy', { locale: id });
            icon = '📊';
        } else {
            key = format(dateObj, 'yyyy-MM');
            label = format(dateObj, 'MMMM yyyy', { locale: id });
            subLabel = format(dateObj, 'yyyy');
            icon = '🗓️';
        }

        if (!acc[key]) {
            acc[key] = { key, label, subLabel, icon, total: 0, categories: {} };
        }

        const amount = Number(t.amount);
        acc[key].total += amount;

        const catName = Array.isArray(t.categories) ? t.categories[0]?.name : t.categories?.name;
        const cKey = catName || 'Lainnya';
        acc[key].categories[cKey] = (acc[key].categories[cKey] || 0) + amount;

        return acc;
    }, {});

    return Object.values(groups)
        .sort((a, b) => b.key.localeCompare(a.key))
        .map(group => {
            const catArray = Object.entries(group.categories)
                .map(([name, amount]) => ({ name, amount }))
                .sort((a, b) => b.amount - a.amount);
            return { ...group, categoryList: catArray };
        });

  }, [transactions, reportType]);

  // --- LOGIC TABLE ---
  const filteredData = transactions.filter((t) => {
    const query = searchQuery.toLowerCase();
    const desc = (t.description || '').toLowerCase();
    const cat = (t.categories?.name || '').toLowerCase();
    return desc.includes(query) || cat.includes(query);
  });
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const handleDelete = async (id) => {
    if (window.confirm('Hapus data?')) {
      await supabase.from('transactions').delete().eq('id', id);
      fetchData();
    }
  };
  const handleExport = () => {
    const dataToExport = transactions.map((t, index) => ({
      'No': index + 1, 'Date': t.transaction_date, 'Description': t.description, 
      'Nominal': t.amount, 'Type': t.categories?.type
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dataToExport), "Laporan");
    XLSX.writeFile(wb, "Laporan_Keuangan.xlsx");
    toast.success('Downloaded!');
  };

  const rupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
  const activeItem = chartData[activeIndex] || {};

  return (
    <div className="min-h-screen w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 md:pt-28 md:pb-12 font-sans text-gray-800">
      <EditModal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} transaction={editData} onSuccess={fetchData} />

      {/* HEADER (FIXED: STATIC POSITION - TIDAK MENGIKUTI SCROLL) */}
      <div className="bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 mb-8 relative">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h2 className="text-3xl font-black bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">Laporan Keuangan</h2>
                <p className="text-sm font-medium text-gray-400 mt-1">Pantau kesehatan cashflow-mu.</p>
            </div>
            <div className="flex gap-2 items-center bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
                 <select value={filter} onChange={(e) => setFilter(e.target.value)} className="bg-transparent text-xs font-bold text-gray-600 outline-none px-2 cursor-pointer hover:text-indigo-600 transition-colors">
                    <option value="weekly">Minggu Ini</option>
                    <option value="monthly">Bulan Ini</option>
                    <option value="yearly">Tahun Ini</option>
                  </select>
                 <div className="w-px h-4 bg-gray-300 mx-1"></div>
                 <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-transparent text-xs font-bold text-gray-600 outline-none px-2 cursor-pointer" />
                 <button onClick={handleExport} className="ml-2 bg-gray-900 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-gray-900/20 hover:scale-105 transition-transform">
                    Export
                 </button>
            </div>
        </div>
        
        {/* SUMMARY CARDS (MODERN) */}
        <div className="grid grid-cols-3 gap-4 mt-6">
            {[
                { label: 'Pemasukan', amount: summary.income, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
                { label: 'Pengeluaran', amount: summary.expense, color: 'text-rose-600', bg: 'bg-rose-500/10' },
                { label: 'Sisa Saldo', amount: summary.balance, color: summary.balance < 0 ? 'text-red-600' : 'text-blue-600', bg: 'bg-blue-500/10' },
            ].map((item, idx) => (
                <div key={idx} className={`p-5 rounded-3xl ${item.bg} flex flex-col justify-center items-start min-h-[100px] transition-transform hover:scale-[1.02]`}>
                    <p className="text-[10px] md:text-xs font-black uppercase tracking-wider opacity-60 mb-1">{item.label}</p>
                    <p className={`text-lg md:text-2xl font-black ${item.color} truncate w-full`}>{rupiah(item.amount)}</p>
                </div>
            ))}
        </div>
      </div>

      {/* GRAPHIC AREA (Modern Cards) */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Trend Chart */}
          <div className="bg-white p-6 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 h-[400px]">
            <h3 className="font-bold text-gray-700 mb-6 flex items-center gap-2 text-lg">
                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 text-sm">📈</div>
                Trend Cashflow
            </h3>
            <ResponsiveContainer width="100%" height="80%">
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10B981" stopOpacity={0}/></linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/><stop offset="95%" stopColor="#EF4444" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#9CA3AF'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#9CA3AF'}} tickFormatter={(val)=>`${val/1000}k`} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.2)' }} />
                <Area type="monotone" dataKey="income" stroke="#10B981" strokeWidth={3} fill="url(#colorIncome)" />
                <Area type="monotone" dataKey="expense" stroke="#EF4444" strokeWidth={3} fill="url(#colorExpense)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          {/* Pie Chart */}
          <div className="bg-white p-6 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 h-[400px] relative">
            <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2 text-lg">
                <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 text-sm">🍩</div>
                Komposisi Pengeluaran
            </h3>
            <ResponsiveContainer width="100%" height="85%">
              <PieChart>
                <Pie activeIndex={activeIndex} activeShape={isMobile ? renderActiveShapeMobile : undefined} data={chartData} cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={4} dataKey="value" onMouseEnter={(_, i) => setActiveIndex(i)}>
                  {chartData.map((_, i) => <Cell key={`c-${i}`} fill={COLORS[i % COLORS.length]} stroke="none" />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
             {/* Floating Center Text */}
             {activeItem.name && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-10">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{activeItem.name}</p>
                    <p className="text-xl font-black text-gray-800">{rupiah(activeItem.value)}</p>
                </div>
            )}
          </div>
      </div>

      {/* 3. SECTION ANALISIS & DATA (PREMIUM LOOK) */}
      <div className="bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgb(0,0,0,0.05)] border border-gray-100 overflow-hidden min-h-[600px] relative">
        
        {/* FLOATING TABS */}
        <div className="flex justify-center pt-8 pb-6 bg-white z-20 relative">
            <div className="bg-gray-100/80 p-1.5 rounded-2xl flex gap-1 relative">
                {/* Active Indicator */}
                <motion.div 
                    layoutId="activeTab"
                    className={`absolute inset-y-1.5 bg-white shadow-sm rounded-xl z-10 ${viewMode === 'report' ? 'left-1.5 w-[calc(50%-6px)]' : 'left-[calc(50%+2px)] w-[calc(50%-6px)]'}`}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
                <button 
                    onClick={() => setViewMode('report')}
                    className={`relative z-20 px-8 py-2.5 text-sm font-bold rounded-xl transition-colors ${viewMode === 'report' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    📊 Analisis Timeline
                </button>
                <button 
                    onClick={() => setViewMode('table')}
                    className={`relative z-20 px-8 py-2.5 text-sm font-bold rounded-xl transition-colors ${viewMode === 'table' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    📝 Data Tabel
                </button>
            </div>
        </div>

        {/* --- MODE 1: ANALISIS DETAIL (TIMELINE STYLE) --- */}
        {viewMode === 'report' && (
            <div className="px-6 pb-12 md:px-12">
                {/* Sub-Filter (Capsule) */}
                <div className="flex justify-center gap-2 mb-10">
                    {[
                        { id: 'daily', label: 'Hari' },
                        { id: 'weekly', label: 'Minggu' },
                        { id: 'monthly', label: 'Bulan' }
                    ].map(type => (
                        <button 
                            key={type.id} 
                            onClick={() => setReportType(type.id)}
                            className={`px-5 py-2 rounded-full text-xs font-bold border transition-all ${reportType === type.id ? 'bg-gray-900 text-white border-gray-900 shadow-lg scale-105' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
                        >
                            {type.label}
                        </button>
                    ))}
                </div>

                {/* TIMELINE LIST */}
                <div className="relative border-l-2 border-gray-100 ml-4 md:ml-6 space-y-10">
                    {groupedReportData.length === 0 ? (
                        <div className="pl-10 py-10 text-gray-400 italic">Belum ada data pengeluaran.</div>
                    ) : (
                        groupedReportData.map((group, index) => (
                            <motion.div 
                                initial={{ opacity: 0, x: -20 }} 
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                key={group.key} 
                                className="relative pl-8 md:pl-12"
                            >
                                {/* Timeline Dot */}
                                <div className="absolute -left-[9px] top-0 w-[18px] h-[18px] bg-white border-4 border-indigo-500 rounded-full shadow-sm z-10"></div>
                                
                                {/* Card Content */}
                                <div className="bg-white p-6 rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-gray-50 hover:shadow-[0_10px_30px_rgb(0,0,0,0.06)] transition-shadow">
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-gray-50 pb-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xl">{group.icon}</span>
                                                <span className="text-xs font-bold text-indigo-500 uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded-md">{group.subLabel}</span>
                                            </div>
                                            <h4 className="text-xl font-black text-gray-800 capitalize">{group.label}</h4>
                                        </div>
                                        <div className="mt-2 md:mt-0 text-right">
                                            <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-orange-500">
                                                {rupiah(group.total)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Categories Progress Bars */}
                                    <div className="space-y-4">
                                        {group.categoryList.map((cat, idx) => {
                                            const percent = (cat.amount / group.total) * 100;
                                            return (
                                                <div key={idx}>
                                                    <div className="flex justify-between text-sm font-bold text-gray-700 mb-1.5">
                                                        <span>{cat.name}</span>
                                                        <span>{rupiah(cat.amount)}</span>
                                                    </div>
                                                    <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden shadow-inner">
                                                        <motion.div 
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${percent}%` }}
                                                            transition={{ duration: 1, ease: "easeOut" }}
                                                            className="h-full bg-gradient-to-r from-rose-400 via-orange-400 to-amber-400 rounded-full shadow-[0_2px_10px_rgba(251,146,60,0.3)]"
                                                        />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </div>
        )}

        {/* --- MODE 2: TABEL (CLEAN LOOK) --- */}
        {viewMode === 'table' && (
            <div className="p-6">
                 <div className="mb-6 relative">
                    <input 
                        type="text" placeholder="Cari transaksi..." 
                        className="w-full p-4 pl-12 bg-gray-50 border-none rounded-2xl text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                        value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <span className="absolute left-4 top-4 text-gray-400">🔍</span>
                 </div>
                 <div className="overflow-hidden rounded-2xl border border-gray-100">
                    <table className="min-w-full">
                        <thead className="bg-gray-50/50 text-gray-400 text-[10px] uppercase font-bold">
                            <tr>
                                <th className="px-6 py-4 text-left">Tanggal</th>
                                <th className="px-6 py-4 text-left">Detail</th>
                                <th className="px-6 py-4 text-right">Nominal</th>
                                <th className="px-6 py-4 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {paginatedData.map((t) => (
                                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 text-sm font-bold text-gray-500">{format(new Date(t.transaction_date), 'dd MMM yyyy')}</td>
                                    <td className="px-6 py-4">
                                        <p className="text-sm font-bold text-gray-800">{t.description}</p>
                                        <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded-md text-gray-500 font-bold uppercase tracking-wide">
                                            {Array.isArray(t.categories) ? t.categories[0]?.name : t.categories?.name}
                                        </span>
                                    </td>
                                    <td className={`px-6 py-4 text-sm font-black text-right ${t.categories?.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        {rupiah(t.amount)}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex justify-center gap-3">
                                            <button onClick={() => { setEditData(t); setIsEditOpen(true); }} className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-500 hover:bg-indigo-100 flex items-center justify-center transition-colors">✎</button>
                                            <button onClick={() => handleDelete(t.id)} className="w-8 h-8 rounded-full bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center transition-colors">✕</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
                 {/* Pagination */}
                 <div className="mt-6 flex justify-center gap-4 items-center">
                    <button disabled={currentPage===1} onClick={()=>setCurrentPage(c=>c-1)} className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold disabled:opacity-50 hover:bg-gray-50 transition-colors">Prev</button>
                    <span className="text-xs font-bold text-gray-400">Hal {currentPage} / {totalPages}</span>
                    <button disabled={currentPage>=totalPages} onClick={()=>setCurrentPage(c=>c+1)} className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold disabled:opacity-50 hover:bg-gray-50 transition-colors">Next</button>
                 </div>
            </div>
        )}

      </div>
    </div>
  );
}