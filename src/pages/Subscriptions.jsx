import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format, startOfMonth, endOfMonth, isSameMonth, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

export default function Subscriptions() {
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    category_id: '',
    payment_method: 'cash',
    due_date: '1'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const start = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const end = format(endOfMonth(new Date()), 'yyyy-MM-dd');

    // 1. Ambil Master Langganan
    const { data: subsData } = await supabase
      .from('subscriptions')
      .select('*, categories(name)')
      .order('due_date', { ascending: true });

    // 2. Ambil Transaksi Bulan Ini (Untuk pengecekan)
    const { data: transData } = await supabase
      .from('transactions')
      .select('description, transaction_date')
      .gte('transaction_date', start)
      .lte('transaction_date', end);

    // 3. Ambil Kategori (Untuk dropdown form)
    const { data: catData } = await supabase
      .from('categories')
      .select('*')
      .eq('type', 'expense'); // Langganan biasanya pengeluaran

    // 4. GABUNGKAN LOGIKA (Cek Status Bayar)
    const mergedData = subsData?.map(sub => {
      // Cek apakah ada transaksi bulan ini yang DESKRIPSINYA sama dengan NAMA langganan
      const isPaid = transData.some(t => 
        t.description.toLowerCase() === sub.name.toLowerCase()
      );
      
      return { ...sub, isPaid };
    });

    setSubscriptions(mergedData || []);
    setCategories(catData || []);
    setLoading(false);
  };

  // --- FUNGSI TAMBAH LANGGANAN ---
  const handleAdd = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('subscriptions').insert([formData]);
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Langganan disimpan!');
      setIsFormOpen(false);
      setFormData({ name: '', amount: '', category_id: '', payment_method: 'cash', due_date: '1' });
      fetchData();
    }
  };

  // --- FUNGSI HAPUS LANGGANAN ---
  const handleDelete = async (id) => {
    if(!confirm('Hapus langganan ini?')) return;
    const { error } = await supabase.from('subscriptions').delete().eq('id', id);
    if (!error) {
      toast.success('Dihapus!');
      fetchData();
    }
  };

  // --- FUNGSI BAYAR SEKARANG (AUTO CREATE TRANSACTION) ---
  const handlePayNow = async (sub) => {
    const today = new Date();
    // Gunakan tanggal jatuh tempo bulan ini sebagai tanggal transaksi
    // Atau gunakan hari ini (tergantung preferensi, di sini kita pakai hari ini)
    const txDate = format(today, 'yyyy-MM-dd');

    const newTx = {
      amount: sub.amount,
      category_id: sub.category_id,
      description: sub.name, // Penting! Nama harus sama agar terdeteksi "Paid"
      payment_method: sub.payment_method,
      transaction_date: txDate,
      user_id: user.id
    };

    const { error } = await supabase.from('transactions').insert([newTx]);

    if (error) {
      toast.error('Gagal proses bayar: ' + error.message);
    } else {
      toast.success(`Berhasil bayar ${sub.name}!`);
      fetchData(); // Refresh agar status berubah jadi "Lunas"
    }
  };

  const rupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Langganan Rutin</h2>
          <p className="text-sm text-gray-500">Jangan sampai telat bayar tagihan.</p>
        </div>
        <button 
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold shadow-md hover:bg-indigo-700 transition-colors"
        >
          {isFormOpen ? 'Tutup Form' : '+ Tambah Baru'}
        </button>
      </div>

      {/* FORM INPUT (Muncul jika tombol diklik) */}
      <AnimatePresence>
        {isFormOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-8"
          >
            <form onSubmit={handleAdd} className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Tagihan</label>
                <input type="text" placeholder="Contoh: Netflix, Listrik" className="w-full p-2 border rounded-lg" required
                  value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nominal Rutin</label>
                <input type="number" placeholder="0" className="w-full p-2 border rounded-lg" required
                  value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Kategori</label>
                <select className="w-full p-2 border rounded-lg bg-white" required
                  value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})}>
                  <option value="">-- Pilih --</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sumber Dana</label>
                <select className="w-full p-2 border rounded-lg bg-white" 
                  value={formData.payment_method} onChange={e => setFormData({...formData, payment_method: e.target.value})}>
                  <option value="cash">cash</option>
                  <option value="Tf mandiri">Tf mandiri</option>
                  <option value="Tf blu bca">Tf blu bca</option>
                </select>
              </div>
              <div className="md:col-span-2 flex gap-4 items-center">
                <div className="w-1/3">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tgl Jatuh Tempo</label>
                  <input type="number" min="1" max="31" className="w-full p-2 border rounded-lg" required
                    value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} />
                </div>
                <button type="submit" className="w-2/3 mt-5 bg-orange-500 text-white py-2 rounded-lg font-bold hover:bg-orange-600">
                  Simpan Langganan
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LIST LANGGANAN */}
      <div className="grid gap-4">
        {loading ? <p className="text-center">Memuat data...</p> : subscriptions.map(sub => (
          <div key={sub.id} className={`bg-white p-4 rounded-xl shadow-sm border-l-4 flex flex-col sm:flex-row justify-between items-center gap-4 ${sub.isPaid ? 'border-green-500 opacity-70' : 'border-red-500'}`}>
            
            {/* Info Kiri */}
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className={`w-12 h-12 rounded-full flex flex-col items-center justify-center font-bold text-white shadow-md ${sub.isPaid ? 'bg-green-500' : 'bg-red-500'}`}>
                <span className="text-xs">TGL</span>
                <span className="text-lg leading-none">{sub.due_date}</span>
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-lg">{sub.name}</h3>
                <p className="text-sm text-gray-500">{sub.categories?.name} • via {sub.payment_method}</p>
              </div>
            </div>

            {/* Info Kanan & Aksi */}
            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
              <div className="text-right">
                <p className="text-xs text-gray-400 uppercase font-bold">Tagihan</p>
                <p className="text-lg font-black text-gray-800">{rupiah(sub.amount)}</p>
              </div>

              {sub.isPaid ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg font-bold">
                  <span>✓ Lunas</span>
                  <button onClick={() => handleDelete(sub.id)} className="text-gray-400 hover:text-red-500 ml-2">🗑️</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button 
                    onClick={() => handlePayNow(sub)}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold shadow-md transition-transform active:scale-95 whitespace-nowrap"
                  >
                    Bayar
                  </button>
                  <button onClick={() => handleDelete(sub.id)} className="px-3 py-2 bg-gray-100 hover:bg-red-100 text-gray-400 hover:text-red-500 rounded-lg transition-colors">
                    🗑️
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {subscriptions.length === 0 && !loading && (
          <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-500">
            Belum ada langganan. Klik tombol Tambah Baru di atas!
          </div>
        )}
      </div>
    </div>
  );
}