import { useState, useRef, useEffect } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { useFilters, RESPONSIBLES, STATUSES, ORIGINS, PRIORITIES } from '../../contexts/FilterContext';

interface FilterOption {
  id: string;
  label: string;
}

interface FilterDropdownProps {
  label: string;
  options: FilterOption[];
  value: string | null;
  onChange: (value: string | null) => void;
}

function FilterDropdown({ label, options, value, onChange }: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handlePointerOutside(event: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handlePointerOutside);
    document.addEventListener('touchstart', handlePointerOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handlePointerOutside);
      document.removeEventListener('touchstart', handlePointerOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={`flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] text-xs font-semibold rounded-lg border transition-all ${
          value
            ? 'bg-[#1a1a1a] text-white border-[#CDFF00]'
            : 'bg-black text-white/70 border-[#2d2d2d] hover:border-[#444]'
        }`}
      >
        <span>{label}</span>
        {value ? (
          <span className="opacity-70">{value}</span>
        ) : (
          <ChevronDown size={12} />
        )}
      </button>
      {isOpen && (
        <div role="listbox" className="absolute top-full left-0 right-auto mt-1 min-w-48 w-max max-w-[80vw] max-h-[80dvh] overflow-y-auto bg-[#1a1a1a] border border-[#2d2d2d] rounded-xl shadow-xl z-[999] overflow-hidden">
          {value && (
            <button
              role="option"
              onClick={() => { onChange(null); setIsOpen(false); }}
              className="w-full px-3 py-3 min-h-[44px] text-left text-xs font-medium text-white/50 hover:bg-[#222] border-b border-[#2d2d2d] flex items-center"
            >
              Limpar filtro
            </button>
          )}
          {options.map(opt => (
            <button
              key={opt.id}
              role="option"
              aria-selected={value === opt.id}
              onClick={() => { onChange(opt.id); setIsOpen(false); }}
              className={`w-full px-3 py-3 min-h-[44px] text-left text-xs font-medium hover:bg-[#222] transition-colors flex items-center ${
                value === opt.id ? 'bg-[#CDFF00]/10 text-[#CDFF00] font-bold' : 'text-white/80'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterBar() {
  const { filters, setFilter, clearFilters, hasActiveFilters } = useFilters();

  return (
    <div className="flex flex-wrap items-center gap-2 py-3">
      <FilterDropdown
        label="Responsável"
        options={RESPONSIBLES.map(r => ({ id: r, label: r }))}
        value={filters.responsible}
        onChange={(v) => setFilter('responsible', v)}
      />
      <FilterDropdown
        label="Status"
        options={STATUSES.map(s => ({ id: s, label: s }))}
        value={filters.status}
        onChange={(v) => setFilter('status', v)}
      />
      <FilterDropdown
        label="Origem"
        options={ORIGINS.map(o => ({ id: o, label: o }))}
        value={filters.origin}
        onChange={(v) => setFilter('origin', v)}
      />
      <FilterDropdown
        label="Prioridade"
        options={PRIORITIES.map(p => ({ id: p, label: p }))}
        value={filters.priority}
        onChange={(v) => setFilter('priority', v)}
      />
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] text-xs font-semibold text-white/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg border border-[#2d2d2d] hover:border-red-500/30 transition-all"
        >
          <X size={12} />
          Limpar Filtros
        </button>
      )}
    </div>
  );
}

export { FilterBar, FilterDropdown };
