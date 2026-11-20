'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_STORAGE_KEY = 'llys_pwa_banner_dismissed_v1';

export default function PwaInstaller() {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(true);
  const [dismissed, setDismissed] = useState(true);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('android');
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          void reg.update();
        })
        .catch(() => {});
    }

    const standaloneMatch =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      Boolean((window.navigator as unknown as { standalone?: boolean }).standalone);
    setIsStandalone(standaloneMatch);

    try {
      const wasDismissed = window.localStorage.getItem(DISMISS_STORAGE_KEY) === '1';
      setDismissed(wasDismissed);
    } catch {
      setDismissed(false);
    }

    const ua = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setPlatform('ios');
    } else if (/android/.test(ua)) {
      setPlatform('android');
    } else {
      setPlatform('desktop');
    }

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setShowGuideModal(false);
      try {
        window.localStorage.setItem(DISMISS_STORAGE_KEY, '1');
      } catch {
        // ignore storage restrictions
      }
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  function handleDismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, '1');
    } catch {
      // ignore storage restrictions
    }
  }

  // Hide installer while inside an active game arena or if already running as installed standalone app
  if (isStandalone || pathname?.startsWith('/game')) {
    return null;
  }

  async function handleInstallClick() {
    if (deferredPrompt) {
      setInstalling(true);
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setDeferredPrompt(null);
          handleDismiss();
        }
      } catch {
        setShowGuideModal(true);
      } finally {
        setInstalling(false);
      }
      return;
    }
    setShowGuideModal(true);
  }

  return (
    <>
      {!dismissed && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[min(460px,calc(100vw-24px))] -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-2xl border-2 border-[#7aa6eb] bg-[#182234]/95 p-3 text-white shadow-[0_10px_28px_rgba(0,0,0,0.45)] backdrop-blur-md">
            <img
              src="/icons/icon-192.png"
              alt="Logo llysSmart"
              className="h-12 w-12 shrink-0 rounded-xl border border-[#ffd338]/60 object-cover shadow-md"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate font-display text-base font-bold text-[#ffd338]">
                  llysSmart Mobile
                </p>
                <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
                  App
                </span>
              </div>
              <p className="truncate text-xs text-white/80">
                Pasang pintasan aplikasi layar penuh di HP kamu
              </p>
            </div>
            <button
              type="button"
              onClick={handleInstallClick}
              disabled={installing}
              className="shrink-0 rounded-xl border-2 border-[#6b3806] bg-gradient-to-b from-[#ffcb52] to-[#f59321] px-3.5 py-2 font-display text-xs font-bold text-[#2e1502] shadow-[0_3px_0_#4d2602] transition active:translate-y-0.5 sm:text-sm"
            >
              {installing ? 'Memasang...' : '📲 Install'}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Tutup banner install"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border-[3px] border-[#7aa6eb] bg-gradient-to-b from-[#23385e] to-[#162238] p-5 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-4 border-b border-white/15 pb-4">
              <img
                src="/icons/icon-192.png"
                alt="llysSmart App Icon"
                className="h-16 w-16 shrink-0 rounded-2xl border-2 border-[#ffd338] shadow-lg"
              />
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-xl font-bold text-[#ffd338]">llysSmart</h2>
                <p className="text-xs font-semibold text-sky-200">
                  Let&apos;s Learn Your Skills • EduGame 2D
                </p>
                <div className="mt-1.5 flex items-center gap-2 text-[11px] font-bold text-emerald-300">
                  <span className="rounded-md bg-emerald-500/20 px-2 py-0.5">✓ Layar Penuh</span>
                  <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-amber-300">★ Pintasan Cepat</span>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-black/25 p-1">
              <button
                type="button"
                onClick={() => setPlatform('android')}
                className={`rounded-lg py-1.5 font-display text-xs font-bold transition ${
                  platform !== 'ios'
                    ? 'bg-[#f59321] text-[#2e1502] shadow'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                🤖 Android (Chrome)
              </button>
              <button
                type="button"
                onClick={() => setPlatform('ios')}
                className={`rounded-lg py-1.5 font-display text-xs font-bold transition ${
                  platform === 'ios'
                    ? 'bg-[#f59321] text-[#2e1502] shadow'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                🍎 iPhone / iPad (Safari)
              </button>
            </div>

            {platform === 'ios' ? (
              <ol className="mt-4 space-y-3 text-sm">
                <li className="flex items-start gap-3 rounded-xl bg-white/10 p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#ffd338] font-display text-xs font-bold text-[#182234]">
                    1
                  </span>
                  <div>
                    Ketuk ikon <strong className="text-[#ffd338]">Share (Bagikan ⬆️)</strong> di bar bawah browser Safari.
                  </div>
                </li>
                <li className="flex items-start gap-3 rounded-xl bg-white/10 p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#ffd338] font-display text-xs font-bold text-[#182234]">
                    2
                  </span>
                  <div>
                    Geser ke bawah lalu pilih <strong className="text-[#ffd338]">&quot;Add to Home Screen&quot;</strong> (Tambah ke Layar Utama).
                  </div>
                </li>
                <li className="flex items-start gap-3 rounded-xl bg-white/10 p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#ffd338] font-display text-xs font-bold text-[#182234]">
                    3
                  </span>
                  <div>
                    Nama otomatis terisi <strong className="text-[#ffd338]">llysSmart</strong> dengan logo kucing wisuda. Ketuk <strong className="text-[#ffd338]">Add</strong>!
                  </div>
                </li>
              </ol>
            ) : (
              <ol className="mt-4 space-y-3 text-sm">
                <li className="flex items-start gap-3 rounded-xl bg-white/10 p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#ffd338] font-display text-xs font-bold text-[#182234]">
                    1
                  </span>
                  <div>
                    Ketuk tombol menu <strong className="text-[#ffd338]">⋮ (titik tiga)</strong> di pojok kanan atas Chrome.
                  </div>
                </li>
                <li className="flex items-start gap-3 rounded-xl bg-white/10 p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#ffd338] font-display text-xs font-bold text-[#182234]">
                    2
                  </span>
                  <div>
                    Pilih <strong className="text-[#ffd338]">&quot;Tambahkan ke layar utama&quot;</strong> lalu pilih <strong className="text-[#ffd338]">&quot;Instal&quot;</strong> atau <strong className="text-[#ffd338]">&quot;Buat pintasan&quot;</strong>.
                  </div>
                </li>
                <li className="flex items-start gap-3 rounded-xl bg-white/10 p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#ffd338] font-display text-xs font-bold text-[#182234]">
                    3
                  </span>
                  <div>
                    Ikon resmi <strong className="text-[#ffd338]">llysSmart</strong> akan muncul di menu HP kamu dan terbuka <strong className="text-emerald-300">layar penuh seperti aplikasi Play Store</strong>!
                  </div>
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-5 w-full rounded-xl border-2 border-[#6b3806] bg-gradient-to-b from-[#ffcb52] to-[#f59321] py-2.5 font-display text-sm font-bold text-[#2e1502] shadow-[0_3px_0_#4d2602]"
            >
              Siap, Mengerti!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
