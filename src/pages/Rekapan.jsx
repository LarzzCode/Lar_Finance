import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, format } from 'date-fns';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion'; // Import Framer Motion
import EditModal from '../components/EditModal';

export default function Rekapan() {
  const [filter, setFilter] = useState('monthly');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // STATE BARU: Pagination & Tipe Filter
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'income', 'expense'

  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });
  const [chartData, setChartData] = useState([]);
  const [dailyData, setDailyData] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'transaction_date', direction: 'desc' });

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editData, setEditData] = useState(null);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF4560'];

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

  // --- LOGIKA UTAMA (FILTER + SORT + PAGINATION) ---
  const filteredData = transactions.filter((t) => {
    // 1. Filter Search Text
    const query = searchQuery.toLowerCase();
    const desc = (t.description || '').toLowerCase();
    const cat = (t.categories?.name || '').toLowerCase();
    const matchSearch = desc.includes(query) || cat.includes(query);

    // 2. Filter Tipe (Income/Expense)
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
    return b.id - a.id; 
  });

  // 3. Logic Pagination
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const paginatedData = sortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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
    const pieArray = Object.keys(groupedCategory).map(key => ({ name: key, value: groupedCategory[key] }));
    setChartData(pieArray);

    const groupedDate = data.reduce((acc, curr) => {
      const date = format(new Date(curr.transaction_date), 'dd/MM');
      if (!acc[date]) acc[date] = { date, income: 0, expense: 0 };
      if (curr.categories?.type === 'income') acc[date].income += Number(curr.amount);
      else acc[date].expense += Number(curr.amount);
      return acc;
    }, {});
    const barArray = Object.values(groupedDate).reverse(); 
    setDailyData(barArray);
  };

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
    if (window.confirm('Yakin ingin menghapus data ini?')) {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) toast.error('Gagal hapus: ' + error.message);
      else {
        toast.success('Dihapus');
        fetchData();
      }
    }
  };

  const handleEdit = (transaction) => {
    setEditData(transaction);
    setIsEditOpen(true);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const rupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  const formatDate = (dateString) => format(new Date(dateString), 'dd/MM/yyyy');

  const getBadgeColor = (type) => type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';

  return (
    <div className="min-h-screen w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 md:pt-24 md:pb-8">
      
      <EditModal 
        isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} transaction={editData} onSuccess={fetchData} 
      />

      {/* HEADER CONTROLS */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800">Dashboard</h2>
            <button onClick={handleExport} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow hover:bg-green-700">Export Excel</button>
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            <input 
              type="text" placeholder="Cari transaksi..."
              className="flex-grow p-2 border rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none"
              value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            />
            <div className="flex gap-2">
              <select value={filter} onChange={(e) => setFilter(e.target.value)} className="p-2 border rounded-xl text-sm bg-white">
                <option value="weekly">Mingguan</option>
                <option value="monthly">Bulanan</option>
                <option value="yearly">Tahunan</option>
              </select>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="p-2 border rounded-xl text-sm bg-white" />
            </div>
          </div>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-green-50 p-3 rounded-2xl border border-green-100 text-center">
          <p className="text-xs text-green-600 font-bold uppercase">Masuk</p>
          <p className="text-sm sm:text-lg font-black text-green-700">{rupiah(summary.income)}</p>
        </div>
        <div className="bg-red-50 p-3 rounded-2xl border border-red-100 text-center">
          <p className="text-xs text-red-600 font-bold uppercase">Keluar</p>
          <p className="text-sm sm:text-lg font-black text-red-700">{rupiah(summary.expense)}</p>
        </div>
        <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100 text-center">
          <p className="text-xs text-blue-600 font-bold uppercase">Sisa</p>
          <p className="text-sm sm:text-lg font-black text-blue-700">{rupiah(summary.balance)}</p>
        </div>
      </div>

      {/* GRAFIK */}
      {searchQuery === '' && (
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {chartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                </Pie>
                <Tooltip formatter={(value) => rupiah(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 h-64">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={dailyData}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} />
                 <XAxis dataKey="date" fontSize={10} />
                 <Tooltip formatter={(value) => rupiah(value)} />
                 <Bar dataKey="income" fill="#10B981" radius={[4, 4, 0, 0]} />
                 <Bar dataKey="expense" fill="#EF4444" radius={[4, 4, 0, 0]} />
               </BarChart>
             </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* LIST TRANSAKSI INTERAKTIF */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        
        {/* TAB FILTER CHIPS */}
        <div className="flex gap-2 p-4 border-b border-gray-100 overflow-x-auto">
          {['all', 'income', 'expense'].map((t) => (
            <button
              key={t}
              onClick={() => { setTypeFilter(t); setCurrentPage(1); }}
              className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-all ${
                typeFilter === t 
                  ? 'bg-gray-900 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {t === 'all' ? 'Semua' : (t === 'income' ? 'Pemasukan' : 'Pengeluaran')}
            </button>
          ))}
        </div>

        {/* --- TAMPILAN TABLE (DESKTOP) --- */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-3 text-left cursor-pointer hover:text-orange-500" onClick={() => handleSort('transaction_date')}>Tanggal</th>
                <th className="px-6 py-3 text-left">Kategori</th>
                <th className="px-6 py-3 text-left">Deskripsi</th>
                <th className="px-6 py-3 text-right cursor-pointer hover:text-orange-500" onClick={() => handleSort('amount')}>Nominal</th>
                <th className="px-6 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <AnimatePresence mode='wait'>
                {paginatedData.length === 0 ? (
                  <tr><td colSpan="5" className="text-center py-10 text-gray-400">Tidak ada data</td></tr>
                ) : (
                  paginatedData.map((t) => (
                    <motion.tr 
                      key={t.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      whileHover={{ backgroundColor: "#F9FAFB", scale: 1.005 }} // Efek Hover Interaktif
                      className="group transition-all"
                    >
                      <td className="px-6 py-4 text-sm text-gray-600">{formatDate(t.transaction_date)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${getBadgeColor(t.categories?.type)}`}>
                          {t.categories?.name}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{t.description}</td>
                      <td className={`px-6 py-4 text-sm font-bold text-right ${t.categories?.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {t.categories?.type === 'income' ? '+' : '-'} {rupiah(t.amount)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEdit(t)} className="text-blue-500 hover:bg-blue-50 p-1 rounded">✏️</button>
                          <button onClick={() => handleDelete(t.id)} className="text-red-500 hover:bg-red-50 p-1 rounded">🗑️</button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* --- TAMPILAN KARTU (MOBILE) --- */}
        <div className="md:hidden">
          <AnimatePresence>
            {paginatedData.length === 0 ? (
              <div className="text-center py-10 text-gray-400">Tidak ada data</div>
            ) : (
              paginatedData.map((t) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="p-4 border-b border-gray-100 flex justify-between items-center active:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${t.categories?.type === 'income' ? 'bg-green-100' : 'bg-red-100'}`}>
                      {t.categories?.type === 'income' ? '💰' : '💸'}
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 text-sm">{t.categories?.name}</p>
                      <p className="text-xs text-gray-400">{formatDate(t.transaction_date)} • {t.description || '-'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-sm ${t.categories?.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {rupiah(t.amount)}
                    </p>
                    <div className="flex justify-end gap-3 mt-1">
                      <button onClick={() => handleEdit(t)} className="text-[10px] font-bold text-blue-500">EDIT</button>
                      <button onClick={() => handleDelete(t.id)} className="text-[10px] font-bold text-red-500">HAPUS</button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* PAGINATION CONTROLS */}
        <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-gray-50">
          <button 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(c => c - 1)}
            className="px-3 py-1 bg-white border rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-gray-100"
          >
            ← Prev
          </button>
          <span className="text-xs font-medium text-gray-500">Hal {currentPage} dari {totalPages || 1}</span>
          <button 
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage(c => c + 1)}
            className="px-3 py-1 bg-white border rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-gray-100"
          >
            Next →
          </button>
        </div>

      </div>
    </div>
  );
}