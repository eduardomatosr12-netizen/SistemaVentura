import { useState, useRef, useEffect } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';
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
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
          value
            ? 'bg-black text-white border-black'
            : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
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
        <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-neutral-200 rounded-xl shadow-xl z-[999] overflow-hidden">
          {value && (
            <button
              onClick={() => { onChange(null); setIsOpen(false); }}
              className="w-full px-3 py-2 text-left text-xs font-medium text-neutral-500 hover:bg-neutral-50 border-b border-neutral-100"
            >
              Limpar filtro
            </button>
          )}
          {options.map(opt => (
            <button
              key={opt.id}
              onClick={() => { onChange(opt.id); setIsOpen(false); }}
              className={`w-full px-3 py-2 text-left text-xs font-medium hover:bg-neutral-50 transition-colors ${
                value === opt.id ? 'bg-black text-white' : 'text-neutral-700'
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
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg border border-neutral-200 hover:border-red-200 transition-all"
        >
          <X size={12} />
          Limpar Filtros
        </button>
      )}
    </div>
  );
}

export { FilterBar, FilterDropdown };