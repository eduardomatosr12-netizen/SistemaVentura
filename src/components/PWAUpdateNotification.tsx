import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

export default function PWAUpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const updateHandler = () => {
      navigator.serviceWorker.ready.then((registration) => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        const stateHandler = () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setShowUpdate(true);
          }
        };
        newWorker.addEventListener('statechange', stateHandler);
      });
    };

    navigator.serviceWorker.ready.then((registration) => {
      registration.addEventListener('updatefound', updateHandler);
    });

    return () => {
      navigator.serviceWorker.ready.then((registration) => {
        registration.removeEventListener('updatefound', updateHandler);
      });
    };
  }, []);

  if (!showUpdate) return null;

  const handleUpdate = () => {
    window.location.reload();
  };

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[200] w-[calc(100vw-24px)] max-w-sm"
      style={{ top: 'calc(var(--top-header-height, 69px) + 8px)' }}
    >
      <button
        onClick={handleUpdate}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#CDFF00] text-black text-xs font-black rounded-full shadow-2xl hover:bg-[#bcef00] transition-colors min-h-[44px]"
      >
        <RefreshCw size={14} strokeWidth={3} />
        Nova versão disponível
      </button>
    </div>
  );
}
