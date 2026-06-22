import { generateUUID } from './uuid';
import {
  collection, getDocs, addDoc, updateDoc, doc, query, orderBy, onSnapshot, Timestamp, writeBatch,
} from 'firebase/firestore';
import { db } from '../services/firebase';

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

export interface InventoryItemInfo {
  row: InventoryRow;
  board: InventoryBoard;
  itemName: string;
  currentQty: number;
}

const COLLECTION = 'inventory_boards';
const ORCAMENTOS_COLLECTION = 'leads';
const EVENTS_COLLECTION = 'events';
const STAGE_FECHADO = 'Contrato Fechado';

let boardsCache: InventoryBoard[] | null = null;
let reservedCache: Map<string, number> = new Map();
let reservedCacheDate = '';

const inventoryChangeListeners: Set<() => void> = new Set();

export const subscribeInventoryChanges = (callback: () => void): (() => void) => {
  inventoryChangeListeners.add(callback);
  return () => inventoryChangeListeners.delete(callback);
};

export const loadInventory = async (): Promise<void> => {
  try {
    const q = query(collection(db, COLLECTION), orderBy('title'));
    const snapshot = await getDocs(q);
    boardsCache = snapshot.docs.map(d => ({
      id: d.id,
      title: d.data().title || '',
      color: d.data().color || '',
      columns: d.data().columns || [],
      rows: d.data().rows || [],
    })) as InventoryBoard[];
  } catch (err) {
    console.error('[Inventory] Erro ao carregar inventário:', err);
    boardsCache = [];
  }
};

export const subscribeInventory = (onUpdate?: () => void): () => void => {
  const q = query(collection(db, COLLECTION), orderBy('title'));
  const unsubscribe = onSnapshot(q, snapshot => {
    boardsCache = snapshot.docs.map(d => ({
      id: d.id,
      title: d.data().title || '',
      color: d.data().color || '',
      columns: d.data().columns || [],
      rows: d.data().rows || [],
    })) as InventoryBoard[];
    onUpdate?.();
    inventoryChangeListeners.forEach(cb => cb());
  }, err => console.error('[Firestore] Erro no listener de inventário:', err));
  return unsubscribe;
};

export const refreshReservedCache = async (_eventDate: string): Promise<void> => {
  reservedCache = new Map();
};

export const getBoards = (): InventoryBoard[] => boardsCache || [];

export const saveBoards = async (boards: InventoryBoard[]): Promise<void> => {
  boardsCache = boards;
  try {
    const batch = writeBatch(db);
    for (const board of boards) {
      const ref = doc(db, COLLECTION, board.id);
      batch.set(ref, {
        title: board.title, color: board.color, columns: board.columns, rows: board.rows, updatedAt: Timestamp.now(),
      });
    }
    await batch.commit();
  } catch (err) {
    console.error('[Inventory] Erro ao salvar boards:', err);
  }
};

export const findInventoryItem = (itemName: string): InventoryItemInfo | null => {
  if (!boardsCache) return null;
  for (const board of boardsCache) {
    for (const row of board.rows) {
      const name = String(row.values['col-1'] || '');
      if (name.toLowerCase() === itemName.toLowerCase()) {
        return { row, board, itemName: name, currentQty: Number(row.values['col-3']) || 0 };
      }
    }
  }
  return null;
};

export const getReservedQuantity = (itemName: string, _eventDate: string): number => {
  return reservedCache.get(itemName.toLowerCase()) || 0;
};

export const getAvailableQuantity = (itemName: string, _eventDate: string): number => {
  const info = findInventoryItem(itemName);
  if (!info) return 0;
  return Math.max(0, info.currentQty);
};

export const deductInventory = async (itemName: string, quantity: number): Promise<void> => {
  if (!boardsCache) return;
  for (const board of boardsCache) {
    for (const row of board.rows) {
      const name = String(row.values['col-1'] || '');
      if (name.toLowerCase() === itemName.toLowerCase()) {
        const current = Number(row.values['col-3']) || 0;
        row.values['col-3'] = Math.max(0, current - quantity);
        await saveBoards(boardsCache);
        return;
      }
    }
  }
};

export const restoreInventory = async (itemName: string, quantity: number): Promise<void> => {
  if (!boardsCache) return;
  for (const board of boardsCache) {
    for (const row of board.rows) {
      const name = String(row.values['col-1'] || '');
      if (name.toLowerCase() === itemName.toLowerCase()) {
        const current = Number(row.values['col-3']) || 0;
        row.values['col-3'] = current + quantity;
        await saveBoards(boardsCache);
        return;
      }
    }
  }
};

