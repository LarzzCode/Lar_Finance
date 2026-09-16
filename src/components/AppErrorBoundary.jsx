import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Lar Finance UI error:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="min-h-screen bg-[#F7F8FA] flex items-center justify-center px-4 text-slate-900">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-[2rem] p-7 text-center shadow-xl shadow-slate-900/5">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-5">
            <AlertTriangle size={25} />
          </div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Recovery mode</p>
          <h1 className="text-2xl font-black mt-2">Tampilan gagal dimuat.</h1>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">Data keuanganmu tetap berada di Supabase. Muat ulang aplikasi untuk mencoba lagi.</p>
          <button onClick={() => window.location.reload()} className="mt-6 w-full h-12 rounded-2xl bg-slate-950 text-white font-black inline-flex items-center justify-center gap-2">
            <RefreshCw size={17} /> Muat ulang
          </button>
        </div>
      </main>
    );
  }
}
