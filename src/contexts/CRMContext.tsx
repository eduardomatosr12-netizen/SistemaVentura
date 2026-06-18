import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { STAGES, STAGE_CONFIG, parseMonetaryValue, calculateTotalValue, groupOrçamentosByStage, type Stage } from '../lib/crmHelpers';
import * as leadService from '../services/leadService';
import * as eventService from '../services/eventService';
import { subscribeInventory } from '../lib/inventory';
import { addTransaction, getTransactionByEventId } from '../services/financeService';

export interface OrcamentoItem {
  id: string;
  item: string;
  qtdAtual: number;
  valorUnit: number;
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
  valorTotal?: number;
}

type LeadInput = Omit<Lead, 'id'>;
type LeadUpdate = Partial<Omit<Lead, 'id'>>;

interface CRMContextType {
  Orçamentos: Lead[];
  events: CalendarEvent[];
  isLoading: boolean;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  addLead: (lead: LeadInput) => Promise<string | undefined>;
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
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const unsubLeads = leadService.subscribeLeads(leads => {
      setOrçamentos(leads);
      setIsLoading(false);
    });
    const unsubEvents = eventService.subscribeEvents(events => {
      setEvents(events);
    });
    const unsubInventory = subscribeInventory();

    return () => {
      unsubLeads();
      unsubEvents();
      unsubInventory();
    };
  }, []);

  const OrçamentosByStage = useMemo(() => groupOrçamentosByStage(Orçamentos), [Orçamentos]);

  const addLead = useCallback((lead: LeadInput) => {
    return leadService.addLead(lead).catch(err => {
      console.error('[CRM] Erro ao adicionar lead:', err);
      return undefined;
    });
  }, []);

  const updateLead = useCallback((id: string, fields: LeadUpdate) => {
    leadService.updateLead(id, fields).catch(err => console.error('[CRM] Erro ao atualizar lead:', err));
  }, []);

  const updateOrçamentostage = useCallback((id: string, stage: string) => {
    leadService.updateLeadStage(id, stage).catch(err => console.error('[CRM] Erro ao atualizar etapa:', err));
  }, []);

  const deleteLead = useCallback((id: string) => {
    leadService.deleteLead(id).catch(err => console.error('[CRM] Erro ao excluir lead:', err));
  }, []);

  const addEvent = useCallback((event: Omit<CalendarEvent, 'id'>) => {
    eventService.addEvent(event).catch(err => console.error('[CRM] Erro ao adicionar evento:', err));
  }, []);

  const updateEvent = useCallback((id: string, fields: Partial<CalendarEvent>) => {
    const previous = events.find(e => e.id === id);
    eventService.updateEvent(id, fields).catch(err => console.error('[CRM] Erro ao atualizar evento:', err));

    if (fields.status === 'realizado' && previous?.status !== 'realizado') {
      const title = fields.title ?? previous?.title ?? 'Evento';
      const client = fields.client ?? previous?.client ?? '';
      const valorTotal = fields.valorTotal ?? previous?.valorTotal ?? 0;
      const dataEvento = fields.date ?? previous?.date ?? '';

      getTransactionByEventId(id).then(existing => {
        if (existing) return;
        addTransaction({
          client,
          description: `Evento: ${title} - ${client}`,
          amount: Number(valorTotal),
          date: dataEvento,
          status: 'Pendente',
          type: 'receita',
          source: 'evento',
          origemEventoId: id,
        }).catch(err => console.error('[CRM] Erro ao criar transação do evento:', err));
      });
    }
  }, [events]);

  const deleteEvent = useCallback((id: string) => {
    eventService.deleteEvent(id).catch(err => console.error('[CRM] Erro ao excluir evento:', err));
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
    Orçamentos, events, isLoading, searchTerm, setSearchTerm,
    addLead, updateLead, updateOrçamentostage, deleteLead,
    getOrçamentosByStage, getTotalValueByStage,
    addEvent, updateEvent, deleteEvent, OrçamentosByStage,
  }), [
    Orçamentos, events, isLoading, searchTerm,
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
