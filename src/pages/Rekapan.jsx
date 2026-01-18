import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, format, getWeek } from 'date-fns';
import { id } from 'date-fns/locale'; // Bahasa Indonesia
import { 
  PieChart, Pie, Cell, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Sector 
} from 'recharts';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion'; 
import EditModal from '../components/EditModal';

// --- KOMPONEN CHART CUSTOM ---

// 1. Render Active Shape Pie (Desktop)
const renderActiveShapeDesktop = (props) => {
  const RADIAN = Math.PI / 180;
  const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  const sin = Math.sin(-midAngle * RADIAN);
  const cos = Math.cos(-midAngle * RADIAN);
  const sx = cx + (outerRadius + 10) * cos;
  const sy = cy + (outerRadius + 10) * sin;
  const mx = cx + (outerRadius + 30) * cos;
  const my = cy + (outerRadius + 30) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 22;
  const ey = my;
  const textAnchor = cos >= 0 ? 'start' : 'end';

  return (
    <g>
      <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill} className="text-sm font-bold dark:fill-white">
        {payload.name}
      </text>
      <Sector
        cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 6}
        startAngle={startAngle} endAngle={endAngle} fill={fill}
      />
      <Sector
        cx={cx} cy={cy} startAngle={startAngle} endAngle={endAngle}
        innerRadius={innerRadius + 6} outerRadius={outerRadius + 10} fill={fill}
      />
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
      <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
      <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} className="fill-gray-700 dark:fill-gray-200 text-xs font-bold">{`Rp ${new Intl.NumberFormat('id-ID').format(value)}`}</text>
      <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={18} textAnchor={textAnchor} fill="#999" fontSize={10}>
        {`(${(percent * 100).toFixed(0)}%)`}
      </text>
    </g>
  );
};

// 2. Render Active Shape Pie (Mobile)
const renderActiveShapeMobile = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector
        cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 5}
        startAngle={startAngle} endAngle={endAngle} fill={fill}
      />
    </g>
  );
};

