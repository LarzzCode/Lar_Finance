import { useEffect, useMemo, useState } from 'react';
import { Download, Share2, Smartphone, X } from 'lucide-react';

const DISMISS_KEY = 'larfinance:pwa-dismissed-at';
const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000;

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);

  const isIOS = useMemo(() => /iphone|ipad|ipod/i.test(window.navigator.userAgent), []);
  const isStandalone = useMemo(
    () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true,
    [],
  );

  useEffect(() => {
    if (isStandalone) return;
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (Date.now() - dismissedAt < DISMISS_FOR_MS) return;

    const handleBeforeInstall = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setVisible(true);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);

    if (isIOS) {
      const timer = window.setTimeout(() => setVisible(true), 1200);
      return () => {
        window.clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
        window.removeEventListener('appinstalled', handleInstalled);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, [isIOS, isStandalone]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome !== 'accepted') dismiss();
    setDeferredPrompt(null);
  };

  if (!visible || installed || isStandalone) return null;

  return (
    <div className="lf-pwa-prompt fixed z-[85] left-4 right-4 bottom-24 md:left-auto md:right-6 md:bottom-6 md:w-[380px] rounded-[1.75rem] bg-slate-950 text-white border border-white/10 shadow-2xl p-5">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
          <Smartphone size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-black">Pasang Lar Finance</p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Buka lebih cepat dari home screen dan gunakan seperti aplikasi.
              </p>
            </div>
            <button onClick={dismiss} aria-label="Tutup" className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center shrink-0">
              <X size={15} />
            </button>
          </div>

          {isIOS && !deferredPrompt ? (
            <div className="mt-4 flex items-start gap-2 rounded-2xl bg-white/[0.06] p-3 text-xs text-slate-300">
              <Share2 size={16} className="shrink-0 mt-0.5" />
              <span>Di Safari: tekan Share lalu pilih <b>Add to Home Screen</b>.</span>
            </div>
          ) : (
            <button onClick={install} className="mt-4 w-full h-11 rounded-2xl bg-white text-slate-950 text-sm font-black inline-flex items-center justify-center gap-2">
              <Download size={16} /> Install aplikasi
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
