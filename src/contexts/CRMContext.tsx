import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { STAGES, STAGE_CONFIG, parseMonetaryValue, calculateTotalValue, groupOrçamentosByStage, type Stage } from '../lib/crmHelpers';
import * as leadService from '../services/leadService';
import * as eventService from '../services/eventService';
import type { ContractClientSource } from '../services/leadService';
import { subscribeInventory, deductInventory, restoreInventory, deductInventoryByEventStockId, restoreInventoryByEventStockId } from '../lib/inventory';
import { addTransaction, updateTransaction, getTransactionByEventId } from '../services/financeService';
import type { Lead, CalendarEvent, OrcamentoItem } from '../types/crm';

export type { Lead, CalendarEvent, OrcamentoItem };

type LeadInput = Omit<Lead, 'id'>;
type LeadUpdate = Partial<Omit<Lead, 'id'>>;

interface CRMContextType {
  /** Clientes com contrato emitido. Orçamento sem contrato vive só em `events`. */
  Orçamentos: Lead[];
  events: CalendarEvent[];
  isLoading: boolean;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  addLead: (lead: LeadInput) => Promise<string | undefined>;
  updateLead: (id: string, fields: LeadUpdate) => Promise<void>;
  updateOrçamentostage: (id: string, stage: string) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;
  /** Grava o cliente na sessão "Clientes" ao emitir o contrato. */
  saveContractClient: (event: ContractClientSource, options?: { contractServices?: string[] }) => Promise<string>;
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

  const saveContractClient = useCallback(
    (event: ContractClientSource, options?: { contractServices?: string[] }) =>
      leadService.saveContractClient(event, options),
    [],
  );

  const deleteLead = useCallback(async (id: string) => {
    // Os itens do orçamento pertencem ao evento, não ao cliente.
    const linkedEvents = events.filter(e => e.clientId === id);
    for (const event of linkedEvents) {
      const eventItems = (event.items || []) as OrcamentoItem[];
      if (eventItems.length === 0) continue;
      await Promise.all(eventItems.map(async item => {
        if (item.eventStockId) {
          await restoreInventoryByEventStockId(item.eventStockId, item.qtdAtual);
        } else {
          await restoreInventory(item.item, item.qtdAtual);
        }
      }));
    }
    await leadService.deleteLead(id);
  }, [events]);

  const addEvent = useCallback(async (event: Omit<CalendarEvent, 'id'>) => {
    const id = await eventService.addEvent(event);
    return id;
  }, []);

  const updateEvent = useCallback(async (id: string, fields: Partial<CalendarEvent>) => {
    const previous = events.find(e => e.id === id);
    await eventService.updateEvent(id, fields);

    // Os itens do orçamento ficam no evento — não dependem de cliente cadastrado.
    const eventItems = (fields.items ?? previous?.items ?? []) as OrcamentoItem[];

    if (fields.status === 'evento_confirmado' && previous?.status !== 'evento_confirmado') {
      if (eventItems.length > 0) {
        await Promise.all(eventItems.map(async item => {
          if (item.eventStockId) {
            await deductInventoryByEventStockId(item.eventStockId, item.qtdAtual);
          } else {
            await deductInventory(item.item, item.qtdAtual);
          }
        }));
      }
    }

    if (previous?.status === 'evento_confirmado' && fields.status !== 'evento_confirmado') {
      if (eventItems.length > 0) {
        await Promise.all(eventItems.map(async item => {
          if (item.eventStockId) {
            await restoreInventoryByEventStockId(item.eventStockId, item.qtdAtual);
          } else {
            await restoreInventory(item.item, item.qtdAtual);
          }
        }));
      }
    }

    if (fields.status === 'evento_concluido' && previous?.status !== 'evento_concluido') {
      const title = fields.title ?? previous?.title ?? 'Evento';
      const client = fields.client ?? previous?.client ?? '';
      const dataEvento = fields.date ?? previous?.date ?? '';
      const eventValue = fields.valorTotal ?? previous?.valorTotal ?? 0;
      const valorOrcamento = eventValue;

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

    if (fields.status === 'orcamento_cancelado' && previous?.status !== 'orcamento_cancelado') {
      getTransactionByEventId(id).then(existing => {
        if (!existing) return;
        updateTransaction(existing.id!, { status: 'Cancelado' })
          .catch(err => console.error('[CRM] Erro ao cancelar fatura do evento:', err));
      });
    }
  }, [events]);

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
    addLead, updateLead, updateOrçamentostage, deleteLead, saveContractClient,
    getOrçamentosByStage, getTotalValueByStage,
    addEvent, updateEvent, deleteEvent, OrçamentosByStage,
  }), [
    Orçamentos, events, isLoading, searchTerm,
    addLead, updateLead, updateOrçamentostage, deleteLead, saveContractClient,
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
