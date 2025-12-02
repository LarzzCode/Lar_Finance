import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, format } from 'date-fns';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';
// IMPORT LIBRARY EXCEL
import * as XLSX from 'xlsx';
import EditModal from '../components/EditModal';

export default function Rekapan() {
  const [filter, setFilter] = useState('monthly');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
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
      .lte('transaction_date', end);

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

    const pieArray = Object.keys(groupedCategory).map(key => ({
      name: key,
      value: groupedCategory[key]
    }));
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

  // --- FITUR BARU: EXPORT TO EXCEL ---
  const handleExport = () => {
    // 1. Format Data Sesuai Request (No, Date, Day, Description, Category, Payment, Nominal)
    const dataToExport = sortedTransactions.map((t, index) => {
      const dateObj = new Date(t.transaction_date);
      // Mendapatkan Nama Hari Indonesia (Senin, Selasa...)
      const dayName = dateObj.toLocaleDateString('id-ID', { weekday: 'long' });
      
      return {
        'No': index + 1,
        'Date': format(dateObj, 'dd/MM/yyyy'),
        'Day': dayName,
        'Description': t.description,
        'Category': t.categories?.name,
        'Payment': t.payment_method || 'Cash', // Default Cash
        'Nominal': Number(t.amount) // Pastikan format angka
      };
    });

    // 2. Buat Worksheet & Workbook
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Keuangan");

    // 3. Atur Lebar Kolom (Biar Rapi)
    worksheet['!cols'] = [
      { wch: 5 },  // No
      { wch: 12 }, // Date
      { wch: 10 }, // Day
      { wch: 30 }, // Description
      { wch: 15 }, // Category
      { wch: 15 }, // Payment
      { wch: 15 }  // Nominal
    ];

    // 4. Download File
    const fileName = `Laporan_Keuangan_${filter}_${selectedDate}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast.success('File Excel berhasil didownload!');
  };

  const handleDelete = async (id) => {
    if (window.confirm('Yakin ingin menghapus data ini?')) {
      const { error } = await supabase.from('transactions').delete().eq('id', id);

      if (error) {
        toast.error('Gagal hapus: ' + error.message);
      } else {
        toast.success('Data berhasil dihapus');
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

  const sortedTransactions = [...transactions].sort((a, b) => {
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

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <span className="text-gray-300 ml-1">↕</span>;
    return sortConfig.direction === 'asc' ? <span className="text-orange-500 ml-1">↑</span> : <span className="text-orange-500 ml-1">↓</span>;
  };

  const rupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  const formatDate = (dateString) => format(new Date(dateString), 'dd/MM/yyyy');

  const getPeriodLabel = () => {
    const d = new Date(selectedDate);
    if (filter === 'weekly') return `Minggu: ${format(startOfWeek(d, { weekStartsOn: 1 }), 'dd MMM')} - ${format(endOfWeek(d, { weekStartsOn: 1 }), 'dd MMM yyyy')}`;
    if (filter === 'monthly') return `Periode: ${format(d, 'MMMM yyyy')}`;
    return `Periode Tahun: ${format(d, 'yyyy')}`;
  };

  const getBadgeColor = (type, name) => {
    if (type === 'income') return 'bg-green-100 text-green-800 border border-green-200';
    const colors = {
      'Makanan': 'bg-orange-100 text-orange-800',
      'Transport': 'bg-blue-100 text-blue-800',
      'Skincare': 'bg-pink-100 text-pink-800',
      'Internet': 'bg-purple-100 text-purple-800'
    };
    return colors[name] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      <EditModal 
        isOpen={isEditOpen} 
        onClose={() => setIsEditOpen(false)} 
        transaction={editData}
        onSuccess={fetchData} 
      />

      {/* HEADER CONTROLLER */}
      <div className="bg-white p-4 rounded-lg shadow mb-8 border border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Dashboard Visual</h2>
            <p className="text-sm text-gray-500 mt-1">{getPeriodLabel()}</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            {/* TOMBOL EXPORT EXCEL (BARU) */}
            <button
              onClick={handleExport}
              className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold shadow-md transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Export Excel
            </button>

            <select 
              value={filter} onChange={(e) => setFilter(e.target.value)}
              className="block py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
            >
              <option value="weekly">Per Minggu</option>
              <option value="monthly">Per Bulan</option>
              <option value="yearly">Per Tahun</option>
            </select>
            <input 
              type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
              className="block py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg border-l-4 border-green-500 p-5">
          <dt className="text-sm font-medium text-gray-500">Pemasukan</dt>
          <dd className="mt-1 text-2xl font-semibold text-green-600">{rupiah(summary.income)}</dd>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg border-l-4 border-red-500 p-5">
          <dt className="text-sm font-medium text-gray-500">Pengeluaran</dt>
          <dd className="mt-1 text-2xl font-semibold text-red-600">{rupiah(summary.expense)}</dd>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg border-l-4 border-blue-500 p-5">
          <dt className="text-sm font-medium text-gray-500">Sisa Saldo</dt>
          <dd className={`mt-1 text-3xl font-extrabold ${summary.balance < 0 ? 'text-red-600' : 'text-blue-600'}`}>
            {rupiah(summary.balance)}
          </dd>
        </div>
      </div>

      {/* GRAFIK */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
          <h3 className="text-lg font-bold text-gray-700 mb-4 text-center">Komposisi Pengeluaran</h3>
          <div className="h-64 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {chartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                  </Pie>
                  <Tooltip formatter={(value) => rupiah(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (<div className="flex items-center justify-center h-full text-gray-400">Data Kosong</div>)}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
          <h3 className="text-lg font-bold text-gray-700 mb-4 text-center">Tren Arus Kas</h3>
          <div className="h-64 w-full">
             {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" />
                  <YAxis hide />
                  <Tooltip formatter={(value) => rupiah(value)} />
                  <Legend />
                  <Bar dataKey="income" name="Masuk" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="Keluar" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
             ) : (<div className="flex items-center justify-center h-full text-gray-400">Data Kosong</div>)}
          </div>
        </div>
      </div>

      {/* TABEL TRANSAKSI */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-10">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Riwayat Transaksi</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th onClick={() => handleSort('transaction_date')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none">
                  Tanggal {getSortIcon('transaction_date')}
                </th>
                <th onClick={() => handleSort('category')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none">
                  Kategori {getSortIcon('category')}
                </th>
                <th onClick={() => handleSort('description')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none">
                  Deskripsi {getSortIcon('description')}
                </th>
                <th onClick={() => handleSort('payment_method')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none">
                  Metode {getSortIcon('payment_method')}
                </th>
                <th onClick={() => handleSort('amount')} className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none">
                  Nominal {getSortIcon('amount')}
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedTransactions.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-10 text-center text-gray-500">Tidak ada transaksi di periode ini.</td></tr>
              ) : (
                sortedTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(t.transaction_date)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getBadgeColor(t.categories?.type, t.categories?.name)}`}>
                        {t.categories?.name}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.description || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{t.payment_method || 'cash'}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-bold ${t.categories?.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {t.categories?.type === 'income' ? '+' : '-'} {rupiah(t.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleEdit(t)}
                          className="text-blue-600 hover:text-blue-900 bg-blue-50 p-2 rounded-lg transition-colors shadow-sm border border-blue-100"
                          title="Edit"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button 
                          onClick={() => handleDelete(t.id)}
                          className="text-red-600 hover:text-red-900 bg-red-50 p-2 rounded-lg transition-colors shadow-sm border border-red-100"
                          title="Hapus"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}