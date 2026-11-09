import { useState, useEffect } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // 1. Detect if already installed / running in standalone mode
    const checkStandalone = 
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://');
    
    setIsStandalone(checkStandalone);
    if (checkStandalone) return;

    // Check if dismissed previously in the last 7 days
    const dismissedAt = localStorage.getItem('algoarena_pwa_dismissed');
    if (dismissedAt && Date.now() - parseInt(dismissedAt, 10) < 7 * 24 * 60 * 60 * 1000) {
      return;
    }

    // 2. Detect iOS devices
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    if (isIosDevice) {
      // Delay showing on iOS so it doesn't immediately interrupt users
      const timer = setTimeout(() => setShowPrompt(true), 3500);
      return () => clearTimeout(timer);
    }

    // 3. Android / Chromium Desktop: Listen for beforeinstallprompt
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('algoarena_pwa_dismissed', Date.now().toString());
  };

  if (!showPrompt || isStandalone) return null;

  return (
    <aside
      aria-label="Install AlgoArena App"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        maxWidth: '380px',
        width: 'calc(100% - 48px)',
        background: '#FFFFFF',
        border: '3px solid #0A0A0A',
        borderRadius: '0px',
        padding: '16px 18px',
        boxShadow: '6px 6px 0px #0A0A0A',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        animation: 'pwaSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img
            src="/pwa-192x192.png"
            alt="AlgoArena"
            style={{ width: '38px', height: '38px', borderRadius: '0px', border: '2px solid #0A0A0A' }}
          />
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.875rem', color: '#0A0A0A', textTransform: 'uppercase' }}>
              Install AlgoArena
            </div>
            <div style={{ fontSize: '0.725rem', color: '#4A4A45' }}>
              Instant access & offline support
            </div>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          aria-label="Dismiss install prompt"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#4A4A45',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '0px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <X size={16} />
        </button>
      </div>

      {isIOS ? (
        <div style={{ fontSize: '0.78rem', color: '#0A0A0A', lineHeight: 1.5, background: '#EFFFD2', border: '2px solid #0A0A0A', padding: '10px 12px', borderRadius: '0px' }}>
          Tap <Share size={13} style={{ display: 'inline', verticalAlign: '-2px', color: '#4E7400' }} /> in Safari and select <PlusSquare size={13} style={{ display: 'inline', verticalAlign: '-2px', color: '#4E7400' }} /> <strong>Add to Home Screen</strong>.
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
          <button
            onClick={handleDismiss}
            style={{
              flex: 1,
              height: '36px',
              background: '#FFFFFF',
              border: '2px solid #0A0A0A',
              borderRadius: '0px',
              color: '#0A0A0A',
              fontSize: '0.75rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              cursor: 'pointer'
            }}
          >
            Not now
          </button>
          <button
            onClick={handleInstallClick}
            style={{
              flex: 1.5,
              height: '36px',
              background: '#B9FF66',
              border: '2px solid #0A0A0A',
              borderRadius: '0px',
              color: '#0A0A0A',
              fontSize: '0.75rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '3px 3px 0px #0A0A0A',
              cursor: 'pointer'
            }}
          >
            <Download size={14} /> Install App
          </button>
        </div>
      )}
    </aside>
  );
}

