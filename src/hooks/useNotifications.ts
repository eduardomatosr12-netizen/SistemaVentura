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

const MAX_NOTIFICATIONS = 50;

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';
  const now = new Date();
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

export function useNotifications() {
  const { Orçamentos, events } = useCRM();
  const [readMap, setReadMap] = useState<Record<string, boolean>>({});
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const notificationsRef = useRef<AppNotification[]>([]);

  const notifications = useMemo<AppNotification[]>(() => {
    const list: AppNotification[] = [];
    const now = new Date();
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const nowISO = now.toISOString();

    for (const lead of Orçamentos) {
      const leadName = lead.name || 'Cliente';
      const leadValue = lead.value || '';

      if (lead.stage === 'Novos Orçamentos') {
        const id = `novo_cliente-${lead.id}`;
        list.push({
          id, title: 'Novo Cliente',
          description: `Novo cliente ${leadName} foi cadastrado`,
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
          description: `Orçamento de ${leadName} está pendente de aprovação`,
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
          description: `Novo fechamento registrado: ${leadName} - ${leadValue}`,
          time: formatRelativeTime(lead.closingDate || lead.firstContact),
          timestamp: lead.closingDate || lead.firstContact || nowISO,
          isRead: readMap[id] || false,
          type: 'fechamento', link: '/crm/orcamentos',
        });
      }
    }

    for (const event of events) {
      const eventDate = new Date(event.date);
      if (isNaN(eventDate.getTime())) continue;
      if (eventDate < now || eventDate > sevenDaysFromNow) continue;
      const id = `evento_proximo-${event.id}`;
      const daysUntil = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      list.push({
        id, title: 'Evento Próximo',
        description: `Evento ${event.title || ''} em ${daysUntil} ${daysUntil === 1 ? 'dia' : 'dias'}`,
        time: formatRelativeTime(event.date),
        timestamp: event.date,
        isRead: readMap[id] || false,
        type: 'evento_proximo', link: '/crm/calendario',
      });
    }



    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return list.slice(0, MAX_NOTIFICATIONS).filter(n => !dismissed.has(n.id));
  }, [Orçamentos, events, readMap, dismissed]);

  notificationsRef.current = notifications;

  const unreadCount = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications]);

  const markAsRead = useCallback((id: string) => {
    setReadMap(prev => {
      if (prev[id]) return prev;
      return { ...prev, [id]: true };
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
      return changed ? next : prev;
    });
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setDismissed(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const dismissAll = useCallback(() => {
    setDismissed(prev => {
      const next = new Set(prev);
      for (const n of notificationsRef.current) {
        next.add(n.id);
      }
      return next;
    });
    setReadMap(prev => {
      const next = { ...prev };
      for (const n of notificationsRef.current) {
        next[n.id] = true;
      }
      return next;
    });
  }, []);

  return { notifications, unreadCount, markAsRead, markAllAsRead, dismissNotification, dismissAll };
}
