import { X, Download } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export default function PWAInstallBanner() {
  const { isInstallable, isStandalone, install, dismiss } = usePWAInstall();

  if (!isInstallable || isStandalone) return null;

  return (
    <div className="fixed left-4 right-4 z-[60] md:bottom-6 md:left-auto md:right-6 md:max-w-sm" style={{ bottom: 'calc(var(--bottom-nav-height, 64px) + env(safe-area-inset-bottom, 0px) + 8px)' }}>
      <div className="bg-[#111] border border-[#333] rounded-2xl shadow-2xl p-4 flex items-center gap-3 animate-in slide-in-from-bottom-4 fade-in duration-300">
        <div className="w-10 h-10 rounded-xl bg-[#B5FF03]/10 flex items-center justify-center shrink-0">
          <Download size={18} className="text-[#B5FF03]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-white">Instalar Ventura</p>
          <p className="text-[10px] text-neutral-400 font-medium">Acesso rápido pela tela inicial</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={install}
            className="px-3 py-2 bg-[#B5FF03] text-black text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-[#a1e600] transition-colors min-h-[44px]"
          >
            Instalar
          </button>
          <button
            onClick={dismiss}
            className="p-2 text-neutral-500 hover:text-white transition-colors rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Fechar"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
