import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { STAGES, STAGE_CONFIG, parseMonetaryValue, calculateTotalValue, groupOrçamentosByStage, type Stage } from '../lib/crmHelpers';
import { generateUUID } from '../lib/uuid';

export interface OrcamentoItem {
  id: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
}

export interface Lead {
  id: string;
  name: string;
  niche: string;
  whatsapp: string;
  email: string;
  instagram: string;
  stage: string;
  origin?: string;
  firstContact: string;
  closingDate: string;
  followUpReminder: string;
  address: string;
  notes: string;
  value: string;
  items?: OrcamentoItem[];
  lastModifiedBy?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  client?: string;
  clientId?: string;
  eventType?: string;
  date: string;
  time?: string;
  local?: string;
  decorator?: string;
  city?: string;
  description?: string;
  equipe?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientCpf?: string;
  status?: 'confirmado' | 'pendente' | 'cancelado' | 'realizado';
  dataMontagem?: string;
  dataDesmontagem?: string;
}

type LeadInput = Omit<Lead, 'id'>;
type LeadUpdate = Partial<Omit<Lead, 'id'>>;

interface CRMContextType {
  Orçamentos: Lead[];
  events: CalendarEvent[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  addLead: (lead: LeadInput) => void;
  updateLead: (id: string, fields: LeadUpdate) => void;
  updateOrçamentostage: (id: string, stage: string) => void;
  deleteLead: (id: string) => void;
  getOrçamentosByStage: (stage: string) => Lead[];
  getTotalValueByStage: (stage: string) => number;
  addEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  updateEvent: (id: string, event: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  OrçamentosByStage: Record<Stage, Lead[]>;
  totalPipelineValue: number;
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

const INITIAL_Orçamentos: Lead[] = [
  {
    id: '1', name: 'João Silva', niche: 'Odontologia', whatsapp: '11 99999-9999',
    email: 'joao@example.com', instagram: '@joaosilva', stage: 'Reunião Agendada',
    firstContact: '2026-04-01', closingDate: '2026-04-30', followUpReminder: '2026-04-22',
    address: 'São Paulo - SP',
    notes: 'Cliente interessado no plano premium.', value: 'R$ 5.000',
  },
  {
    id: '2', name: 'Maria Santos', niche: 'Dermatologia', whatsapp: '11 88888-8888',
    email: 'maria@example.com', instagram: '@mariasan', stage: 'Novos Orçamentos',
    firstContact: '2026-04-10', closingDate: '', followUpReminder: '2026-04-25',
    address: 'Rio de Janeiro - RJ',
    notes: '', value: 'R$ 8.000',
  },
  {
    id: '3', name: 'Pedro Oliveira', niche: 'Clínica Geral', whatsapp: '11 77777-7777',
    email: 'pedro@example.com', instagram: '@pedrooli', stage: 'Proposta Enviada',
    firstContact: '2026-03-20', closingDate: '2026-05-15', followUpReminder: '2026-04-23',
    address: 'Belo Horizonte - MG',
    notes: 'Aguardando aprovação da proposta.', value: 'R$ 12.000',
  },
  {
    id: '4', name: 'Clínica Sorriso', niche: 'Odontologia', whatsapp: '11 5555-5555',
    email: 'contato@sorriso.com', instagram: '@clinicasorriso', stage: 'Contrato Fechado',
    firstContact: '2026-03-10', closingDate: '2026-04-15', followUpReminder: '',
    address: 'Curitiba - PR',
    notes: 'Contrato fechado!', value: 'R$ 15.000',
  }
];

const INITIAL_EVENTS: CalendarEvent[] = [
  {
    id: '1',
    title: 'Reunião com Cliente A',
    client: 'Cliente A',
    eventType: 'Reunião',
    date: '2026-04-21',
    decorator: 'Decorador',
    city: 'São Paulo'
  },
  {
    id: '2',
    title: 'Follow-up Orçamentos',
    client: 'Vendedor 1',
    eventType: 'Ligação',
    date: '2026-04-21',
    city: 'Rio de Janeiro'
  },
  {
    id: '3',
    title: 'Revisão de Pipeline',
    client: 'Gerente',
    eventType: 'Treinamento',
    date: '2026-04-22',
    city: 'Belo Horizonte'
  }
];

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return fallback;
    
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export const CRMProvider = ({ children }: { children: ReactNode }) => {
  const [Orçamentos, setOrçamentos] = useState<Lead[]>(() => {
    const storageKey = 'axium_Orçamentos_v2';
    let loaded: Lead[] = [];
    
    // Debug localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey);
      console.log('[DEBUG CRMProvider] raw localStorage:', stored);
    }
    
    loaded = loadFromStorage(storageKey, INITIAL_Orçamentos);
    console.log('[DEBUG CRMProvider] Carregando Orçamentos do localStorage:', loaded?.length ?? 0, loaded);
    
    // Fallback: se vazio ou undefined, usa dados iniciais
    if (!loaded || !Array.isArray(loaded) || loaded.length === 0) {
      console.log('[DEBUG CRMProvider] Usando INITIAL_Orçamentos como fallback');
      loaded = INITIAL_Orçamentos;
    }
    
    // Debug final
    console.log('[DEBUG CRMProvider] Orçamentos finais:', loaded?.length ?? 0);
    return loaded;
  });
  const [events, setEvents] = useState<CalendarEvent[]>(() => loadFromStorage('axium_events_v2', INITIAL_EVENTS));
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    localStorage.setItem('axium_Orçamentos_v2', JSON.stringify(Orçamentos));
  }, [Orçamentos]);