export default function Rekapan() {
  const [filter, setFilter] = useState('monthly');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pagination & Filter
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [typeFilter, setTypeFilter] = useState('all'); 
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });
  
  // Data Chart
  const [chartData, setChartData] = useState([]); 
  const [dailyData, setDailyData] = useState([]); 
  
  // NEW: State untuk Bar Chart Kompleks
  const [barView, setBarView] = useState('daily'); // 'daily' | 'weekly' | 'category'
  const [barChartData, setBarChartData] = useState([]);
  const [barStats, setBarStats] = useState({ avg: 0, max: 0, maxLabel: '' });

  const [activeIndex, setActiveIndex] = useState(0); 
  const [sortConfig, setSortConfig] = useState({ key: 'transaction_date', direction: 'desc' });
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editData, setEditData] = useState(null);

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchData();
  }, [filter, selectedDate]);

  // Efek samping: Saat data transaksi berubah, hitung ulang data Bar Chart
  useEffect(() => {
    processBarChartData();
  }, [transactions, barView]);

  // --- LOGIKA BARU: HITUNG PENGELUARAN HARI INI (TODAY SNAPSHOT) ---
  const todayStats = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    const todayTx = transactions.filter(t => {
       const rawDate = t.transaction_date || '';
       return rawDate.startsWith(todayStr) && t.categories?.type === 'expense';
    });

    let total = 0;
    const groups = {};

    todayTx.forEach(t => {
       const amt = Number(t.amount);
       total += amt;
       
       const catName = Array.isArray(t.categories) ? t.categories[0]?.name : t.categories?.name;
       const key = catName || 'Lainnya';

       groups[key] = (groups[key] || 0) + amt;
    });

    const breakdown = Object.entries(groups)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

    return { total, breakdown };
  }, [transactions]);


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
    // 1. Pie Chart Logic
    const expenseOnly = data.filter(t => t.categories?.type === 'expense');
    const groupedCategory = expenseOnly.reduce((acc, curr) => {
      const catName = curr.categories?.name || 'Lainnya';
      acc[catName] = (acc[catName] || 0) + Number(curr.amount);
      return acc;
    }, {});
    const pieArray = Object.keys(groupedCategory)
        .map(key => ({ name: key, value: groupedCategory[key] }))
        .sort((a, b) => b.value - a.value);
    setChartData(pieArray);

    // 2. Area Chart Logic (Trend)
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

  // --- LOGIKA BARU: BAR CHART (3 MODE) ---
  const processBarChartData = () => {
    const expenseOnly = transactions.filter(t => t.categories?.type === 'expense');
    let processed = [];
    let maxVal = 0;
    let maxLbl = '';
    let totalExp = 0;

    if (barView === 'daily') {
        const grouped = expenseOnly.reduce((acc, curr) => {
            const dateObj = new Date(curr.transaction_date);
            const dayLabel = format(dateObj, 'EEE', { locale: id }); 
            const dateLabel = format(dateObj, 'dd/MM');
            const key = `${dayLabel} ${dateLabel}`;
            if (!acc[key]) acc[key] = { label: key, fullDate: curr.transaction_date, amount: 0 };
            acc[key].amount += Number(curr.amount);
            return acc;
        }, {});
        processed = Object.values(grouped).sort((a, b) => new Date(a.fullDate) - new Date(b.fullDate));
    
    } else if (barView === 'weekly') {
        const grouped = expenseOnly.reduce((acc, curr) => {
            const dateObj = new Date(curr.transaction_date);
            const weekNum = getWeek(dateObj, { weekStartsOn: 1 });
            const key = `Minggu ${weekNum}`;
            if (!acc[key]) acc[key] = { label: key, weekNum, amount: 0 };
            acc[key].amount += Number(curr.amount);
            return acc;
        }, {});
        processed = Object.values(grouped).sort((a, b) => a.weekNum - b.weekNum);

    } else {
        // Mode Kategori
        const grouped = expenseOnly.reduce((acc, curr) => {
            const catName = Array.isArray(curr.categories) 
                ? curr.categories[0]?.name 
                : curr.categories?.name;
            const key = catName || 'Lainnya';
            if (!acc[key]) acc[key] = { label: key, amount: 0 };
            acc[key].amount += Number(curr.amount);
            return acc;
        }, {});
        processed = Object.values(grouped).sort((a, b) => b.amount - a.amount);
    }

    processed.forEach(item => {
        totalExp += item.amount;
        if (item.amount > maxVal) {
            maxVal = item.amount;
            maxLbl = item.label;
        }
    });

    setBarChartData(processed);
    setBarStats({
        avg: processed.length > 0 ? totalExp / processed.length : 0,
        max: maxVal,
        maxLabel: maxLbl
    });
  };

  const filteredData = transactions.filter((t) => {
    const query = searchQuery.toLowerCase();
    const desc = (t.description || '').toLowerCase();
    const cat = (t.categories?.name || '').toLowerCase();
    const matchSearch = desc.includes(query) || cat.includes(query);
    const matchType = typeFilter === 'all' ? true : t.categories?.type === typeFilter;
    return matchSearch && matchType;
  });

  const sortedData = [...filteredData].sort((a, b) => {
    let aValue = a[sortConfig.key];
    let bValue = b[sortConfig.key];
    if (sortConfig.key === 'category') {
      aValue = a.categories?.name || '';
      bValue = b.categories?.name || '';
    }
    if (sortConfig.key === 'amount') {
      aValue = Number(a.amount);
      bValue = Number(b.amount);
    }
    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const paginatedData = sortedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleExport = () => {
    const dataToExport = sortedData.map((t, index) => {
      return {
        'No': index + 1,
        'Date': format(new Date(t.transaction_date), 'dd/MM/yyyy'),
        'Description': t.description,
        'Category': t.categories?.name,
        'Nominal': Number(t.amount)
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan");
    XLSX.writeFile(workbook, `Laporan_${filter}_${selectedDate}.xlsx`);
    toast.success('Excel berhasil didownload!');
  };

  const handleDelete = async (id) => {
    if (window.confirm('Hapus data?')) {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) toast.error(error.message);
      else { toast.success('Dihapus'); fetchData(); }
    }
  };

  const handleEdit = (transaction) => { setEditData(transaction); setIsEditOpen(true); };
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const rupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
  const formatDate = (dateString) => format(new Date(dateString), 'dd/MM/yyyy');
  const getBadgeColor = (type) => type === 'income' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur shadow-lg border border-gray-100 dark:border-gray-700 p-3 rounded-xl text-xs z-50">
          <p className="font-bold mb-1 text-gray-500 dark:text-gray-400">{label}</p>
          {payload.map((entry, idx) => (
             <p key={idx} style={{ color: entry.color }} className="font-bold">
               {entry.name === 'amount' ? 'Nominal' : entry.name === 'income' ? 'Masuk' : 'Keluar'}: {rupiah(entry.value)}
             </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const activeItem = chartData[activeIndex] || {};

  return (
    <div className="min-h-screen w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 md:pt-24 md:pb-8">
      <EditModal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} transaction={editData} onSuccess={fetchData} />

      {/* HEADER CONTROLS */}
      <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6 transition-colors">
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div>
                <h2 className="text-2xl font-black text-gray-800 dark:text-white">Laporan Keuangan</h2>
                <p className="text-sm text-gray-400">Analisis cashflow mendalam.</p>
            </div>
            <button onClick={handleExport} className="bg-gray-900 dark:bg-gray-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-black dark:hover:bg-gray-600 transition-all">
                Export
            </button>
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            <input 
              type="text" placeholder="Cari transaksi..."
              className="flex-grow p-3 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50 focus:bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:bg-gray-600 transition-colors"
              value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            />
            <div className="flex gap-2">
              <select value={filter} onChange={(e) => setFilter(e.target.value)} className="p-3 border rounded-xl text-sm bg-white font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 outline-none">
                <option value="weekly">Mingguan</option>
                <option value="monthly">Bulanan</option>
                <option value="yearly">Tahunan</option>
              </select>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="p-3 border rounded-xl text-sm bg-white font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 outline-none" />
            </div>
          </div>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-emerald-100 dark:border-emerald-900/30 relative overflow-hidden group transition-colors">
          <p className="text-xs text-emerald-500 font-bold uppercase tracking-wider">Total Pemasukan</p>
          <p className="text-2xl font-black text-gray-800 dark:text-white mt-1">{rupiah(summary.income)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-rose-100 dark:border-rose-900/30 relative overflow-hidden group transition-colors">
          <p className="text-xs text-rose-500 font-bold uppercase tracking-wider">Total Pengeluaran</p>
          <p className="text-2xl font-black text-gray-800 dark:text-white mt-1">{rupiah(summary.expense)}</p>
        </div>
        <div className={`bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border relative overflow-hidden transition-colors ${summary.balance < 0 ? 'border-red-200 dark:border-red-900/30' : 'border-blue-100 dark:border-blue-900/30'}`}>
          <p className={`text-xs font-bold uppercase tracking-wider ${summary.balance < 0 ? 'text-red-500' : 'text-blue-500'}`}>Sisa Saldo</p>
          <p className={`text-2xl font-black mt-1 ${summary.balance < 0 ? 'text-red-600' : 'text-blue-600'}`}>{rupiah(summary.balance)}</p>
        </div>
      </div>

      {/* --- NEW: TODAY'S SNAPSHOT CARD --- */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 dark:from-gray-800 dark:to-gray-900 rounded-3xl p-6 shadow-xl mb-8 text-white relative overflow-hidden">
        {/* Dekorasi Background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

        <div className="flex flex-col md:flex-row justify-between gap-6 relative z-10">
            
            {/* KIRI: Total Hari Ini */}
            <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                    <span className="bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                        Live Update
                    </span>
                    <h3 className="text-gray-400 text-sm font-bold uppercase tracking-wider">Pengeluaran Hari Ini</h3>
                </div>
                <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black tracking-tight">
                        {rupiah(todayStats.total)}
                    </span>
                </div>
                <p className="text-gray-400 text-xs mt-2 max-w-xs">
                    {todayStats.total === 0 
                        ? "Belum ada pengeluaran hari ini. Hemat pangkal kaya! 🌱" 
                        : "Pantau terus agar tidak over-budget ya! 👀"}
                </p>
            </div>

            {/* KANAN: Rincian Kategori (Bar Progress) */}
            <div className="flex-1 md:border-l md:border-white/10 md:pl-8">
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Rincian Kategori</h4>
                
                <div className="space-y-3 max-h-[120px] overflow-y-auto pr-2 custom-scrollbar">
                    {todayStats.breakdown.length === 0 ? (
                        <p className="text-gray-500 text-sm italic">- Tidak ada data -</p>
                    ) : (
                        todayStats.breakdown.map((item, idx) => {
                            const percent = (item.amount / todayStats.total) * 100;
                            return (
                                <div key={idx} className="group">
                                    <div className="flex justify-between text-xs font-medium mb-1">
                                        <span className="text-gray-300">{item.name}</span>
                                        <span className="font-bold">{rupiah(item.amount)}</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-orange-500 rounded-full transition-all duration-500" 
                                            style={{ width: `${percent}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
      </div>

      {/* GRAPHIC SECTION 1: TREND & PIE */}
      {searchQuery === '' && (
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          
          {/* AREA CHART (TREND) */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 h-[400px] transition-colors">
            <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-6 flex items-center gap-2">
                <span className="w-2 h-6 bg-indigo-500 rounded-full"></span>
                Arus Kas (Trend)
            </h3>
            <ResponsiveContainer width="100%" height="85%">
              <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" strokeOpacity={0.1} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 11}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 11}} tickFormatter={(value) => `${value / 1000}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="income" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" />
                <Area type="monotone" dataKey="expense" stroke="#EF4444" strokeWidth={3} fillOpacity={1} fill="url(#colorExpense)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* PIE CHART (KATEGORI) */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 h-[400px] relative transition-colors">
             <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-2">
                <span className="w-2 h-6 bg-orange-500 rounded-full"></span>
                Komposisi Pengeluaran
            </h3>
            {chartData.length > 0 ? (
                <>
                <ResponsiveContainer width="100%" height="90%">
                <PieChart>
                    <Pie
                        activeIndex={activeIndex}
                        activeShape={isMobile ? renderActiveShapeMobile : renderActiveShapeDesktop} 
                        data={chartData}
                        cx="50%" cy="50%"
                        innerRadius={isMobile ? 60 : 70} 
                        outerRadius={isMobile ? 80 : 90}
                        paddingAngle={4}
                        dataKey="value"
                        onMouseEnter={(_, index) => setActiveIndex(index)}
                        onClick={(_, index) => setActiveIndex(index)}
                    >
                    {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                    ))}
                    </Pie>
                </PieChart>
                </ResponsiveContainer>

                {isMobile && activeItem.name && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-6">
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wide text-center max-w-[120px] truncate">
                            {activeItem.name}
                        </p>
                        <p className="text-lg font-black text-gray-800 dark:text-white">
                            {rupiah(activeItem.value)}
                        </p>
                        <p className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full mt-1">
                            {((activeItem.value / summary.expense) * 100).toFixed(0)}%
                        </p>
                    </div>
                )}
                </>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-300">
                    <p>Belum ada pengeluaran</p>
                </div>
            )}
          </div>
        </div>
      )}

      {/* --- GRAPHIC SECTION 2: BAR CHART ANALYSIS (3 MODE) --- */}
      {searchQuery === '' && (
      <div className="bg-white dark:bg-gray-800 p-5 md:p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 mb-8 transition-colors">
        
        {/* HEADER & TOGGLE */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
            <div>
                <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2 text-lg">
                    <span className="w-2 h-6 bg-rose-500 rounded-full"></span>
                    Analisis Pengeluaran
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                    {barView === 'category' 
                        ? 'Ranking pengeluaran berdasarkan kategori.' 
                        : (barView === 'daily' ? 'Pantau pengeluaran harian.' : 'Lihat tren per minggu.')}
                </p>
            </div>
            
            {/* TOGGLE SWITCH (3 BUTTONS) */}
            <div className="bg-gray-100 dark:bg-gray-700 p-1 rounded-xl flex gap-1 w-full xl:w-auto overflow-x-auto">
                <button 
                    onClick={() => setBarView('daily')}
                    className={`flex-1 xl:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${barView === 'daily' ? 'bg-white dark:bg-gray-600 shadow text-rose-600 dark:text-rose-400' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    Harian
                </button>
                <button 
                    onClick={() => setBarView('weekly')}
                    className={`flex-1 xl:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${barView === 'weekly' ? 'bg-white dark:bg-gray-600 shadow text-rose-600 dark:text-rose-400' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    Mingguan
                </button>
                <button 
                    onClick={() => setBarView('category')}
                    className={`flex-1 xl:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${barView === 'category' ? 'bg-white dark:bg-gray-600 shadow text-rose-600 dark:text-rose-400' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    Per Kategori
                </button>
            </div>
        </div>

        {/* INSIGHT STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <div className="bg-rose-50 dark:bg-rose-900/10 p-4 rounded-2xl border border-rose-100 dark:border-rose-900/30">
                <p className="text-[10px] font-bold uppercase text-rose-400 tracking-wider">
                    {barView === 'category' ? 'Rata-Rata per Kategori' : `Rata-Rata ${barView === 'daily' ? 'Harian' : 'Mingguan'}`}
                </p>
                <p className="text-lg font-black text-rose-600 dark:text-rose-400 mt-1 truncate">
                    {rupiah(barStats.avg)}
                </p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/10 p-4 rounded-2xl border border-orange-100 dark:border-orange-900/30">
                <p className="text-[10px] font-bold uppercase text-orange-400 tracking-wider truncate">
                    {barView === 'category' ? 'Paling Boros' : 'Tertinggi'} ({barStats.maxLabel})
                </p>
                <p className="text-lg font-black text-orange-600 dark:text-orange-400 mt-1 truncate">
                    {rupiah(barStats.max)}
                </p>
            </div>
        </div>

        {/* BAR CHART */}
        <div className="h-[250px] md:h-[300px]">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" strokeOpacity={0.1} />
                    <XAxis 
                        dataKey="label" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill: '#9CA3AF', fontSize: 10}} 
                        interval={barView === 'category' ? 0 : 'preserveStartEnd'}
                        minTickGap={10}
                    />
                    <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill: '#9CA3AF', fontSize: 10}} 
                        tickFormatter={(value) => `${value / 1000}k`} 
                        width={35}
                    />
                    <Tooltip 
                        content={<CustomTooltip />} 
                        cursor={{fill: 'rgba(0,0,0,0.05)'}} 
                    />
                    <Bar 
                        dataKey="amount" 
                        fill={barView === 'category' ? '#F59E0B' : '#F43F5E'} 
                        radius={[6, 6, 0, 0]} 
                        maxBarSize={50} 
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
      </div>
      )}

      {/* --- TABEL DATA --- */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
        
        {/* FILTER TAB */}
        <div className="flex gap-2 p-4 border-b border-gray-100 dark:border-gray-700 overflow-x-auto bg-gray-50/50 dark:bg-gray-800">
          {['all', 'income', 'expense'].map((t) => (
            <button
              key={t}
              onClick={() => { setTypeFilter(t); setCurrentPage(1); }}
              className={`px-5 py-2 rounded-xl text-xs font-bold capitalize transition-all ${
                typeFilter === t 
                  ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-md ring-1 ring-indigo-100 dark:ring-indigo-900' 
                  : 'text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {t === 'all' ? 'Semua' : (t === 'income' ? 'Pemasukan' : 'Pengeluaran')}
            </button>
          ))}
        </div>

        {/* DESKTOP TABLE */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-white dark:bg-gray-800 text-gray-400 text-[10px] uppercase font-bold tracking-wider border-b border-gray-100 dark:border-gray-700">
              <tr>
                <th className="px-6 py-4 text-left cursor-pointer hover:text-indigo-500" onClick={() => handleSort('transaction_date')}>Tanggal ↕</th>
                <th className="px-6 py-4 text-left">Kategori</th>
                <th className="px-6 py-4 text-left">Deskripsi</th>
                <th className="px-6 py-4 text-right cursor-pointer hover:text-indigo-500" onClick={() => handleSort('amount')}>Nominal ↕</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              <AnimatePresence mode='wait'>
                {paginatedData.length === 0 ? (
                  <tr><td colSpan="5" className="text-center py-12 text-gray-400">Tidak ada data ditemukan</td></tr>
                ) : (
                  paginatedData.map((t) => {
                     // FIX: Handle Category Array/Object
                     const catName = Array.isArray(t.categories) ? t.categories[0]?.name : t.categories?.name;
                     const catType = Array.isArray(t.categories) ? t.categories[0]?.type : t.categories?.type;

                    return (
                    <motion.tr 
                      key={t.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      whileHover={{ backgroundColor: "rgba(0,0,0,0.02)" }}
                      className="group transition-colors dark:hover:bg-gray-700/50"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-600 dark:text-gray-300">{formatDate(t.transaction_date)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${getBadgeColor(catType)}`}>
                          {catName || 'Umum'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{t.description}</td>
                      <td className={`px-6 py-4 text-sm font-bold text-right ${catType === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {catType === 'income' ? '+' : '-'} {rupiah(t.amount)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEdit(t)} className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 flex items-center justify-center">✎</button>
                          <button onClick={() => handleDelete(t.id)} className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 flex items-center justify-center">✕</button>
                        </div>
                      </td>
                    </motion.tr>
                  )})
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* MOBILE LIST */}
        <div className="md:hidden">
          <AnimatePresence>
            {paginatedData.length === 0 ? (
              <div className="text-center py-10 text-gray-400">Tidak ada data</div>
            ) : (
              paginatedData.map((t) => {
                 const catName = Array.isArray(t.categories) ? t.categories[0]?.name : t.categories?.name;
                 const catType = Array.isArray(t.categories) ? t.categories[0]?.type : t.categories?.type;
                 
                 return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center active:bg-gray-50 dark:active:bg-gray-700"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm ${catType === 'income' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'}`}>
                      {catType === 'income' ? '💰' : '💸'}
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 dark:text-gray-100 text-sm capitalize">
                        {t.description || 'Tanpa Keterangan'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                        {formatDate(t.transaction_date)} • 
                        <span className="font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide">
                          {catName || 'Umum'}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-black text-sm ${catType === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {rupiah(t.amount)}
                    </p>
                    <div className="flex justify-end gap-3 mt-2">
                      <button onClick={() => handleEdit(t)} className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wide">EDIT</button>
                      <button onClick={() => handleDelete(t.id)} className="text-[10px] font-bold text-rose-500 dark:text-rose-400 uppercase tracking-wide">HAPUS</button>
                    </div>
                  </div>
                </motion.div>
              )})
            )}
          </AnimatePresence>
        </div>

        {/* PAGINATION */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800">
          <button 
            disabled={currentPage === 1} onClick={() => setCurrentPage(c => c - 1)}
            className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-bold disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-600 shadow-sm dark:text-white"
          >
            ← Prev
          </button>
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Halaman {currentPage} / {totalPages || 1}</span>
          <button 
            disabled={currentPage >= totalPages} onClick={() => setCurrentPage(c => c + 1)}
            className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-bold disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-600 shadow-sm dark:text-white"
          >
            Next →
          </button>
        </div>

      </div>
    </div>
  );
}