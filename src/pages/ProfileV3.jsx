import { useEffect, useState } from 'react';
import { Camera, LogOut, Mail, Save, ShieldCheck, UserRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function ProfileV3() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const getProfile = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).single();
        if (error && error.code !== 'PGRST116') throw error;
        if (data) {
          setFullName(data.full_name || '');
          setAvatarUrl(data.avatar_url || null);
        }
      } catch (error) {
        console.error('Profile error:', error.message);
      } finally {
        setLoading(false);
      }
    };
    if (user) getProfile();
  }, [user]);

  const updateProfile = async (name, avatar, silent = false) => {
    try {
      setLoading(true);
      const { error } = await supabase.from('profiles').upsert({ id: user.id, full_name: name, avatar_url: avatar, updated_at: new Date() });
      if (error) throw error;
      if (!silent) toast.success('Profil diperbarui');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const uploadAvatar = async (event) => {
    try {
      setUploading(true);
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) throw new Error('File harus berupa gambar');
      if (file.size > 5 * 1024 * 1024) throw new Error('Ukuran foto maksimal 5 MB');
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      setAvatarUrl(data.publicUrl);
      await updateProfile(fullName, data.publicUrl, true);
      toast.success('Foto profil diperbarui');
    } catch (error) {
      toast.error(`Gagal upload: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = async () => {
    if (!window.confirm('Yakin ingin keluar dari Lar Finance?')) return;
    const { error } = await supabase.auth.signOut();
    if (error) toast.error(error.message);
  };

  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName || 'User')}&background=0F172A&color=fff&size=256`;

  return (
    <main className="min-h-screen pb-32 md:pb-16 md:pt-28 text-slate-900 dark:text-slate-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 md:pt-6">
        <header className="mb-7 md:mb-9">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400 mb-2">Account center</p>
          <h1 className="text-[2rem] md:text-[2.7rem] leading-tight font-semibold tracking-[-0.04em]">Profil & akun</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Kelola identitas akun tanpa menyentuh data transaksi dan saldo.</p>
        </header>

        <div className="grid lg:grid-cols-[.78fr_1.22fr] gap-5 lg:gap-7 items-start">
          <section className="liquid-nav rounded-[2.3rem] p-6 md:p-7 overflow-hidden relative">
            <div className="absolute -right-20 -top-20 w-56 h-56 rounded-full bg-emerald-300/20 dark:bg-emerald-500/10 blur-3xl" />
            <div className="relative">
              <div className="relative w-28 h-28 mx-auto lg:mx-0">
                <div className="w-full h-full rounded-[2rem] bg-white/70 dark:bg-white/[.06] p-1.5 shadow-xl"><img src={avatarUrl || defaultAvatar} alt="Profile" className="w-full h-full object-cover rounded-[1.65rem] bg-slate-200" /></div>
                <label className="absolute -right-2 -bottom-2 w-11 h-11 rounded-2xl liquid-primary text-white flex items-center justify-center shadow-lg cursor-pointer"><input type="file" className="hidden" accept="image/*" onChange={uploadAvatar} disabled={uploading} /><Camera size={17} /></label>
              </div>

              <div className="mt-5 text-center lg:text-left"><p className="text-xl font-semibold">{fullName || 'Pengguna Lar Finance'}</p><p className="text-sm text-slate-400 mt-1 break-all">{user?.email}</p></div>

              <div className="grid grid-cols-2 gap-3 mt-6">
                <div className="rounded-2xl bg-white/38 dark:bg-white/[.035] border border-white/60 dark:border-white/10 p-4"><ShieldCheck size={18} className="text-emerald-500 dark:text-emerald-300 mb-2" /><p className="text-[9px] uppercase tracking-wide text-slate-400">Session</p><p className="text-xs font-medium mt-1">Supabase Auth</p></div>
                <div className="rounded-2xl bg-white/38 dark:bg-white/[.035] border border-white/60 dark:border-white/10 p-4"><Mail size={18} className="text-indigo-500 dark:text-indigo-300 mb-2" /><p className="text-[9px] uppercase tracking-wide text-slate-400">Email</p><p className="text-xs font-medium mt-1">Terhubung</p></div>
              </div>
            </div>
          </section>

          <section className="liquid-nav rounded-[2.3rem] p-6 md:p-8">
            <div className="flex items-center gap-3 mb-7"><div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 flex items-center justify-center"><UserRound size={19} /></div><div><p className="font-semibold">Informasi profil</p><p className="text-xs text-slate-400 mt-1">Hanya data profil yang diperbarui.</p></div></div>

            <div className="space-y-5">
              <label className="block"><span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Nama lengkap</span><input type="text" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nama Anda" className="w-full mt-2 rounded-2xl px-4 py-4 font-medium outline-none" /></label>
              <label className="block"><span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Email akun</span><div className="w-full mt-2 rounded-2xl px-4 py-4 font-medium text-slate-500 dark:text-slate-400 bg-white/35 dark:bg-white/[.03] border border-white/60 dark:border-white/10 break-all">{user?.email}</div></label>
              <button onClick={() => updateProfile(fullName, avatarUrl)} disabled={loading || uploading} className="liquid-primary w-full inline-flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-semibold text-sm disabled:opacity-60"><Save size={16} /> {loading ? 'Menyimpan…' : 'Simpan perubahan'}</button>
            </div>

            <div className="mt-8 pt-7 border-t border-white/50 dark:border-white/10"><div className="rounded-[1.6rem] bg-rose-500/8 border border-rose-500/10 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"><div><p className="font-semibold text-sm text-rose-600 dark:text-rose-300">Keluar dari aplikasi</p><p className="text-xs text-rose-500/70 mt-1">Hanya mengakhiri sesi login di perangkat ini.</p></div><button onClick={handleLogout} className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white/60 dark:bg-white/[.05] border border-rose-500/10 text-rose-600 dark:text-rose-300 text-xs font-medium"><LogOut size={15} /> Keluar</button></div></div>
          </section>
        </div>
      </div>
    </main>
  );
}
