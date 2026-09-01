import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';

interface FilterState {
  responsible: string | null;
  status: string | null;
  origin: string | null;
  priority: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  stages: string[];
  niches: string[];
  origins: string[];
  dateFilter: string;
}

interface FilterContextType {
  filters: FilterState;
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  setStagesFilter: (stages: string[]) => void;
  setNichesFilter: (niches: string[]) => void;
  setOriginsFilter: (origins: string[]) => void;
  setDateFilter: (dateFilter: string) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

const defaultFilters: FilterState = {
  responsible: null,
  status: null,
  origin: null,
  priority: null,
  dateFrom: null,
  dateTo: null,
  stages: [],
  niches: [],
  origins: [],
  dateFilter: '',
};

const RESPONSIBLES: string[] = [];
const STATUSES: string[] = [];
const ORIGINS: string[] = [];
const PRIORITIES: string[] = [];

function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);

  const setFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const setStagesFilter = useCallback((stages: string[]) => {
    setFilters(prev => ({ ...prev, stages }));
  }, []);

  const setNichesFilter = useCallback((niches: string[]) => {
    setFilters(prev => ({ ...prev, niches }));
  }, []);

  const setOriginsFilter = useCallback((origins: string[]) => {
    setFilters(prev => ({ ...prev, origins }));
  }, []);

  const setDateFilter = useCallback((dateFilter: string) => {
    setFilters(prev => ({ ...prev, dateFilter }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ ...defaultFilters });
  }, []);

  const hasActiveFilters = useMemo(() =>
    (filters.stages?.length ?? 0) > 0 || 
    (filters.niches?.length ?? 0) > 0 ||
    (filters.origins?.length ?? 0) > 0 || 
    filters.dateFilter !== '' ||
    filters.responsible !== null ||
    filters.status !== null ||
    filters.origin !== null ||
    filters.priority !== null ||
    filters.dateFrom !== null ||
    filters.dateTo !== null,
    [filters]
  );

  return (
    <FilterContext.Provider value={{ filters, setFilter, setStagesFilter, setNichesFilter, setOriginsFilter, setDateFilter, clearFilters, hasActiveFilters }}>
      {children}
    </FilterContext.Provider>
  );
}

function useFilters() {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
}

export { FilterProvider, useFilters, RESPONSIBLES, STATUSES, ORIGINS, PRIORITIES };