export const DEFAULT_INVENTORY_ROWS: InventoryRow[] = [
  { id: generateUUID(), values: { 'col-1': 'Painel de Led P3.9 LPS Curvo (50x100)', 'col-2': 'Painel de LED', 'col-3': 9, 'col-4': 18, 'col-5': 'LPG', 'col-6': '', 'col-7': 75, 'col-8': 0 } },
  { id: generateUUID(), values: { 'col-1': 'Par Led 60 Led 3w Rgb Triled', 'col-2': 'Iluminação', 'col-3': 49, 'col-4': 50, 'col-5': 'Mercado Livre', 'col-6': '', 'col-7': 25, 'col-8': 0 } },
  { id: generateUUID(), values: { 'col-1': 'Varal de Lampada Comum (66 Lâmpadas)', 'col-2': 'Iluminação', 'col-3': 3, 'col-4': 1, 'col-5': 'Mercado Livre', 'col-6': '', 'col-7': 200, 'col-8': 0 } },
  { id: generateUUID(), values: { 'col-1': 'Varal de Lampada Japonesa (66 Lâmpadas)', 'col-2': 'Iluminação', 'col-3': 3, 'col-4': 1, 'col-5': 'Mercado Livre', 'col-6': '', 'col-7': 300, 'col-8': 0 } },
  { id: generateUUID(), values: { 'col-1': 'Som - Medio', 'col-2': 'Som', 'col-3': 2, 'col-4': 2, 'col-5': 'Power System', 'col-6': '', 'col-7': 175, 'col-8': 0 } },
  { id: generateUUID(), values: { 'col-1': 'Som - Grave', 'col-2': 'Som', 'col-3': 1, 'col-4': 2, 'col-5': 'Power System', 'col-6': '', 'col-7': 175, 'col-8': 0 } },
  { id: generateUUID(), values: { 'col-1': 'Som Completo (Banda)', 'col-2': 'Som', 'col-3': 1, 'col-4': 1, 'col-5': 'Power System', 'col-6': '', 'col-7': 750, 'col-8': 0 } },
  { id: generateUUID(), values: { 'col-1': 'Som Completo (DJ/Evento)', 'col-2': 'Som', 'col-3': 1, 'col-4': 1, 'col-5': 'Power System', 'col-6': '', 'col-7': 400, 'col-8': 0 } },
  { id: generateUUID(), values: { 'col-1': 'Piso Palco Praticáveis (100x200x)', 'col-2': 'Estrutura', 'col-3': 9, 'col-4': 9, 'col-5': 'Pernambuco Estruturas', 'col-6': '', 'col-7': 80, 'col-8': 0 } },
  { id: generateUUID(), values: { 'col-1': 'Cabine Fotografica Infinite', 'col-2': 'Outros', 'col-3': 1, 'col-4': 1, 'col-5': 'Maxi Grua', 'col-6': '', 'col-7': 500, 'col-8': 0 } },
  { id: generateUUID(), values: { 'col-1': 'Seta de Led', 'col-2': 'Iluminação', 'col-3': 5, 'col-4': 1, 'col-5': 'Maxi Grua', 'col-6': '', 'col-7': 200, 'col-8': 0 } },
  { id: generateUUID(), values: { 'col-1': 'Totem de Led P3.9 (100x200)', 'col-2': 'Painel de LED', 'col-3': 40, 'col-4': 4, 'col-5': 'LPG', 'col-6': '', 'col-7': 300, 'col-8': 0 } },
  { id: generateUUID(), values: { 'col-1': 'Piso Paris Galáxia', 'col-2': 'Estrutura', 'col-3': 1, 'col-4': 16, 'col-5': 'Milleto', 'col-6': '', 'col-7': 50, 'col-8': 0 } },
  { id: generateUUID(), values: { 'col-1': 'Moving Beem 14R LPG', 'col-2': 'Iluminação', 'col-3': 0, 'col-4': 4, 'col-5': 'LPG', 'col-6': '', 'col-7': 150, 'col-8': 0 } },
  { id: generateUUID(), values: { 'col-1': 'Refletor Holofote Super Led 50w - BR', 'col-2': 'Iluminação', 'col-3': 0, 'col-4': 0, 'col-5': 'Ipojuca - Caruaru', 'col-6': '', 'col-7': 25, 'col-8': 0 } },
  { id: generateUUID(), values: { 'col-1': 'Refletor Par 38', 'col-2': 'Iluminação', 'col-3': 0, 'col-4': 20, 'col-5': 'Mercado Livre', 'col-6': '', 'col-7': 25, 'col-8': 0 } },
  { id: generateUUID(), values: { 'col-1': 'Refletor Holofote Led 30W - PT', 'col-2': 'Iluminação', 'col-3': 0, 'col-4': 24, 'col-5': 'Mercado Livre', 'col-6': '', 'col-7': 25, 'col-8': 0 } },
  { id: generateUUID(), values: { 'col-1': 'Refletor Holofote Led 30W - BR', 'col-2': 'Iluminação', 'col-3': 0, 'col-4': 12, 'col-5': 'Mercado Livre', 'col-6': '', 'col-7': 25, 'col-8': 0 } },
  { id: generateUUID(), values: { 'col-1': 'Refletor Holofote Led 200w - PT', 'col-2': 'Iluminação', 'col-3': 0, 'col-4': 30, 'col-5': 'Mercado Livre', 'col-6': '', 'col-7': 25, 'col-8': 0 } },
  { id: generateUUID(), values: { 'col-1': 'Gride Alumínio P25 (Mt)', 'col-2': 'Estrutura', 'col-3': 0, 'col-4': 40, 'col-5': 'One Light', 'col-6': '', 'col-7': 30, 'col-8': 0 } },
  { id: generateUUID(), values: { 'col-1': 'Show DJ', 'col-2': 'Som', 'col-3': 0, 'col-4': 1, 'col-5': 'Ventura', 'col-6': '', 'col-7': 800, 'col-8': 0 } },
  { id: generateUUID(), values: { 'col-1': 'Jatos CO2', 'col-2': 'Efeitos', 'col-3': 0, 'col-4': 4, 'col-5': 'Pirulito Recife', 'col-6': '', 'col-7': 400, 'col-8': 0 } },
  { id: generateUUID(), values: { 'col-1': 'Efeitos Pirotécnicos', 'col-2': 'Efeitos', 'col-3': 0, 'col-4': 10, 'col-5': 'Casa do Fogueteiro - Caruaru', 'col-6': '', 'col-7': 0, 'col-8': 0 } },
];

