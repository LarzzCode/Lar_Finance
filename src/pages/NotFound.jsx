import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, SearchX } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-[#F7F8FA] flex items-center justify-center px-5 pb-24 md:pb-8">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-[2.5rem] p-8 md:p-12 text-center shadow-sm">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-slate-100 text-slate-700 flex items-center justify-center mb-6">
          <SearchX size={28} />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 mb-3">404 / Halaman tidak ditemukan</p>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">Sepertinya kamu salah jalan.</h1>
        <p className="text-slate-500 leading-relaxed mb-8">Halaman yang kamu cari mungkin sudah dipindahkan atau URL-nya tidak tersedia.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={() => navigate(-1)} className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full border border-slate-200 font-bold text-slate-600 hover:bg-slate-50">
            <ArrowLeft size={17} /> Kembali
          </button>
          <Link to="/" className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-slate-950 text-white font-bold hover:bg-black">
            <Home size={17} /> Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
