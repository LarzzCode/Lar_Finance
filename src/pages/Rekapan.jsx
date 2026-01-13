import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, format } from 'date-fns';
import { 
  PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Sector 
} from 'recharts';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion'; 
import EditModal from '../components/EditModal';

// --- KOMPONEN CHART CUSTOM ---

// 1. Render Active Shape (HANYA UNTUK DESKTOP)
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
      <text x={cx} y={cy} dy={8} textAnchor="middle" fill="#374151" className="text-sm font-bold">
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
      <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="#333" fontSize={12} fontWeight="bold">{`Rp ${new Intl.NumberFormat('id-ID').format(value)}`}</text>
      <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={18} textAnchor={textAnchor} fill="#999" fontSize={10}>
        {`(${(percent * 100).toFixed(0)}%)`}
      </text>
    </g>
  );
};

// 2. Render Active Shape (MOBILE: Cuma membesar dikit, tanpa teks terbang)
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
  const [activeIndex, setActiveIndex] = useState(0); 

  const [sortConfig, setSortConfig] = useState({ key: 'transaction_date', direction: 'desc' });
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editData, setEditData] = useState(null);

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  // DETEKSI UKURAN LAYAR (Untuk Responsif Chart)
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchData();
  }, [filter, selectedDate]);

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
      const dateObj = new Date(t.transaction_date);
      return {
        'No': index + 1,
        'Date': format(dateObj, 'dd/MM/yyyy'),
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
  const getBadgeColor = (type) => type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700';

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/90 backdrop-blur shadow-lg border border-gray-100 p-3 rounded-xl text-xs">
          <p className="font-bold mb-1 text-gray-500">{label}</p>
          <p className="text-emerald-600 font-bold">Masuk: {rupiah(payload[0].value)}</p>
          <p className="text-rose-600 font-bold">Keluar: {rupiah(payload[1].value)}</p>
        </div>
      );
    }
    return null;
  };

  // Helper untuk menampilkan Data Tengah Donut (Mobile Only)
  const activeItem = chartData[activeIndex] || {};

  return (
    <div className="min-h-screen w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 md:pt-24 md:pb-8">
      <EditModal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} transaction={editData} onSuccess={fetchData} />

      {/* HEADER CONTROLS */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div>
                <h2 className="text-2xl font-black text-gray-800">Laporan Keuangan</h2>
                <p className="text-sm text-gray-400">Analisis cashflow mendalam.</p>
            </div>
            <button onClick={handleExport} className="bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-black transition-all">
                Export
            </button>
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            <input 
              type="text" placeholder="Cari transaksi..."
              className="flex-grow p-3 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50 focus:bg-white transition-colors"
              value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            />
            <div className="flex gap-2">
              <select value={filter} onChange={(e) => setFilter(e.target.value)} className="p-3 border rounded-xl text-sm bg-white font-bold text-gray-600">
                <option value="weekly">Mingguan</option>
                <option value="monthly">Bulanan</option>
                <option value="yearly">Tahunan</option>
              </select>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="p-3 border rounded-xl text-sm bg-white font-bold text-gray-600" />
            </div>
          </div>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-emerald-100 relative overflow-hidden group">
          <p className="text-xs text-emerald-500 font-bold uppercase tracking-wider">Total Pemasukan</p>
          <p className="text-2xl font-black text-gray-800 mt-1">{rupiah(summary.income)}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-rose-100 relative overflow-hidden group">
          <p className="text-xs text-rose-500 font-bold uppercase tracking-wider">Total Pengeluaran</p>
          <p className="text-2xl font-black text-gray-800 mt-1">{rupiah(summary.expense)}</p>
        </div>
        <div className={`bg-white p-6 rounded-3xl shadow-sm border relative overflow-hidden ${summary.balance < 0 ? 'border-red-200' : 'border-blue-100'}`}>
          <p className={`text-xs font-bold uppercase tracking-wider ${summary.balance < 0 ? 'text-red-500' : 'text-blue-500'}`}>Sisa Saldo</p>
          <p className={`text-2xl font-black mt-1 ${summary.balance < 0 ? 'text-red-600' : 'text-blue-600'}`}>{rupiah(summary.balance)}</p>
        </div>
      </div>

      {searchQuery === '' && (
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          
          {/* 1. AREA CHART */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-[400px]">
            <h3 className="font-bold text-gray-700 mb-6 flex items-center gap-2">
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
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 11}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 11}} tickFormatter={(value) => `${value / 1000}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="income" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" />
                <Area type="monotone" dataKey="expense" stroke="#EF4444" strokeWidth={3} fillOpacity={1} fill="url(#colorExpense)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* 2. INTERACTIVE DONUT CHART (FIX MOBILE) */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-[400px] relative">
             <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
                <span className="w-2 h-6 bg-orange-500 rounded-full"></span>
                Komposisi Pengeluaran
            </h3>
            {chartData.length > 0 ? (
                <>
                <ResponsiveContainer width="100%" height="90%">
                <PieChart>
                    <Pie
                        activeIndex={activeIndex}
                        // DISINI KUNCINYA: Jika Mobile, pakai shape sederhana. Jika Desktop, pakai yg terbang.
                        activeShape={isMobile ? renderActiveShapeMobile : renderActiveShapeDesktop} 
                        data={chartData}
                        cx="50%" cy="50%"
                        innerRadius={isMobile ? 60 : 70} 
                        outerRadius={isMobile ? 80 : 90}
                        paddingAngle={4}
                        dataKey="value"
                        onMouseEnter={(_, index) => setActiveIndex(index)}
                        onClick={(_, index) => setActiveIndex(index)} // Klik juga trigger di mobile
                    >
                    {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                    ))}
                    </Pie>
                </PieChart>
                </ResponsiveContainer>

                {/* INFO TENGAH DONUT (KHUSUS MOBILE) */}
                {/* Ini solusi agar tulisan tidak keluar layar */}
                {isMobile && activeItem.name && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-6">
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wide text-center max-w-[120px] truncate">
                            {activeItem.name}
                        </p>
                        <p className="text-lg font-black text-gray-800">
                            {rupiah(activeItem.value)}
                        </p>
                        <p className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full mt-1">
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

      {/* --- TABEL DATA --- */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        
        {/* FILTER TAB */}
        <div className="flex gap-2 p-4 border-b border-gray-100 overflow-x-auto bg-gray-50/50">
          {['all', 'income', 'expense'].map((t) => (
            <button
              key={t}
              onClick={() => { setTypeFilter(t); setCurrentPage(1); }}
              className={`px-5 py-2 rounded-xl text-xs font-bold capitalize transition-all ${
                typeFilter === t 
                  ? 'bg-white text-indigo-600 shadow-md ring-1 ring-indigo-100' 
                  : 'text-gray-500 hover:bg-white hover:text-gray-700'
              }`}
            >
              {t === 'all' ? 'Semua' : (t === 'income' ? 'Pemasukan' : 'Pengeluaran')}
            </button>
          ))}
        </div>

        {/* DESKTOP TABLE */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-white text-gray-400 text-[10px] uppercase font-bold tracking-wider border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-left cursor-pointer hover:text-indigo-500" onClick={() => handleSort('transaction_date')}>Tanggal ↕</th>
                <th className="px-6 py-4 text-left">Kategori</th>
                <th className="px-6 py-4 text-left">Deskripsi</th>
                <th className="px-6 py-4 text-right cursor-pointer hover:text-indigo-500" onClick={() => handleSort('amount')}>Nominal ↕</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <AnimatePresence mode='wait'>
                {paginatedData.length === 0 ? (
                  <tr><td colSpan="5" className="text-center py-12 text-gray-400">Tidak ada data ditemukan</td></tr>
                ) : (
                  paginatedData.map((t) => (
                    <motion.tr 
                      key={t.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      whileHover={{ backgroundColor: "#F8FAFC" }}
                      className="group transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-600">{formatDate(t.transaction_date)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${getBadgeColor(t.categories?.type)}`}>
                          {t.categories?.name}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{t.description}</td>
                      <td className={`px-6 py-4 text-sm font-bold text-right ${t.categories?.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {t.categories?.type === 'income' ? '+' : '-'} {rupiah(t.amount)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEdit(t)} className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center">✎</button>
                          <button onClick={() => handleDelete(t.id)} className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center">✕</button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* MOBILE LIST (Yang sudah diperbaiki deskripsinya) */}
        <div className="md:hidden">
          <AnimatePresence>
            {paginatedData.length === 0 ? (
              <div className="text-center py-10 text-gray-400">Tidak ada data</div>
            ) : (
              paginatedData.map((t) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="p-5 border-b border-gray-100 flex justify-between items-center active:bg-gray-50"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm ${t.categories?.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                      {t.categories?.type === 'income' ? '💰' : '💸'}
                    </div>
                    <div>
                      {/* Deskripsi Jadi Judul Utama (Bold) */}
                      <p className="font-bold text-gray-800 text-sm capitalize">
                        {t.description || 'Tanpa Keterangan'}
                      </p>
                      {/* Kategori Jadi Subtitle */}
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                        {formatDate(t.transaction_date)} • 
                        <span className="font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide">
                          {t.categories?.name}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-black text-sm ${t.categories?.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {rupiah(t.amount)}
                    </p>
                    <div className="flex justify-end gap-3 mt-2">
                      <button onClick={() => handleEdit(t)} className="text-[10px] font-bold text-indigo-500 uppercase tracking-wide">EDIT</button>
                      <button onClick={() => handleDelete(t.id)} className="text-[10px] font-bold text-rose-500 uppercase tracking-wide">HAPUS</button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* PAGINATION */}
        <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-gray-50/50">
          <button 
            disabled={currentPage === 1} onClick={() => setCurrentPage(c => c - 1)}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold disabled:opacity-50 hover:bg-gray-50 shadow-sm"
          >
            ← Prev
          </button>
          <span className="text-xs font-bold text-gray-500">Halaman {currentPage} / {totalPages || 1}</span>
          <button 
            disabled={currentPage >= totalPages} onClick={() => setCurrentPage(c => c + 1)}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold disabled:opacity-50 hover:bg-gray-50 shadow-sm"
          >
            Next →
          </button>
        </div>

      </div>
    </div>
  );
}