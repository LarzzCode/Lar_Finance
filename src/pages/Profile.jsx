import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploading, setUploading] = useState(false);

  // 1. Ambil Data Profil
  useEffect(() => {
    async function getProfile() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        if (data) {
          setFullName(data.full_name);
          setAvatarUrl(data.avatar_url);
        }
      } catch (error) {
        console.error('Error loading user data!', error.message);
      } finally {
        setLoading(false);
      }
    }

    if (user) getProfile();
  }, [user]);

  // 2. Fungsi Upload Gambar
  const uploadAvatar = async (event) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('Pilih gambar dulu!');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      // A. Upload ke Storage Bucket 'avatars'
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // B. Dapatkan Public URL
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = data.publicUrl;

      // C. Update State & Database
      setAvatarUrl(publicUrl);
      await updateProfile(fullName, publicUrl);
      
      toast.success('Foto berhasil diupload!');
    } catch (error) {
      toast.error('Gagal upload: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  // 3. Fungsi Update Data
  const updateProfile = async (name, avatar) => {
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
      if (!uploading) toast.success('Profil diperbarui!');
      
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // 4. Fungsi Logout
  const handleLogout = async () => {
    if (window.confirm('Yakin ingin keluar?')) {
        const { error } = await supabase.auth.signOut();
        if (error) toast.error('Gagal logout');
        else {
            toast.success('Sampai jumpa!');
            navigate('/login');
        }
    }
  };

  // Helper untuk Avatar Default (Inisial Nama)
  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName || 'User')}&background=0D9488&color=fff&size=256`;

  return (
    <div className="min-h-screen w-full flex flex-col items-center pt-24 pb-24 px-4 bg-gray-50 font-sans text-gray-800">
      
      <div className="w-full max-w-md bg-white rounded-[2rem] shadow-xl overflow-hidden border border-gray-100 relative">
        
        {/* Header Background */}
        <div className="h-32 bg-gradient-to-r from-teal-600 to-emerald-600 relative">
            <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
        </div>

        {/* Avatar Section */}
        <div className="flex justify-center -mt-16 relative z-10 px-6">
            <div className="relative group">
                <div className="p-1.5 bg-white rounded-full shadow-lg">
                    <img 
                        src={avatarUrl || defaultAvatar} 
                        alt="Profile" 
                        className="w-32 h-32 rounded-full object-cover border-4 border-gray-50 bg-gray-200"
                    />
                </div>
                
                {/* Tombol Kamera Upload */}
                <label className="absolute bottom-2 right-2 bg-gray-900 text-white p-2.5 rounded-full cursor-pointer shadow-lg hover:bg-black transition-transform active:scale-90">
                    <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={uploadAvatar}
                        disabled={uploading}
                    />
                    {uploading ? (
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    )}
                </label>
            </div>
        </div>

        {/* Content Section */}
        <div className="px-8 pt-6 pb-8 text-center">
            
            {/* Form Inputs */}
            <div className="space-y-5">
                <div className="text-left">
                    <label className="text-xs font-bold text-gray-400 uppercase ml-1">Nama Lengkap</label>
                    <input 
                        type="text" 
                        value={fullName || ''}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Nama Anda"
                        className="w-full mt-1 p-4 bg-gray-50 rounded-2xl font-bold text-gray-800 outline-none focus:bg-white focus:ring-2 focus:ring-teal-100 transition-all border border-transparent focus:border-teal-200 text-center"
                    />
                </div>

                <div className="text-left">
                    <label className="text-xs font-bold text-gray-400 uppercase ml-1">Email</label>
                    <div className="w-full mt-1 p-4 bg-gray-50 rounded-2xl font-bold text-gray-500 text-center border border-gray-100 cursor-not-allowed">
                        {user?.email}
                    </div>
                </div>

                {/* Actions */}
                <div className="pt-4 space-y-3">
                    <button 
                        onClick={() => updateProfile(fullName, avatarUrl)}
                        disabled={loading}
                        className="w-full py-4 bg-teal-600 text-white rounded-2xl font-bold shadow-lg shadow-teal-200 hover:bg-teal-700 transition-transform active:scale-95 disabled:opacity-70"
                    >
                        {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>

                    <button 
                        onClick={handleLogout}
                        className="w-full py-4 bg-white text-rose-500 border-2 border-rose-100 rounded-2xl font-bold hover:bg-rose-50 hover:border-rose-200 transition-colors flex items-center justify-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                        </svg>
                        Keluar Aplikasi
                    </button>
                </div>
            </div>

        </div>
      </div>
      
      <div className="mt-8 text-center opacity-40">
        <p className="text-[10px] font-bold uppercase tracking-widest">LarFinance v1.2</p>
      </div>

    </div>
  );
}