import { useMemo, useCallback, useState, useRef } from 'react';
import { useCRM } from '../contexts/CRMContext';

export interface AppNotification {
  id: string;
  title: string;
  description: string;
  time: string;
  timestamp: string;
  isRead: boolean;
  type: 'novo_cliente' | 'orcamento_pendente' | 'evento_proximo' | 'fechamento' | 'equipamento' | 'financeiro';
  link: string;
}

const READ_STATE_KEY = 'axium_notifications_read';
const DISMISSED_KEY = 'axium_notifications_dismissed';
const MAX_NOTIFICATIONS = 50;

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return '—';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Agora';
  if (diffMin < 60) return `${diffMin} min atrás`;
  if (diffHours < 24) return `${diffHours} hora${diffHours > 1 ? 's' : ''} atrás`;
  if (diffDays < 30) return `${diffDays} dia${diffDays > 1 ? 's' : ''} atrás`;
  return date.toLocaleDateString('pt-BR');
}

function loadReadMap(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(READ_STATE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveReadMap(map: Record<string, boolean>): void {
  localStorage.setItem(READ_STATE_KEY, JSON.stringify(map));
}

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(set: Set<string>): void {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
}

export function useNotifications() {
  const { Orçamentos, events } = useCRM();
  const [readMap, setReadMap] = useState<Record<string, boolean>>(loadReadMap);
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed);
  const notificationsRef = useRef<AppNotification[]>([]);

  const notifications = useMemo<AppNotification[]>(() => {
    const list: AppNotification[] = [];
    const now = new Date();
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const nowISO = now.toISOString();

    for (const lead of Orçamentos) {
      if (lead.stage === 'Novos Orçamentos') {
        const id = `novo_cliente-${lead.id}`;
        list.push({
          id, title: 'Novo Cliente',
          description: `Novo cliente ${lead.name} foi cadastrado`,
          time: formatRelativeTime(lead.firstContact),
          timestamp: lead.firstContact || nowISO,
          isRead: readMap[id] || false,
          type: 'novo_cliente', link: '/crm/orcamentos',
        });
      }

      if (lead.stage === 'Proposta Enviada') {
        const id = `orcamento_pendente-${lead.id}`;
        list.push({
          id, title: 'Orçamento Pendente',
          description: `Orçamento de ${lead.name} está pendente de aprovação`,
          time: formatRelativeTime(lead.firstContact),
          timestamp: lead.firstContact || nowISO,
          isRead: readMap[id] || false,
          type: 'orcamento_pendente', link: '/contatos',
        });
      }

      if (lead.stage === 'Contrato Fechado') {
        const id = `fechamento-${lead.id}`;
        list.push({
          id, title: 'Fechamento',
          description: `Novo fechamento registrado: ${lead.name} - ${lead.value}`,
          time: formatRelativeTime(lead.closingDate || lead.firstContact),
          timestamp: lead.closingDate || lead.firstContact || nowISO,
          isRead: readMap[id] || false,
          type: 'fechamento', link: '/crm/orcamentos',
        });
      }
    }

    for (const event of events) {
      const eventDate = new Date(event.date);
      if (eventDate < now || eventDate > sevenDaysFromNow) continue;
      const id = `evento_proximo-${event.id}`;
      const daysUntil = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      list.push({
        id, title: 'Evento Próximo',
        description: `Evento ${event.title} em ${daysUntil} ${daysUntil === 1 ? 'dia' : 'dias'}`,
        time: formatRelativeTime(event.date),
        timestamp: event.date,
        isRead: readMap[id] || false,
        type: 'evento_proximo', link: '/crm/calendario',
      });
    }

    try {
      const boards = JSON.parse(localStorage.getItem('axium_boards_v3') || '[]');
      for (const board of boards) {
        for (const row of board.rows || []) {
          const name = String(row.values?.['col-1'] || '');
          const qty = Number(row.values?.['col-3']) || 0;
          if (!name || qty !== 0) continue;
          const id = `equipamento-${row.id}`;
          list.push({
            id, title: 'Equipamento Indisponível',
            description: `Equipamento ${name} está totalmente alugado`,
            time: 'Agora', timestamp: nowISO,
            isRead: readMap[id] || false,
            type: 'equipamento', link: '/tarefas',
          });
        }
      }
    } catch {}

    try {
      const financeData = JSON.parse(localStorage.getItem('axium_finance_v1') || '{}');
      const manualInvoices: any[] = financeData.manualInvoices || [];
      for (const inv of manualInvoices) {
        if (inv.status !== 'Pendente') continue;
        const id = `financeiro-${inv.id}`;
        list.push({
          id, title: 'Transação Pendente',
          description: `Transação ${inv.client} está pendente de confirmação`,
          time: formatRelativeTime(inv.date),
          timestamp: inv.date || nowISO,
          isRead: readMap[id] || false,
          type: 'financeiro', link: '/financeiro',
        });
      }
    } catch {}

    try {
      const expenses: any[] = JSON.parse(localStorage.getItem('axium_expenses_v1') || '[]');
      for (const exp of expenses) {
        if (exp.status !== 'Pendente') continue;
        const id = `financeiro-${exp.id}`;
        list.push({
          id, title: 'Transação Pendente',
          description: `Transação ${exp.description} está pendente de confirmação`,
          time: formatRelativeTime(exp.date),
          timestamp: exp.date || nowISO,
          isRead: readMap[id] || false,
          type: 'financeiro', link: '/financeiro',
        });
      }
    } catch {}

    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return list.slice(0, MAX_NOTIFICATIONS).filter(n => !dismissed.has(n.id));
  }, [Orçamentos, events, readMap, dismissed]);

  notificationsRef.current = notifications;

  const unreadCount = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications]);

  const markAsRead = useCallback((id: string) => {
    setReadMap(prev => {
      if (prev[id]) return prev;
      const next = { ...prev, [id]: true };
      saveReadMap(next);
      return next;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setReadMap(prev => {
      const next = { ...prev };
      let changed = false;
      for (const n of notificationsRef.current) {
        if (!next[n.id]) {
          next[n.id] = true;
          changed = true;
        }
      }
      if (!changed) return prev;
      saveReadMap(next);
      return next;
    });
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setDismissed(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
  }, []);

  const dismissAll = useCallback(() => {
    setDismissed(prev => {
      const next = new Set(prev);
      for (const n of notificationsRef.current) {
        next.add(n.id);
      }
      saveDismissed(next);
      return next;
    });
    setReadMap(prev => {
      const next = { ...prev };
      for (const n of notificationsRef.current) {
        next[n.id] = true;
      }
      saveReadMap(next);
      return next;
    });
  }, []);

  return { notifications, unreadCount, markAsRead, markAllAsRead, dismissNotification, dismissAll };
}
