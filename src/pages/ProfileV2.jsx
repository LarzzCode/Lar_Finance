import { useEffect, useState } from 'react';
import { Camera, LogOut, Mail, Save, ShieldCheck, UserRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function ProfileV2() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const getProfile = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', user.id)
          .single();

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
      const updates = {
        id: user.id,
        full_name: name,
        avatar_url: avatar,
        updated_at: new Date(),
      };

      const { error } = await supabase.from('profiles').upsert(updates);
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
      const publicUrl = data.publicUrl;
      setAvatarUrl(publicUrl);
      await updateProfile(fullName, publicUrl, true);
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
    <main className="min-h-screen bg-[#F6F7F9] pb-32 md:pb-16 md:pt-28 text-slate-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 md:pt-6">
        <div className="mb-7">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 mb-1">Account center</p>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Profil & akun.</h1>
          <p className="text-sm text-slate-500 mt-2">Kelola identitas yang tampil di Lar Finance tanpa mengubah data keuanganmu.</p>
        </div>

        <div className="grid lg:grid-cols-[0.72fr_1.28fr] gap-6 lg:gap-8 items-start">
          <section className="bg-slate-950 text-white rounded-[2rem] overflow-hidden shadow-xl">
            <div className="h-36 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.65),_transparent_45%),linear-gradient(135deg,#0f172a,#111827)]" />
            <div className="px-6 pb-7 -mt-16">
              <div className="relative w-32 h-32 mx-auto lg:mx-0">
                <div className="w-full h-full rounded-[2rem] bg-white p-1.5 shadow-2xl">
                  <img
                    src={avatarUrl || defaultAvatar}
                    alt="Profile"
                    className="w-full h-full object-cover rounded-[1.65rem] bg-slate-200"
                  />
                </div>
                <label className="absolute -right-2 -bottom-2 w-11 h-11 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shadow-lg cursor-pointer transition-colors">
                  <input type="file" className="hidden" accept="image/*" onChange={uploadAvatar} disabled={uploading} />
                  <Camera size={18} />
                </label>
              </div>

              <div className="mt-5 text-center lg:text-left">
                <p className="text-xl font-black">{fullName || 'Pengguna Lar Finance'}</p>
                <p className="text-sm text-slate-400 mt-1 break-all">{user?.email}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-6 pt-5 border-t border-white/10">
                <div className="rounded-2xl bg-white/5 p-4">
                  <ShieldCheck size={18} className="text-emerald-300 mb-2" />
                  <p className="text-[10px] uppercase tracking-wider font-black text-slate-500">Session</p>
                  <p className="text-xs font-bold mt-1">Supabase Auth</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-4">
                  <Mail size={18} className="text-indigo-300 mb-2" />
                  <p className="text-[10px] uppercase tracking-wider font-black text-slate-500">Email</p>
                  <p className="text-xs font-bold mt-1">Terhubung</p>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white border border-slate-200/70 rounded-[2rem] p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-7">
              <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <UserRound size={20} />
              </div>
              <div>
                <p className="font-black">Informasi profil</p>
                <p className="text-xs text-slate-400 mt-1">Data profil saja — transaksi dan saldo tidak disentuh.</p>
              </div>
            </div>

            <div className="space-y-5">
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nama lengkap</span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Nama Anda"
                  className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 font-bold outline-none focus:bg-white focus:ring-4 focus:ring-slate-100"
                />
              </label>

              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Email akun</span>
                <div className="w-full mt-2 bg-slate-100 border border-slate-200 rounded-2xl px-4 py-4 font-bold text-slate-500 break-all">
                  {user?.email}
                </div>
              </label>

              <div className="pt-2">
                <button
                  onClick={() => updateProfile(fullName, avatarUrl)}
                  disabled={loading || uploading}
                  className="w-full inline-flex items-center justify-center gap-2 py-4 rounded-2xl bg-slate-950 hover:bg-black text-white font-black text-sm shadow-lg disabled:opacity-60"
                >
                  <Save size={17} /> {loading ? 'Menyimpan...' : 'Simpan perubahan'}
                </button>
              </div>
            </div>

            <div className="mt-8 pt-7 border-t border-slate-100">
              <div className="rounded-[1.5rem] border border-rose-100 bg-rose-50/60 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="font-black text-sm text-rose-700">Keluar dari aplikasi</p>
                  <p className="text-xs text-rose-500/80 mt-1">Hanya mengakhiri sesi login di perangkat ini.</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white border border-rose-200 text-rose-600 text-xs font-black hover:bg-rose-100"
                >
                  <LogOut size={15} /> Keluar
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