  useEffect(() => {
    localStorage.setItem('axium_events_v2', JSON.stringify(events));
  }, [events]);

  const OrçamentosByStage = useMemo(() => groupOrçamentosByStage(Orçamentos), [Orçamentos]);
  
  const totalPipelineValue = useMemo(() => calculateTotalValue(Orçamentos), [Orçamentos]);

  const addLead = useCallback((lead: LeadInput) => {
    const id = generateUUID();
    const newLead: Lead = { ...lead, id };
    
    setOrçamentos(prev => [...prev, newLead]);
  }, []);

  const updateLead = useCallback((id: string, fields: LeadUpdate) => {
    setOrçamentos(prev => prev.map(l => l.id === id ? { ...l, ...fields } : l));
  }, []);

  const updateOrçamentostage = useCallback((id: string, stage: string) => {
    setOrçamentos(prev => prev.map(l => l.id === id ? { ...l, stage } : l));
  }, []);

  const deleteLead = useCallback((id: string) => {
    setOrçamentos(prev => prev.filter(l => l.id !== id));
  }, []);

  const addEvent = useCallback((event: Omit<CalendarEvent, 'id'>) => {
    const id = generateUUID();
    setEvents(prev => [...prev, { ...event, id }]);
  }, []);

  const updateEvent = useCallback((id: string, fields: Partial<CalendarEvent>) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...fields } : e));
  }, []);

  const deleteEvent = useCallback((id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
  }, []);

  const getOrçamentosByStage = useCallback((stage: string) => {
    return Orçamentos.filter(l => l.stage === stage);
  }, [Orçamentos]);

  const getTotalValueByStage = useCallback((stage: string) => {
    return Orçamentos
      .filter(l => l.stage === stage)
      .reduce((acc, lead) => acc + parseMonetaryValue(lead.value), 0);
  }, [Orçamentos]);

  const value = useMemo(() => ({
    Orçamentos,
    events,
    searchTerm,
    setSearchTerm,
    addLead,
    updateLead,
    updateOrçamentostage,
    deleteLead,
    getOrçamentosByStage,
    getTotalValueByStage,
    addEvent,
    updateEvent,
    deleteEvent,
    OrçamentosByStage,
    totalPipelineValue,
  }), [
    Orçamentos,
    events,
    searchTerm,
    addLead,
    updateLead,
    updateOrçamentostage,
    deleteLead,
    getOrçamentosByStage,
    getTotalValueByStage,
    addEvent,
    updateEvent,
    deleteEvent,
    OrçamentosByStage,
    totalPipelineValue,
  ]);

  return (
    <CRMContext.Provider value={value}>
      {children}
    </CRMContext.Provider>
  );
};

export const useCRM = () => {
  const context = useContext(CRMContext);
  if (!context) {
    throw new Error('useCRM must be used within a CRMProvider');
  }
  return context;
};