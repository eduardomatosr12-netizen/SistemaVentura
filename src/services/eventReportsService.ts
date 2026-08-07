import { fetchEvents } from './eventService';
import { fetchEventStock } from './eventStockService';
import type { OrcamentoItem } from '../types/crm';

export const EVENT_ACTIVE_STATUS = ['confirmado', 'realizado'] as const;

export interface ReportItemUsage {
  key: string;
  name: string;
  qty: number;
  valor: number;
}

export interface MonthlyUsage {
  monthIndex: number;
  label: string;
  total: number;
}

export interface EventUsageReport {
  year: number;
  totalSaidas: number;
  eventsCount: number;
  topItems: ReportItemUsage[];
  allItems: ReportItemUsage[];
  monthly: MonthlyUsage[];
  mostProfitable: ReportItemUsage | null;
}

export interface StockMetrics {
  totalRegistered: number;
  itemsInEvents: number;
  itemsInEventsCount: number;
}

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const baseItemName = (display: string): string => display.split(' — ')[0].trim() || display.trim();

const itemKey = (item: OrcamentoItem): { key: string; name: string } => {
  if (item.eventStockId) {
    return { key: `stock:${item.eventStockId}`, name: baseItemName(item.item) };
  }
  const name = baseItemName(item.item);
  return { key: `name:${name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`, name };
};

const dateToMonthIndex = (date: string): number | null => {
  if (!date) return null;
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.getMonth();
};

export const fetchEventUsageReport = async (year: number): Promise<EventUsageReport> => {
  const [events, stock] = await Promise.all([fetchEvents(), fetchEventStock()]);
  const stockById = new Map(stock.map(s => [s.id, s]));

  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

  const yearEvents = events.filter(e =>
    EVENT_ACTIVE_STATUS.includes((e.status || '') as (typeof EVENT_ACTIVE_STATUS)[number])
    && e.date
    && (() => {
      const t = new Date(`${e.date}T00:00:00`);
      return !Number.isNaN(t.getTime()) && t >= yearStart && t < yearEnd;
    })()
  );

  const usage = new Map<string, ReportItemUsage>();
  const monthly: MonthlyUsage[] = MONTH_LABELS.map((label, monthIndex) => ({ monthIndex, label, total: 0 }));

  for (const event of yearEvents) {
    const monthIndex = dateToMonthIndex(event.date);
    for (const item of (event.items || [])) {
      const { key, name } = itemKey(item);
      const qty = item.qtdAtual || 1;
      const current = usage.get(key) || { key, name, qty: 0, valor: 0 };
      current.qty += qty;
      const ref = item.eventStockId ? (stockById.get(item.eventStockId)?.valorReferencia || 0) : 0;
      current.valor += qty * ref;
      usage.set(key, current);
      if (monthIndex !== null) monthly[monthIndex].total += qty;
    }
  }

  const allItems = [...usage.values()].sort((a, b) => b.qty - a.qty);

  const topItems = allItems.length <= 6
    ? allItems
    : [
        ...allItems.slice(0, 5),
        {
          key: 'outros',
          name: 'Outros',
          qty: allItems.slice(5).reduce((sum, i) => sum + i.qty, 0),
          valor: allItems.slice(5).reduce((sum, i) => sum + i.valor, 0),
        },
      ];

  const totalSaidas = allItems.reduce((sum, i) => sum + i.qty, 0);
  const mostProfitable = allItems.filter(i => i.valor > 0).sort((a, b) => b.valor - a.valor)[0] || null;

  return {
    year,
    totalSaidas,
    eventsCount: yearEvents.length,
    topItems,
    allItems,
    monthly,
    mostProfitable,
  };
};

export const fetchStockMetrics = async (): Promise<StockMetrics> => {
  const [stock, events] = await Promise.all([fetchEventStock(), fetchEvents()]);
  const activeEvents = events.filter(e => e.status !== 'cancelado' && e.status !== undefined);
  const itemsInEvents = activeEvents.reduce(
    (sum, e) => sum + (e.items || []).reduce((x, item) => x + (item.qtdAtual || 0), 0),
    0
  );
  const itemsInEventsCount = activeEvents.reduce((sum, e) => sum + (e.items || []).length, 0);
  return {
    totalRegistered: stock.length,
    itemsInEvents,
    itemsInEventsCount,
  };
};
