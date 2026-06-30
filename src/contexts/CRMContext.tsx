import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { STAGES, STAGE_CONFIG, parseMonetaryValue, calculateTotalValue, groupOrçamentosByStage, type Stage } from '../lib/crmHelpers';
import * as leadService from '../services/leadService';
import * as eventService from '../services/eventService';
import { subscribeInventory, ensureDefaultBoards, deductInventory, restoreInventory } from '../lib/inventory';
import { addTransaction, updateTransaction, getTransactionByEventId } from '../services/financeService';

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
  updateLead: (id: string, fields: LeadUpdate) => Promise<void>;
  updateOrçamentostage: (id: string, stage: string) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;
  getOrçamentosByStage: (stage: string) => Lead[];
  getTotalValueByStage: (stage: string) => number;
  addEvent: (event: Omit<CalendarEvent, 'id'>) => Promise<string>;
  updateEvent: (id: string, event: Partial<CalendarEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
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
    ensureDefaultBoards();
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

  const updateLead = useCallback(async (id: string, fields: LeadUpdate) => {
    await leadService.updateLead(id, fields);
  }, []);

  const updateOrçamentostage = useCallback(async (id: string, stage: string) => {
    await leadService.updateLeadStage(id, stage);
  }, []);

  const deleteLead = useCallback(async (id: string) => {
    await leadService.deleteLead(id);
  }, []);

  const addEvent = useCallback(async (event: Omit<CalendarEvent, 'id'>) => {
    const id = await eventService.addEvent(event);
    return id;
  }, []);

  const updateEvent = useCallback(async (id: string, fields: Partial<CalendarEvent>) => {
    const previous = events.find(e => e.id === id);
    await eventService.updateEvent(id, fields);

    const clientId = fields.clientId ?? previous?.clientId ?? '';
    const lead = Orçamentos.find(o => o.id === clientId);

    if (fields.status === 'confirmado' && previous?.status !== 'confirmado') {
      if (lead?.items && lead.items.length > 0) {
        await Promise.all(lead.items.map(item => deductInventory(item.item, item.qtdAtual)));
      }
    }

    if (previous?.status === 'confirmado' && fields.status !== 'confirmado') {
      if (lead?.items && lead.items.length > 0) {
        await Promise.all(lead.items.map(item => restoreInventory(item.item, item.qtdAtual)));
      }
    }

    if (fields.status === 'realizado' && previous?.status !== 'realizado') {
      const title = fields.title ?? previous?.title ?? 'Evento';
      const client = fields.client ?? previous?.client ?? '';
      const dataEvento = fields.date ?? previous?.date ?? '';
      const eventValue = fields.valorTotal ?? previous?.valorTotal ?? 0;
      const valorOrcamento = lead ? parseMonetaryValue(lead.value) : Number(eventValue);

      getTransactionByEventId(id).then(existing => {
        if (existing) return;
        addTransaction({
          client,
          description: `Evento: ${title} - ${client}`,
          amount: Number(valorOrcamento),
          date: dataEvento,
          status: 'Pendente',
          type: 'receita',
          source: 'evento',
          origemEventoId: id,
        }).catch(err => console.error('[CRM] Erro ao criar transação do evento:', err));
      });
    }

    if (fields.status === 'cancelado' && previous?.status !== 'cancelado') {
      getTransactionByEventId(id).then(existing => {
        if (!existing) return;
        updateTransaction(existing.id!, { status: 'Cancelado' })
          .catch(err => console.error('[CRM] Erro ao cancelar fatura do evento:', err));
      });
    }
  }, [events, Orçamentos]);

  const deleteEvent = useCallback(async (id: string) => {
    await eventService.deleteEvent(id);
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
