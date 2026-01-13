import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });
  
  // Data untuk Grafik
  const [categoryData, setCategoryData] = useState([]);
  const [dailyData, setDailyData] = useState([]);

  // Warna Grafik Pie (Cantik & Modern)
  const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1'];

  useEffect(() => {
    fetchReportData();
  }, [selectedDate]);

  const fetchReportData = async () => {
    setLoading(true);
    const start = format(startOfMonth(selectedDate), 'yyyy-MM-dd');
    const end = format(endOfMonth(selectedDate), 'yyyy-MM-dd');

    // Ambil Transaksi Bulan Ini
    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount, transaction_date, categories(name, type)')
      .gte('transaction_date', start)
      .lte('transaction_date', end);

    if (!transactions) {
      setLoading(false);
      return;
    }

    // 1. HITUNG SUMMARY (Kartu Atas)
    let inc = 0, exp = 0;
    transactions.forEach(t => {
      const amount = Number(t.amount);
      if (t.categories?.type === 'income') inc += amount;
      else exp += amount;
    });
    setSummary({ income: inc, expense: exp, balance: inc - exp });

    // 2. OLAH DATA UNTUK PIE CHART (Pengeluaran per Kategori)
    const expenseTx = transactions.filter(t => t.categories?.type === 'expense');
    const groupedCat = expenseTx.reduce((acc, curr) => {
      const catName = curr.categories?.name || 'Lainnya';
      acc[catName] = (acc[catName] || 0) + Number(curr.amount);
      return acc;
    }, {});

    const pieData = Object.keys(groupedCat).map(key => ({
      name: key,
      value: groupedCat[key]
    })).sort((a, b) => b.value - a.value); // Urutkan dari yang terbesar

    setCategoryData(pieData);

    // 3. OLAH DATA UNTUK BAR CHART (Harian)
    const daysInMonth = eachDayOfInterval({ start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) });
    
    const chartData = daysInMonth.map(day => {
      const dayTx = transactions.filter(t => isSameDay(parseISO(t.transaction_date), day));
      
      const dayInc = dayTx
        .filter(t => t.categories?.type === 'income')
        .reduce((sum, t) => sum + Number(t.amount), 0);
        
      const dayExp = dayTx
        .filter(t => t.categories?.type === 'expense')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      return {
        date: format(day, 'd'), // Tanggal (1, 2, 3...)
        Pemasukan: dayInc,
        Pengeluaran: dayExp
      };
    });

    setDailyData(chartData);
    setLoading(false);
  };

  const rupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

  // Custom Tooltip untuk Grafik (Agar hover-nya cantik)
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/90 backdrop-blur-md p-3 border border-gray-100 rounded-xl shadow-lg text-xs">
          <p className="font-bold text-gray-700 mb-1">Tgl {label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="font-medium">
              {entry.name}: {rupiah(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen w-full max-w-4xl mx-auto px-4 pt-20 pb-24 md:pt-24 md:pb-8 bg-gray-50/50">
      
      {/* HEADER & MONTH PICKER */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-black text-gray-800">Laporan Keuangan</h2>
          <p className="text-sm text-gray-500">Analisis arus kasmu.</p>
        </div>
        <input 
          type="month" 
          className="bg-white border border-gray-200 text-gray-700 text-sm font-bold rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-200 shadow-sm"
          value={format(selectedDate, 'yyyy-MM')}
          onChange={(e) => setSelectedDate(new Date(e.target.value))}
        />
      </div>

      {/* 1. SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Pemasukan */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white p-5 rounded-3xl shadow-sm border border-emerald-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-50 rounded-full -mr-5 -mt-5" />
          <p className="text-xs font-bold text-emerald-500 uppercase relative z-10">Pemasukan</p>
          <p className="text-xl font-black text-gray-800 mt-1 relative z-10">{rupiah(summary.income)}</p>
        </motion.div>

        {/* Pengeluaran */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="bg-white p-5 rounded-3xl shadow-sm border border-rose-100 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-20 h-20 bg-rose-50 rounded-full -mr-5 -mt-5" />
          <p className="text-xs font-bold text-rose-500 uppercase relative z-10">Pengeluaran</p>
          <p className="text-xl font-black text-gray-800 mt-1 relative z-10">{rupiah(summary.expense)}</p>
        </motion.div>

        {/* Sisa Saldo */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className={`bg-white p-5 rounded-3xl shadow-sm border relative overflow-hidden ${summary.balance < 0 ? 'border-red-200' : 'border-blue-100'}`}>
           <div className={`absolute top-0 right-0 w-20 h-20 rounded-full -mr-5 -mt-5 ${summary.balance < 0 ? 'bg-red-50' : 'bg-blue-50'}`} />
          <p className={`text-xs font-bold uppercase relative z-10 ${summary.balance < 0 ? 'text-red-500' : 'text-blue-500'}`}>
            {summary.balance < 0 ? 'Defisit (Boncos)' : 'Surplus (Aman)'}
          </p>
          <p className={`text-xl font-black mt-1 relative z-10 ${summary.balance < 0 ? 'text-red-600' : 'text-blue-600'}`}>
            {rupiah(summary.balance)}
          </p>
        </motion.div>
      </div>

      {/* 2. MAIN CHART: HARIAN (Bar Chart) */}
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3 }}
        className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6"
      >
        <h3 className="font-bold text-gray-700 mb-4 text-sm">Grafik Harian</h3>
        <div className="h-[250px] w-full text-xs">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF'}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF'}} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Pemasukan" fill="#10B981" radius={[4, 4, 0, 0]} barSize={8} />
              <Bar dataKey="Pengeluaran" fill="#F43F5E" radius={[4, 4, 0, 0]} barSize={8} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* 3. BREAKDOWN: KATEGORI & LIST (Grid Layout) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Pie Chart (Donut) */}
        <motion.div 
          initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.4 }}
          className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center justify-center min-h-[300px]"
        >
          <h3 className="font-bold text-gray-700 mb-2 text-sm w-full text-left">Komposisi Pengeluaran</h3>
          {categoryData.length > 0 ? (
            <div className="w-full h-[200px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%" cy="50%"
                    innerRadius={60} outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => rupiah(value)} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                </PieChart>
              </ResponsiveContainer>
              {/* Text Tengah Donut */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs text-gray-400 font-bold">Total</span>
                <span className="text-sm font-black text-gray-800">{rupiah(summary.expense)}</span>
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">Belum ada pengeluaran.</p>
          )}
        </motion.div>

        {/* Top Spending List */}
        <motion.div 
          initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.5 }}
          className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100"
        >
          <h3 className="font-bold text-gray-700 mb-4 text-sm">Detail Kategori</h3>
          <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
            {categoryData.length > 0 ? categoryData.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }} 
                  />
                  <span className="text-sm font-medium text-gray-600">{item.name}</span>
                </div>
                <div className="text-right">
                  <span className="block text-sm font-bold text-gray-800">{rupiah(item.value)}</span>
                  <span className="text-[10px] text-gray-400">
                    {Math.round((item.value / summary.expense) * 100)}%
                  </span>
                </div>
              </div>
            )) : (
              <p className="text-gray-400 text-xs italic">Data kosong.</p>
            )}
          </div>
        </motion.div>

      </div>

    </div>
  );
}