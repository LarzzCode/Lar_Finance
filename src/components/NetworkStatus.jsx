import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export default function NetworkStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="fixed z-[95] top-3 left-1/2 -translate-x-1/2 rounded-2xl bg-amber-500 text-white shadow-xl px-4 py-2.5 text-xs font-black inline-flex items-center gap-2">
      <WifiOff size={15} /> Offline · perubahan baru mungkin belum tersimpan
    </div>
  );
}
