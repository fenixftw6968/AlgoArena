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
        padding: '8px 16px',
        borderRadius: '999px',
        fontSize: '0.8125rem',
        fontWeight: 600,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(10px)',
        border: isOnline
          ? '1px solid rgba(197, 244, 103, 0.4)'
          : '1px solid rgba(239, 68, 68, 0.4)',
        background: isOnline
          ? 'rgba(23, 27, 20, 0.94)'
          : 'rgba(30, 15, 15, 0.94)',
        color: isOnline ? '#C5F467' : '#F87171',
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

