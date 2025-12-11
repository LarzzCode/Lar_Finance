import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploading, setUploading] = useState(false);

  // 1. Ambil Data Profil saat Load
  useEffect(() => {
    async function getProfile() {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .single();

      if (data) {
        setFullName(data.full_name);
        setAvatarUrl(data.avatar_url);
      }
      setLoading(false);
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
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  // 3. Fungsi Update Data ke Tabel Profiles
  const updateProfile = async (name, avatar) => {
    try {
      setLoading(true);
      
      const updates = {
        id: user.id, // ID User
        full_name: name,
        avatar_url: avatar,
        updated_at: new Date(),
      };

      // Upsert: Jika ada update, jika belum ada insert
      const { error } = await supabase.from('profiles').upsert(updates);

      if (error) throw error;
      if (!uploading) toast.success('Profil diperbarui!'); // Jangan muncul toast double saat upload
      
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full max-w-xl mx-auto px-4 pt-20 pb-24 md:pt-24 md:pb-8">
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 text-center">
        <h2 className="text-2xl font-black text-gray-800 mb-6">Edit Profil</h2>

        {/* AVATAR PREVIEW & UPLOAD */}
        <div className="mb-8 flex flex-col items-center">
          <div className="relative w-32 h-32 mb-4">
            {avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt="Avatar" 
                className="w-full h-full rounded-full object-cover border-4 border-orange-100 shadow-md"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center text-4xl border-4 border-white shadow-md">
                👤
              </div>
            )}
            
            {/* Tombol Kamera Kecil */}
            <label className="absolute bottom-0 right-0 bg-orange-600 p-2 rounded-full text-white cursor-pointer hover:bg-orange-700 shadow-lg transition-transform hover:scale-110" title="Ganti Foto">
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
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>

        {/* FORM NAMA */}
        <div className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Nama Lengkap</label>
            <input 
              type="text" 
              className="w-full p-3 rounded-xl border border-gray-300 focus:ring-orange-500 focus:border-orange-500 outline-none"
              value={fullName || ''}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Masukkan nama anda"
            />
          </div>

          <button 
            onClick={() => updateProfile(fullName, avatarUrl)}
            className="w-full py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-black transition-colors shadow-lg"
            disabled={loading}
          >
            {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </div>
    </div>
  );
}