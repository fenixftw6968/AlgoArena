import { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export default function NetworkStatusIndicator() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' && 'onLine' in navigator ? navigator.onLine : true
  );
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowRestored(true);
      const timer = setTimeout(() => setShowRestored(false), 3200);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowRestored(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showRestored) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '18px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99999,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '9px 16px',
        borderRadius: '0px',
        fontSize: '0.8125rem',
        fontWeight: 800,
        textTransform: 'uppercase',
        fontFamily: 'var(--font-mono)',
        boxShadow: '4px 4px 0px #0A0A0A',
        border: '2px solid #0A0A0A',
        background: isOnline ? '#B9FF66' : '#0A0A0A',
        color: isOnline ? '#0A0A0A' : '#FFFFFF',
        transition: 'all 0.25s ease'
      }}
    >
      {isOnline ? (
        <>
          <Wifi size={15} />
          <span>Connected to AlgoArena</span>
        </>
      ) : (
        <>
          <WifiOff size={15} />
          <span>Offline Mode — Some match features unavailable</span>
        </>
      )}
    </div>
  );
}

