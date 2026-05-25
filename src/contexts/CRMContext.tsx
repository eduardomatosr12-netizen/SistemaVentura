import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { STAGES, STAGE_CONFIG, parseMonetaryValue, calculateTotalValue, groupOrçamentosByStage, type Stage } from '../lib/crmHelpers';
import { generateUUID } from '../lib/uuid';
import * as leadService from '../services/leadService';
import * as eventService from '../services/eventService';
import { loadInventory } from '../lib/inventory';

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
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

export const CRMProvider = ({ children }: { children: ReactNode }) => {
  const [Orçamentos, setOrçamentos] = useState<Lead[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    Promise.all([
      leadService.fetchLeads().then(setOrçamentos),
      eventService.fetchEvents().then(setEvents),
      loadInventory(),
    ]).catch(() => {});
  }, []);

  const OrçamentosByStage = useMemo(() => groupOrçamentosByStage(Orçamentos), [Orçamentos]);

  const addLead = useCallback((lead: LeadInput) => {
    const id = generateUUID();
    const newLead: Lead = { ...lead, id };
    setOrçamentos(prev => [...prev, newLead]);
    leadService.addLead(lead).then(firestoreId => {
      setOrçamentos(prev => prev.map(l => l.id === id ? { ...l, id: firestoreId } : l));
    }).catch(() => {});
  }, []);

  const updateLead = useCallback((id: string, fields: LeadUpdate) => {
    setOrçamentos(prev => prev.map(l => l.id === id ? { ...l, ...fields } : l));
    leadService.updateLead(id, fields).catch(() => {});
  }, []);

  const updateOrçamentostage = useCallback((id: string, stage: string) => {
    setOrçamentos(prev => prev.map(l => l.id === id ? { ...l, stage } : l));
    leadService.updateLeadStage(id, stage).catch(() => {});
  }, []);

  const deleteLead = useCallback((id: string) => {
    setOrçamentos(prev => prev.filter(l => l.id !== id));
    leadService.deleteLead(id).catch(() => {});
  }, []);

  const addEvent = useCallback((event: Omit<CalendarEvent, 'id'>) => {
    const id = generateUUID();
    setEvents(prev => [...prev, { ...event, id }]);
    eventService.addEvent(event).then(firestoreId => {
      setEvents(prev => prev.map(e => e.id === id ? { ...e, id: firestoreId } : e));
    }).catch(() => {});
  }, []);

  const updateEvent = useCallback((id: string, fields: Partial<CalendarEvent>) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...fields } : e));
    eventService.updateEvent(id, fields).catch(() => {});
  }, []);

  const deleteEvent = useCallback((id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    eventService.deleteEvent(id).catch(() => {});
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
    Orçamentos, events, searchTerm, setSearchTerm,
    addLead, updateLead, updateOrçamentostage, deleteLead,
    getOrçamentosByStage, getTotalValueByStage,
    addEvent, updateEvent, deleteEvent, OrçamentosByStage,
  }), [
    Orçamentos, events, searchTerm,
    addLead, updateLead, updateOrçamentostage, deleteLead,
    getOrçamentosByStage, getTotalValueByStage,
    addEvent, updateEvent, deleteEvent, OrçamentosByStage,
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
