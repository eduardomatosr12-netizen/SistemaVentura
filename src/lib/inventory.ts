import { generateUUID } from './uuid';

export interface InventoryColumn {
  id: string;
  title: string;
  type: string;
  width: number;
}

export interface InventoryRow {
  id: string;
  values: Record<string, unknown>;
}

export interface InventoryBoard {
  id: string;
  title: string;
  color: string;
  columns: InventoryColumn[];
  rows: InventoryRow[];
}

const BOARDS_KEY = 'axium_boards_v3';
const ORCAMENTOS_KEY = 'axium_Orçamentos_v2';
const STAGE_FECHADO = 'Contrato Fechado';

export const getBoards = (): InventoryBoard[] => {
  const stored = localStorage.getItem(BOARDS_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const saveBoards = (boards: InventoryBoard[]) => {
  localStorage.setItem(BOARDS_KEY, JSON.stringify(boards));
};

export interface InventoryItemInfo {
  row: InventoryRow;
  board: InventoryBoard;
  itemName: string;
  currentQty: number;
}

export const findInventoryItem = (itemName: string): InventoryItemInfo | null => {
  const boards = getBoards();
  for (const board of boards) {
    for (const row of board.rows) {
      const name = String(row.values['col-1'] || '');
      if (name.toLowerCase() === itemName.toLowerCase()) {
        return {
          row,
          board,
          itemName: name,
          currentQty: Number(row.values['col-3']) || 0,
        };
      }
    }
  }
  return null;
};

interface FechadoOrcamentoItem {
  descricao: string;
  quantidade: number;
}

interface FechadoOrcamento {
  id: string;
  name?: string;
  stage?: string;
  items?: FechadoOrcamentoItem[];
  firstContact?: string;
}

interface StoredEvent {
  id: string;
  client?: string;
  clientPhone?: string;
  date?: string;
  status?: string;
}

export const getReservedQuantity = (itemName: string, eventDate: string): number => {
  try {
    const stored = localStorage.getItem(ORCAMENTOS_KEY);
    if (!stored) return 0;
    const orcamentos: FechadoOrcamento[] = JSON.parse(stored);

    // Only count items from orçamentos whose linked event has status 'confirmado' or 'realizado'
    const eventsStored = localStorage.getItem('axium_events_v2');
    const events: StoredEvent[] = eventsStored ? JSON.parse(eventsStored) : [];

    const confirmedClientNames = new Set(
      events
        .filter(e => e.date === eventDate && (e.status === 'confirmado' || e.status === 'realizado') && e.client)
        .map(e => e.client!.toLowerCase())
    );

    return orcamentos
      .filter(o => {
        if (!o.items || o.items.length === 0) return false;
        if (o.firstContact !== eventDate) return false;
        if (!o.name) return false;
        return confirmedClientNames.has(o.name.toLowerCase());
      })
      .flatMap(o => o.items || [])
      .filter(i => i.descricao && i.descricao.toLowerCase() === itemName.toLowerCase())
      .reduce((sum, i) => sum + (i.quantidade || 0), 0);
  } catch {
    return 0;
  }
};

export const getAvailableQuantity = (itemName: string, eventDate: string): number => {
  const info = findInventoryItem(itemName);
  if (!info) return 0;
  const reserved = getReservedQuantity(itemName, eventDate);
  return Math.max(0, info.currentQty - reserved);
};

export const deductInventory = (itemName: string, quantity: number): void => {
  const boards = getBoards();
  for (const board of boards) {
    for (const row of board.rows) {
      const name = String(row.values['col-1'] || '');
      if (name.toLowerCase() === itemName.toLowerCase()) {
        const current = Number(row.values['col-3']) || 0;
        row.values['col-3'] = Math.max(0, current - quantity);
        saveBoards(boards);
        return;
      }
    }
  }
};

export const restoreInventory = (itemName: string, quantity: number): void => {
  const boards = getBoards();
  for (const board of boards) {
    for (const row of board.rows) {
      const name = String(row.values['col-1'] || '');
      if (name.toLowerCase() === itemName.toLowerCase()) {
        const current = Number(row.values['col-3']) || 0;
        row.values['col-3'] = current + quantity;
        saveBoards(boards);
        return;
      }
    }
  }
};

export const getAllInventoryItems = (): { name: string; qty: number; category: string }[] => {
  const boards = getBoards();
  const items: { name: string; qty: number; category: string }[] = [];
  for (const board of boards) {
    for (const row of board.rows) {
      const name = String(row.values['col-1'] || '');
      if (!name) continue;
      items.push({
        name,
        qty: Number(row.values['col-3']) || 0,
        category: String(row.values['col-2'] || board.title),
      });
    }
  }
  return items;
};