export const DEFAULT_BOARD: InventoryBoard = {
  id: 'board-1',
  title: 'Inventário de Itens',
  color: '#3b82f6',
  columns: [
    { id: 'col-1', title: 'ITEM', type: 'text', width: 250 },
    { id: 'col-2', title: 'CATEGORIA', type: 'status', width: 150 },
    { id: 'col-3', title: 'QTD. ATUAL', type: 'number', width: 140 },
    { id: 'col-4', title: 'ESTOQUE', type: 'number', width: 130 },
    { id: 'col-5', title: 'FORNECEDOR', type: 'text', width: 200 },
    { id: 'col-6', title: 'ÚLTIMA ENTRADA', type: 'date', width: 130 },
    { id: 'col-7', title: 'VALOR UNIT.', type: 'number', width: 120 },
    { id: 'col-8', title: 'VALOR CUSTO UNIT.', type: 'number', width: 140 },
  ],
  rows: DEFAULT_INVENTORY_ROWS,
};

export const ensureDefaultBoards = async (): Promise<void> => {
  if (boardsCache && boardsCache.length > 0) return;
  const q = query(collection(db, COLLECTION), orderBy('title'));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    await saveBoards([DEFAULT_BOARD]);
  } else {
    boardsCache = snapshot.docs.map(d => ({
      id: d.id,
      title: d.data().title || '',
      color: d.data().color || '',
      columns: d.data().columns || [],
      rows: d.data().rows || [],
    })) as InventoryBoard[];
  }
};

export const getAllInventoryItems = (): { name: string; qty: number; category: string; valorUnit: number }[] => {
  if (!boardsCache) return [];
  const items: { name: string; qty: number; category: string; valorUnit: number }[] = [];
  for (const board of boardsCache) {
    for (const row of board.rows) {
      const name = String(row.values['col-1'] || '');
      if (!name) continue;
      items.push({
        name, qty: Number(row.values['col-3']) || 0,
        category: String(row.values['col-2'] || board.title),
        valorUnit: Number(row.values['col-7']) || 0,
      });
    }
  }
  return items;
};
