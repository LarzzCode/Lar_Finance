import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Moon, ShieldCheck, Sparkles, Sun, UserRound, WalletCards } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';

const authViewFromPath = (pathname) => {
  if (pathname === '/register') return 'register';
  if (pathname === '/forgot-password') return 'forgot';
  if (pathname === '/reset-password') return 'reset';
  return 'login';
};

export default function LoginV3() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();
  const [view, setView] = useState(authViewFromPath(location.pathname));
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setView(authViewFromPath(location.pathname)); }, [location.pathname]);

  const go = (next) => {
    setPassword('');
    setConfirmPassword('');
    if (next === 'register') navigate('/register');
    else if (next === 'forgot') navigate('/forgot-password');
    else if (next === 'reset') navigate('/reset-password');
    else navigate('/login');
  };

  const ensureDefaultWallet = async (userId) => {
    const { data: existingWallets, error: walletReadError } = await supabase.from('wallets').select('id').eq('user_id', userId).limit(1);
    if (walletReadError) return;
    if (!existingWallets?.length) await supabase.from('wallets').insert([{ user_id: userId, name: 'Tunai', saldo_awal: 0 }]);
  };

  const handleAuth = async (event) => {
    event.preventDefault();
    if (view === 'forgot') {
      if (!email.trim()) return toast.error('Masukkan email akun');
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
      setLoading(false);
      if (error) return toast.error(error.message);
      toast.success('Link reset password sudah dikirim ke email');
      return go('login');
    }

    if (view === 'reset') {
      if (password.length < 6) return toast.error('Password minimal 6 karakter');
      if (password !== confirmPassword) return toast.error('Konfirmasi password belum sama');
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password });
      setLoading(false);
      if (error) return toast.error(error.message);
      await supabase.auth.signOut();
      toast.success('Password berhasil diperbarui. Silakan masuk lagi.');
      return go('login');
    }

    if (view === 'register' && !fullName.trim()) return toast.error('Nama lengkap wajib diisi');
    if (password.length < 6) return toast.error('Password minimal 6 karakter');
    if (view === 'register' && password !== confirmPassword) return toast.error('Konfirmasi password belum sama');

    setLoading(true);
    try {
      if (view === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: `${window.location.origin}/login`,
          },
        });
        if (error) throw error;

        if (data?.session && data?.user) {
          await supabase.from('profiles').upsert({ id: data.user.id, full_name: fullName.trim(), updated_at: new Date() });
          await ensureDefaultWallet(data.user.id);
          toast.success('Akun berhasil dibuat');
          navigate('/');
        } else {
          toast.success('Akun dibuat. Cek email untuk konfirmasi lalu masuk.');
          go('login');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
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

  const isRegister = view === 'register';
  const isForgot = view === 'forgot';
  const isReset = view === 'reset';
  const title = isRegister ? 'Buat akun Lar Finance' : isForgot ? 'Pulihkan akses akun' : isReset ? 'Buat password baru' : 'Masuk ke Lar Finance';
  const subtitle = isRegister
    ? 'Mulai mencatat, merencanakan, dan membaca keuanganmu dalam satu ruang pribadi.'
    : isForgot
      ? 'Masukkan email yang terdaftar. Kami akan mengirim link reset password.'
      : isReset
        ? 'Gunakan password baru minimal 6 karakter yang mudah kamu ingat.'
        : 'Lanjutkan pencatatan dan planning keuanganmu.';

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-6 md:p-8 text-slate-900 dark:text-slate-100 relative overflow-hidden">
      <button onClick={toggleTheme} aria-label="Ganti tema" className="fixed z-20 right-5 top-5 w-11 h-11 rounded-2xl liquid-nav flex items-center justify-center text-slate-500 dark:text-slate-300">{isDark ? <Sun size={17} /> : <Moon size={17} />}</button>

      <div className="relative z-10 w-full max-w-6xl grid lg:grid-cols-[1.04fr_.96fr] gap-4 lg:gap-5">
        <section className="hidden lg:flex rounded-[2.7rem] p-10 xl:p-14 min-h-[680px] flex-col justify-between relative overflow-hidden bg-[linear-gradient(145deg,rgba(8,15,28,.96),rgba(30,41,59,.88))] text-white border border-white/10 shadow-[0_28px_90px_rgba(15,23,42,.16)]">
          <div className="absolute -right-24 -top-20 w-80 h-80 rounded-full bg-sky-400/15 blur-3xl" />
          <div className="absolute -left-24 -bottom-20 w-72 h-72 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-white/95 text-slate-950 flex items-center justify-center font-semibold text-lg mb-10">LF.</div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-medium mb-3">Lar Finance V3</p>
            <h1 className="text-5xl xl:text-[4rem] font-semibold tracking-[-0.055em] leading-[1.02] max-w-xl">Uang lebih jelas. Pikiran lebih tenang.</h1>
            <p className="text-slate-400 text-base leading-relaxed max-w-lg mt-6">Cashflow, dompet, budget, tagihan, dan target tabungan dalam pengalaman yang ringan untuk dipakai setiap hari.</p>
          </div>
          <div className="relative grid grid-cols-3 gap-3">
            {[
              [WalletCards, 'Cashflow', 'Baca ritme bulanan'],
              [ShieldCheck, 'Private', 'Data per akun'],
              [Sparkles, 'Planning', 'Budget & goals'],
            ].map(([Icon, label, description]) => <div key={label} className="rounded-[1.4rem] border border-white/10 bg-white/[.045] p-4 backdrop-blur-xl"><Icon size={18} className="text-slate-300 mb-3" /><p className="font-medium text-sm">{label}</p><p className="text-[11px] leading-relaxed text-slate-500 mt-1">{description}</p></div>)}
          </div>
        </section>

        <section className="liquid-nav rounded-[2.7rem] p-6 sm:p-9 md:p-12 lg:p-14 flex items-center min-h-[620px]">
          <div className="w-full max-w-md mx-auto">
            <div className="lg:hidden flex items-center justify-between mb-10"><div className="w-11 h-11 rounded-2xl liquid-primary text-white flex items-center justify-center font-semibold">LF.</div><span className="text-[10px] uppercase tracking-[0.16em] font-medium text-slate-400">Lar Finance V3</span></div>

            {(isForgot || isReset) && <button onClick={() => go('login')} className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-6"><ArrowLeft size={15} /> Kembali ke login</button>}

            <AnimatePresence mode="wait">
              <motion.div key={view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                <p className="text-[10px] uppercase tracking-[0.17em] font-medium text-slate-400 mb-2">{isRegister ? 'Create account' : isForgot ? 'Account recovery' : isReset ? 'New password' : 'Welcome back'}</p>
                <h2 className="text-3xl md:text-[2.5rem] font-semibold tracking-[-0.045em] leading-tight">{title}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mt-3 mb-8">{subtitle}</p>
              </motion.div>
            </AnimatePresence>

            <form onSubmit={handleAuth} className="space-y-4">
              {isRegister && <label className="block"><span className="text-[11px] font-medium text-slate-500 ml-1">Nama lengkap</span><div className="relative mt-1"><UserRound size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input autoFocus type="text" autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nama lengkap" className="w-full pl-11 pr-4 py-4 rounded-2xl font-medium outline-none" /></div></label>}

              {!isReset && <label className="block"><span className="text-[11px] font-medium text-slate-500 ml-1">Email</span><div className="relative mt-1"><Mail size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input autoFocus={!isRegister} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" className="w-full pl-11 pr-4 py-4 rounded-2xl font-medium outline-none" /></div></label>}

              {!isForgot && <label className="block"><span className="text-[11px] font-medium text-slate-500 ml-1">{isReset ? 'Password baru' : 'Password'}</span><div className="relative mt-1"><LockKeyhole size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input type={showPassword ? 'text' : 'password'} autoComplete={isRegister || isReset ? 'new-password' : 'current-password'} minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimal 6 karakter" className="w-full pl-11 pr-12 py-4 rounded-2xl font-medium outline-none" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>}

              {(isRegister || isReset) && <label className="block"><span className="text-[11px] font-medium text-slate-500 ml-1">Konfirmasi password</span><div className="relative mt-1"><LockKeyhole size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Ulangi password" className="w-full pl-11 pr-4 py-4 rounded-2xl font-medium outline-none" /></div></label>}

              {view === 'login' && <div className="flex justify-end"><button type="button" onClick={() => go('forgot')} className="text-xs font-medium text-slate-400 hover:text-slate-800 dark:hover:text-slate-200">Lupa password?</button></div>}

              <motion.button whileTap={{ scale: 0.985 }} type="submit" disabled={loading} className="w-full py-4 rounded-2xl liquid-primary text-white font-medium disabled:opacity-60 flex items-center justify-center gap-2 mt-2">
                {loading ? 'Memproses…' : isRegister ? 'Buat akun' : isForgot ? 'Kirim link reset' : isReset ? 'Simpan password baru' : 'Masuk'}
                {!loading && <ArrowRight size={17} />}
              </motion.button>
            </form>

            {!isForgot && !isReset && <div className="mt-7 pt-7 border-t border-white/50 dark:border-white/10 text-center"><p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{isRegister ? 'Sudah punya akun?' : 'Belum punya akun?'}</p><button onClick={() => go(isRegister ? 'login' : 'register')} className="text-sm font-medium text-slate-900 dark:text-white hover:opacity-70">{isRegister ? 'Masuk ke akun' : 'Buat akun gratis'}</button></div>}
          </div>
        </section>
      </div>
    </main>
  );
}
