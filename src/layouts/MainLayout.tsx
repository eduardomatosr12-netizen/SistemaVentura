import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import TopHeader from '../components/TopHeader';
import { LayoutDashboard, Users, DollarSign, Package } from 'lucide-react';

interface MainLayoutProps {
  children: ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const location = useLocation();
  // The drawer is modelled as "opened at this pathname" instead of a boolean so
  // it closes itself on navigation by derivation — a boolean would need a
  // setState-in-effect, which the react-hooks lint rules (rightly) reject.
  const [drawerOpenedAt, setDrawerOpenedAt] = useState<string | null>(null);
  const isSidebarOpen = drawerOpenedAt === location.pathname;

  const closeSidebar = () => setDrawerOpenedAt(null);

  // The drawer is a dismissible layer: Escape must close it so keyboard users
  // aren't trapped.
  useEffect(() => {
    if (!isSidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSidebar();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isSidebarOpen]);

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <div className="flex h-dvh bg-black overflow-x-hidden overflow-y-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />

      <main className="flex-1 ml-0 md:ml-[220px] flex flex-col overflow-y-auto overflow-x-hidden w-full bg-black">
        <TopHeader onMenuClick={() => setDrawerOpenedAt(location.pathname)} />

        <div className="flex-1 bg-black w-full min-w-0">
          {/* pb-bottom-nav clears the fixed bottom nav; pages must not add it
              again or the gap doubles on mobile. */}
          <div className="p-4 md:p-8 w-full pb-bottom-nav md:pb-6">{children}</div>
        </div>
      </main>

      <nav
        aria-label="Navegação principal"
        className="bottom-nav fixed bottom-0 left-0 right-0 z-50 bg-black border-t border-[#2d2d2d] flex md:hidden justify-around items-center"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          paddingLeft: 'env(safe-area-inset-left, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)',
          height: 'calc(var(--bottom-nav-height, 64px) + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <Link
          to="/home"
          aria-current={isActive('/home') ? 'page' : undefined}
          className={`flex flex-col items-center gap-0.5 px-2 py-1 min-w-[56px] min-h-[48px] justify-center active:scale-95 transition-transform ${
            isActive('/home') ? 'text-[#CDFF00]' : 'text-neutral-400'
          }`}
        >
          <LayoutDashboard size={20} />
          <span className="text-[10px] font-bold uppercase tracking-wide">Home</span>
        </Link>
        {/* /contatos and /clientes render the same page, so both stay lit. */}
        <Link
          to="/contatos"
          aria-current={isActive('/contatos') || isActive('/clientes') ? 'page' : undefined}
          className={`flex flex-col items-center gap-0.5 px-2 py-1 min-w-[56px] min-h-[48px] justify-center active:scale-95 transition-transform ${
            isActive('/contatos') || isActive('/clientes') ? 'text-[#CDFF00]' : 'text-neutral-400'
          }`}
        >
          <Users size={20} />
          <span className="text-[10px] font-bold uppercase tracking-wide">Contatos</span>
        </Link>
        <Link
          to="/tarefas"
          aria-current={isActive('/tarefas') ? 'page' : undefined}
          className={`flex flex-col items-center gap-0.5 px-2 py-1 min-w-[56px] min-h-[48px] justify-center active:scale-95 transition-transform ${
            isActive('/tarefas') ? 'text-[#CDFF00]' : 'text-neutral-400'
          }`}
        >
          <Package size={20} />
          <span className="text-[10px] font-bold uppercase tracking-wide">Estoque</span>
        </Link>
        <Link
          to="/financeiro"
          aria-current={isActive('/financeiro') ? 'page' : undefined}
          className={`flex flex-col items-center gap-0.5 px-2 py-1 min-w-[56px] min-h-[48px] justify-center active:scale-95 transition-transform ${
            isActive('/financeiro') ? 'text-[#CDFF00]' : 'text-neutral-400'
          }`}
        >
          <DollarSign size={20} />
          <span className="text-[10px] font-bold uppercase tracking-wide">Financeiro</span>
        </Link>
      </nav>
    </div>
  );
};

export default MainLayout;
