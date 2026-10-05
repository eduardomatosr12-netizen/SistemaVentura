import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { applyUpdate, onUpdateAvailable } from '../lib/pwa';

/**
 * Bottom banner shown when a new build has been fetched by the service worker
 * but is waiting for the user to accept it.
 */
export default function PwaUpdateBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(
    () =>
      onUpdateAvailable(() => {
        setVisible(true);
      }),
    []
  );

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-3 right-3 z-[110] flex items-center gap-3 rounded-2xl border border-[#CDFF00]/40 bg-[#111] p-3 pl-4 shadow-[0_10px_30px_rgba(0,0,0,0.6)]"
      style={{
        bottom: 'calc(var(--bottom-nav-height, 64px) + env(safe-area-inset-bottom, 0px) + 12px)',
        marginLeft: 'env(safe-area-inset-left, 0px)',
        marginRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <p className="flex-1 min-w-0 text-xs font-bold leading-snug text-white">
        Nova versão disponível
      </p>
      <button
        onClick={applyUpdate}
        className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-lg bg-[#CDFF00] px-3 text-[11px] font-black uppercase tracking-wider text-black"
      >
        <RefreshCw size={14} strokeWidth={3} />
        Atualizar
      </button>
      <button
        onClick={() => setVisible(false)}
        aria-label="Dispensar"
        className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:text-white"
      >
        <X size={16} strokeWidth={3} />
      </button>
    </div>
  );
}
