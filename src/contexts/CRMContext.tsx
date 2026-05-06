import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { STAGES, STAGE_CONFIG, parseMonetaryValue, calculateTotalValue, groupLeadsByStage, type Stage } from '../lib/crmHelpers';
import { generateUUID } from '../lib/uuid';

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
  gmnReviews: string;
  gmnStars: string;
  notes: string;
  value: string;
  lastModifiedBy?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  createdBy?: string;
  activityType?: string;
  dateTime: string;
  meetingLink?: string;
  description?: string;
}

export interface Notification {
  id: string;
  title: string;
  description: string;
  time: string;
  isRead: boolean;
  type: 'lead' | 'meeting' | 'system';
}

type LeadInput = Omit<Lead, 'id'>;
type LeadUpdate = Partial<Omit<Lead, 'id'>>;

interface CRMContextType {
  leads: Lead[];
  events: CalendarEvent[];
  searchTerm: string;
  notifications: Notification[];
  setSearchTerm: (term: string) => void;
  markNotificationsAsRead: () => void;
  addLead: (lead: LeadInput) => void;
  updateLead: (id: string, fields: LeadUpdate) => void;
  updateLeadStage: (id: string, stage: string) => void;
  deleteLead: (id: string) => void;
  getLeadsByStage: (stage: string) => Lead[];
  getTotalValueByStage: (stage: string) => number;
  addEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  updateEvent: (id: string, event: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  leadsByStage: Record<Stage, Lead[]>;
  totalPipelineValue: number;
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

const INITIAL_LEADS: Lead[] = [
  {
    id: '1', name: 'João Silva', niche: 'Odontologia', whatsapp: '11 99999-9999',
    email: 'joao@example.com', instagram: '@joaosilva', stage: 'Reunião Agendada',
    firstContact: '2026-04-01', closingDate: '2026-04-30', followUpReminder: '2026-04-22',
    address: 'São Paulo - SP', gmnReviews: '248', gmnStars: '4.7',
    notes: 'Cliente interessado no plano premium.', value: 'R$ 5.000',
  },
  {
    id: '2', name: 'Maria Santos', niche: 'Dermatologia', whatsapp: '11 88888-8888',
    email: 'maria@example.com', instagram: '@mariasan', stage: 'Novos Leads',
    firstContact: '2026-04-10', closingDate: '', followUpReminder: '2026-04-25',
    address: 'Rio de Janeiro - RJ', gmnReviews: '89', gmnStars: '4.2',
    notes: '', value: 'R$ 8.000',
  },
  {
    id: '3', name: 'Pedro Oliveira', niche: 'Clínica Geral', whatsapp: '11 77777-7777',
    email: 'pedro@example.com', instagram: '@pedrooli', stage: 'Proposta Enviada',
    firstContact: '2026-03-20', closingDate: '2026-05-15', followUpReminder: '2026-04-23',
    address: 'Belo Horizonte - MG', gmnReviews: '312', gmnStars: '4.9',
    notes: 'Aguardando aprovação da proposta.', value: 'R$ 12.000',
  },
  {
    id: '4', name: 'Clínica Sorriso', niche: 'Odontologia', whatsapp: '11 5555-5555',
    email: 'contato@sorriso.com', instagram: '@clinicasorriso', stage: 'Contrato Fechado',
    firstContact: '2026-03-10', closingDate: '2026-04-15', followUpReminder: '',
    address: 'Curitiba - PR', gmnReviews: '150', gmnStars: '4.8',
    notes: 'Contrato fechado!', value: 'R$ 15.000',
  }
];

const INITIAL_EVENTS: CalendarEvent[] = [
  {
    id: '1',
    title: 'Reunião com Cliente A',
    createdBy: 'Admin',
    activityType: 'Reunião',
    dateTime: '2026-04-21T10:00:00',
    meetingLink: 'https://meet.google.com/abc-defg-hij',
    description: 'Apresentação do plano premium.'
  },
  {
    id: '2',
    title: 'Follow-up Leads',
    createdBy: 'Vendedor 1',
    activityType: 'Ligação',
    dateTime: '2026-04-21T14:00:00',
    description: 'Retornar contato para leads qualificados.'
  },
  {
    id: '3',
    title: 'Revisão de Pipeline',
    createdBy: 'Gerente',
    activityType: 'Treinamento',
    dateTime: '2026-04-22T16:00:00',
    description: 'Alinhamento de metas semanais.'
  }
];

const INITIAL_NOTIFICATIONS: Notification[] = [
  { id: '1', title: 'Novo Lead Criado', description: 'O lead "Clínica Saúde" foi adicionado via importação.', time: '5 min atrás', isRead: false, type: 'lead' },
  { id: '2', title: 'Reunião em breve', description: 'Sua reunião com João Silva começa em 15 minutos.', time: '10 min atrás', isRead: false, type: 'meeting' },
  { id: '3', title: 'Follow-up pendente', description: 'Você tem 3 follow-ups agendados para hoje.', time: '1 hora atrás', isRead: true, type: 'system' },
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

// Função removida - usar generateUUID de ../lib/uuid

export const CRMProvider = ({ children }: { children: ReactNode }) => {
  const [leads, setLeads] = useState<Lead[]>(() => {
    const storageKey = 'axium_leads_v2';
    let loaded: Lead[] = [];
    
    // Debug localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey);
      console.log('[DEBUG CRMProvider] raw localStorage:', stored);
    }
    
    loaded = loadFromStorage(storageKey, INITIAL_LEADS);
    console.log('[DEBUG CRMProvider] Carregando leads do localStorage:', loaded?.length ?? 0, loaded);
    
    // Fallback: se vazio ou undefined, usa dados iniciais
    if (!loaded || !Array.isArray(loaded) || loaded.length === 0) {
      console.log('[DEBUG CRMProvider] Usando INITIAL_LEADS como fallback');
      loaded = INITIAL_LEADS;
    }
    
    // Debug final
    console.log('[DEBUG CRMProvider] Leads finais:', loaded?.length ?? 0);
    return loaded;
  });
  const [events, setEvents] = useState<CalendarEvent[]>(() => loadFromStorage('axium_events_v2', INITIAL_EVENTS));
  const [searchTerm, setSearchTerm] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);

  useEffect(() => {
    localStorage.setItem('axium_leads_v2', JSON.stringify(leads));
  }, [leads]);

  useEffect(() => {
    localStorage.setItem('axium_events_v2', JSON.stringify(events));
  }, [events]);

  const leadsByStage = useMemo(() => groupLeadsByStage(leads), [leads]);
  
  const totalPipelineValue = useMemo(() => calculateTotalValue(leads), [leads]);

  const markNotificationsAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  }, []);

  const addLead = useCallback((lead: LeadInput) => {
    const id = generateUUID();
    const newLead: Lead = { ...lead, id };
    
    setLeads(prev => [...prev, newLead]);
    
    setNotifications(prev => [{
      id: generateUUID(),
      title: 'Novo Lead',
      description: `${lead.name} foi adicionado ao sistema.`,
      time: 'Agora',
      isRead: false,
      type: 'lead'
    } as Notification, ...prev]);
  }, []);

  const updateLead = useCallback((id: string, fields: LeadUpdate) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...fields } : l));
  }, []);

  const updateLeadStage = useCallback((id: string, stage: string) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, stage } : l));
  }, []);

  const deleteLead = useCallback((id: string) => {
    setLeads(prev => prev.filter(l => l.id !== id));
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

  const getLeadsByStage = useCallback((stage: string) => {
    return leads.filter(l => l.stage === stage);
  }, [leads]);

  const getTotalValueByStage = useCallback((stage: string) => {
    return leads
      .filter(l => l.stage === stage)
      .reduce((acc, lead) => acc + parseMonetaryValue(lead.value), 0);
  }, [leads]);

  const value = useMemo(() => ({
    leads,
    events,
    searchTerm,
    notifications,
    setSearchTerm,
    markNotificationsAsRead,
    addLead,
    updateLead,
    updateLeadStage,
    deleteLead,
    getLeadsByStage,
    getTotalValueByStage,
    addEvent,
    updateEvent,
    deleteEvent,
    leadsByStage,
    totalPipelineValue,
  }), [
    leads,
    events,
    searchTerm,
    notifications,
    markNotificationsAsRead,
    addLead,
    updateLead,
    updateLeadStage,
    deleteLead,
    getLeadsByStage,
    getTotalValueByStage,
    addEvent,
    updateEvent,
    deleteEvent,
    leadsByStage,
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