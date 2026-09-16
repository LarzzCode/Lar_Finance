import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles, WalletCards } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

export default function LoginV2() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const isRegister = mode === 'register';

  const handleAuth = async (event) => {
    event.preventDefault();
    if (isRegister && password !== confirmPassword) return toast.error('Konfirmasi password belum sama');

    setLoading(true);
    try {
      if (isRegister) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        if (data?.user) {
          await supabase.from('profiles').upsert({ id: data.user.id, updated_at: new Date() });

          const { data: existingWallets } = await supabase
            .from('wallets')
            .select('id')
            .eq('user_id', data.user.id)
            .limit(1);

          if (!existingWallets?.length) {
            await supabase.from('wallets').insert([{ user_id: data.user.id, name: 'Tunai', saldo_awal: 0 }]);
          }
        }

        toast.success('Akun berhasil dibuat. Silakan masuk.');
        setMode('login');
        setPassword('');
        setConfirmPassword('');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('Selamat datang kembali');
        navigate('/');
      }
    } catch (error) {
      toast.error(error.message || 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F4F6F8] text-slate-900 flex items-center justify-center p-4 md:p-8 relative overflow-hidden">
      <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-indigo-300/30 blur-3xl" />
      <div className="absolute -bottom-32 -right-20 w-96 h-96 rounded-full bg-emerald-300/20 blur-3xl" />

      <div className="relative z-10 w-full max-w-6xl grid lg:grid-cols-[1.05fr_0.95fr] bg-white border border-white/80 rounded-[2.5rem] shadow-[0_30px_90px_rgba(15,23,42,0.12)] overflow-hidden">
        <section className="hidden lg:flex bg-[#0B1220] text-white p-10 xl:p-14 flex-col justify-between min-h-[680px] relative overflow-hidden">
          <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="absolute -left-24 -bottom-24 w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl" />

          <div className="relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-white text-slate-950 flex items-center justify-center font-black text-lg mb-8">LF.</div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 font-bold mb-3">Lar Finance V2</p>
            <h1 className="text-5xl xl:text-6xl font-black tracking-tight leading-[1.03] max-w-xl">Uang lebih jelas. Keputusan lebih tenang.</h1>
            <p className="text-slate-400 text-base leading-relaxed max-w-lg mt-5">Catat transaksi, kelola budget, pantau tagihan, dan bangun target tabungan dalam satu ruang pribadi.</p>
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-3">
            {[
              [WalletCards, 'Cashflow', 'Pahami arus uang bulanan'],
              [ShieldCheck, 'Private', 'Akses memakai akun pribadi'],
              [Sparkles, 'Planning', 'Budget, bills, dan goals'],
            ].map(([Icon, title, description]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                <Icon size={18} className="text-slate-300 mb-3" />
                <p className="font-bold text-sm mb-1">{title}</p>
                <p className="text-[11px] leading-relaxed text-slate-500">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="p-6 sm:p-9 md:p-12 lg:p-14 flex items-center">
          <div className="w-full max-w-md mx-auto">
            <div className="lg:hidden flex items-center justify-between mb-9">
              <div className="w-11 h-11 rounded-2xl bg-slate-950 text-white flex items-center justify-center font-black">LF.</div>
              <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-slate-400">Lar Finance V2</span>
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={mode} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-slate-400 mb-2">{isRegister ? 'Create account' : 'Welcome back'}</p>
                <h2 className="text-3xl md:text-4xl font-black tracking-tight">{isRegister ? 'Buat akun baru' : 'Masuk ke Lar Finance'}</h2>
                <p className="text-sm text-slate-500 leading-relaxed mt-3 mb-8">{isRegister ? 'Mulai membangun kebiasaan finansial yang lebih rapi.' : 'Lanjutkan pencatatan dan planning keuanganmu.'}</p>
              </motion.div>
            </AnimatePresence>

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-500 ml-1">Email</label>
                <div className="relative mt-1">
                  <Mail size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" className="w-full pl-11 pr-4 py-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 font-medium" />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 ml-1">Password</label>
                <div className="relative mt-1">
                  <LockKeyhole size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type={showPassword ? 'text' : 'password'} autoComplete={isRegister ? 'new-password' : 'current-password'} minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimal 6 karakter" className="w-full pl-11 pr-12 py-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 font-medium" />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </div>
              </div>

              <AnimatePresence>
                {isRegister && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <label className="text-[11px] font-bold text-slate-500 ml-1">Konfirmasi password</label>
                    <div className="relative mt-1">
                      <LockKeyhole size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" required={isRegister} minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Ulangi password" className="w-full pl-11 pr-4 py-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 font-medium" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button whileTap={{ scale: 0.985 }} type="submit" disabled={loading} className="w-full h-13 py-4 rounded-2xl bg-slate-950 text-white font-bold shadow-lg shadow-slate-900/10 disabled:opacity-60 flex items-center justify-center gap-2 mt-2">
                {loading ? 'Memproses…' : isRegister ? 'Buat akun' : 'Masuk'}
                {!loading && <ArrowRight size={17} />}
              </motion.button>
            </form>

            <div className="mt-7 pt-7 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-500 mb-3">{isRegister ? 'Sudah punya akun?' : 'Belum punya akun?'}</p>
              <button onClick={() => { setMode(isRegister ? 'login' : 'register'); setPassword(''); setConfirmPassword(''); }} className="text-sm font-black text-slate-950 hover:underline underline-offset-4">{isRegister ? 'Masuk ke akun' : 'Daftar gratis'}</button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
