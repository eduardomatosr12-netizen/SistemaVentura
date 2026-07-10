import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

export default function PWAUpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setShowUpdate(true);
            }
          });
        });
      });
    }
  }, []);

  if (!showUpdate) return null;

  const handleUpdate = () => {
    window.location.reload();
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200]">
      <button
        onClick={handleUpdate}
        className="flex items-center gap-2 px-4 py-2.5 bg-[#B5FF03] text-black text-xs font-black rounded-full shadow-2xl hover:bg-[#a1e600] transition-colors min-h-[44px]"
      >
        <RefreshCw size={14} strokeWidth={3} />
        Nova versão disponível
      </button>
    </div>
  );
}
