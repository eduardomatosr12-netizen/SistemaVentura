import { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Trash2, X, Edit3, MessageCircle, Package, Building2, Search, Calendar, Filter as FilterIcon, CheckCircle2, AlertCircle, Database } from 'lucide-react';
import { collection, getDocs, deleteDoc, doc, writeBatch, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useCRM } from '../../contexts/CRMContext';
import { generateUUID } from '../../lib/uuid';
import { generateWhatsAppLink, WHATSAPP_MESSAGE_TEMPLATES } from '../../lib/whatsapp';
import { subscribeInventoryChanges, getBoards, updateBoard } from '../../lib/inventory';
import { subscribeRentals, addRental, updateRental, deleteRental } from '../../services/rentalService';
import type { RentalRecord } from '../../services/rentalService';

interface ColumnOption {
  id: string;
  label: string;
  color: string;
}

interface Column {
  id: string;
  title: string;
  type: 'text' | 'number' | 'status' | 'priority' | 'people' | 'date' | 'tags' | 'notes' | 'files' | 'formula';
  width: number;
  options?: ColumnOption[];
}

interface Row {
  id: string;
  values: Record<string, unknown>;
  lastModifiedBy?: string;
}

interface BoardType {
  id: string;
  title: string;
  color: string;
  columns: Column[];
  rows: Row[];
}

interface RentalItem {
  id: string;
  item: string;
  status: 'Em Trânsito' | 'Montado' | 'Devolvido';
  quantidade: number;
}

interface RentalRecord {
  id: string;
  client: string;
  dataSaida: string;
  dataDevolucao: string;
  items: RentalItem[];
}

const RENTAL_STATUSES = ['Em Trânsito', 'Montado', 'Devolvido'] as const;

const DEFAULT_STATUS_COLUMNS: ColumnOption[] = [
  { id: 'st-1', label: 'Pendente', color: '#6b7280' },
  { id: 'st-2', label: 'Em Andamento', color: '#f59e0b' },
  { id: 'st-3', label: 'Concluído', color: '#B5FF03' },
];

const CATEGORY_OPTIONS: ColumnOption[] = [
  { id: 'cat-dec', label: 'Decoração', color: '#6b7280' },
  { id: 'cat-mov', label: 'Móveis', color: '#6b7280' },
  { id: 'cat-ilu', label: 'Iluminação', color: '#6b7280' },
  { id: 'cat-pnl', label: 'Painel de LED', color: '#8b5cf6' },
  { id: 'cat-som', label: 'Som', color: '#3b82f6' },
  { id: 'cat-est', label: 'Estrutura', color: '#f59e0b' },
  { id: 'cat-efe', label: 'Efeitos', color: '#ef4444' },
  { id: 'cat-out', label: 'Outros', color: '#22c55e' },
];

const DEFAULT_PRIORITY_COLUMNS: ColumnOption[] = [
  { id: 'pr-1', label: 'Baixa', color: '#6b7280' },
  { id: 'pr-2', label: 'Média', color: '#f59e0b' },
  { id: 'pr-3', label: 'Alta', color: '#ef4444' },
];

const PRESET_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#3b82f6', '#6366f1', '#8b5cf6'];

const COLUMN_TYPES = [
  { type: 'text', label: 'Texto', icon: 'Aa' },
  { type: 'number', label: 'Quantidade', icon: '#' },
  { type: 'status', label: 'Disponibilidade', icon: '●●' },
  { type: 'priority', label: 'Moeda/Valor', icon: '$' },
  { type: 'people', label: 'Fornecedor', icon: '🏢' },
  { type: 'date', label: 'Data', icon: '📅' },
  { type: 'notes', label: 'Especificações', icon: '📋' },
  { type: 'tags', label: 'Categoria', icon: '🏷' },
] as const;

const DEFAULT_BOARD: BoardType = {
  id: 'board-1',
  title: 'Inventário de Itens',
  color: '#3b82f6',
  columns: [
    { id: 'col-1', title: 'ITEM', type: 'text', width: 250 },
    { id: 'col-2', title: 'CATEGORIA', type: 'status', width: 150, options: CATEGORY_OPTIONS },
    { id: 'col-3', title: 'QTD. ATUAL', type: 'number', width: 140 },
    { id: 'col-4', title: 'ESTOQUE', type: 'number', width: 130 },
    { id: 'col-5', title: 'FORNECEDOR', type: 'text', width: 200 },
    { id: 'col-6', title: 'ÚLTIMA ENTRADA', type: 'date', width: 130 },
    { id: 'col-7', title: 'VALOR UNIT.', type: 'number', width: 120 },
    { id: 'col-8', title: 'VALOR CUSTO UNIT.', type: 'number', width: 140 },
  ],
  rows: [
    { id: generateUUID(), values: { 'col-1': 'Painel de Led P3.9 LPS Curvo (50x100)', 'col-2': 'Painel de LED', 'col-3': 9, 'col-4': 18, 'col-5': 'LPG', 'col-6': '', 'col-7': 75, 'col-8': 0 }, lastModifiedBy: 'Administrador' },
    { id: generateUUID(), values: { 'col-1': 'Par Led 60 Led 3w Rgb Triled', 'col-2': 'Iluminação', 'col-3': 49, 'col-4': 50, 'col-5': 'Mercado Livre', 'col-6': '', 'col-7': 25, 'col-8': 0 }, lastModifiedBy: 'Administrador' },
    { id: generateUUID(), values: { 'col-1': 'Varal de Lampada Comum (66 Lâmpadas)', 'col-2': 'Iluminação', 'col-3': 3, 'col-4': 1, 'col-5': 'Mercado Livre', 'col-6': '', 'col-7': 200, 'col-8': 0 }, lastModifiedBy: 'Administrador' },
    { id: generateUUID(), values: { 'col-1': 'Varal de Lampada Japonesa (66 Lâmpadas)', 'col-2': 'Iluminação', 'col-3': 3, 'col-4': 1, 'col-5': 'Mercado Livre', 'col-6': '', 'col-7': 300, 'col-8': 0 }, lastModifiedBy: 'Administrador' },
    { id: generateUUID(), values: { 'col-1': 'Som - Medio', 'col-2': 'Som', 'col-3': 2, 'col-4': 2, 'col-5': 'Power System', 'col-6': '', 'col-7': 175, 'col-8': 0 }, lastModifiedBy: 'Administrador' },
    { id: generateUUID(), values: { 'col-1': 'Som - Grave', 'col-2': 'Som', 'col-3': 1, 'col-4': 2, 'col-5': 'Power System', 'col-6': '', 'col-7': 175, 'col-8': 0 }, lastModifiedBy: 'Administrador' },
    { id: generateUUID(), values: { 'col-1': 'Som Completo (Banda)', 'col-2': 'Som', 'col-3': 1, 'col-4': 1, 'col-5': 'Power System', 'col-6': '', 'col-7': 750, 'col-8': 0 }, lastModifiedBy: 'Administrador' },
    { id: generateUUID(), values: { 'col-1': 'Som Completo (DJ/Evento)', 'col-2': 'Som', 'col-3': 1, 'col-4': 1, 'col-5': 'Power System', 'col-6': '', 'col-7': 400, 'col-8': 0 }, lastModifiedBy: 'Administrador' },
    { id: generateUUID(), values: { 'col-1': 'Piso Palco Praticáveis (100x200x)', 'col-2': 'Estrutura', 'col-3': 9, 'col-4': 9, 'col-5': 'Pernambuco Estruturas', 'col-6': '', 'col-7': 80, 'col-8': 0 }, lastModifiedBy: 'Administrador' },
    { id: generateUUID(), values: { 'col-1': 'Cabine Fotografica Infinite', 'col-2': 'Outros', 'col-3': 1, 'col-4': 1, 'col-5': 'Maxi Grua', 'col-6': '', 'col-7': 500, 'col-8': 0 }, lastModifiedBy: 'Administrador' },
    { id: generateUUID(), values: { 'col-1': 'Seta de Led', 'col-2': 'Iluminação', 'col-3': 5, 'col-4': 1, 'col-5': 'Maxi Grua', 'col-6': '', 'col-7': 200, 'col-8': 0 }, lastModifiedBy: 'Administrador' },
    { id: generateUUID(), values: { 'col-1': 'Totem de Led P3.9 (100x200)', 'col-2': 'Painel de LED', 'col-3': 40, 'col-4': 4, 'col-5': 'LPG', 'col-6': '', 'col-7': 300, 'col-8': 0 }, lastModifiedBy: 'Administrador' },
    { id: generateUUID(), values: { 'col-1': 'Piso Paris Galáxia', 'col-2': 'Estrutura', 'col-3': 1, 'col-4': 16, 'col-5': 'Milleto', 'col-6': '', 'col-7': 50, 'col-8': 0 }, lastModifiedBy: 'Administrador' },
    { id: generateUUID(), values: { 'col-1': 'Moving Beem 14R LPG', 'col-2': 'Iluminação', 'col-3': 0, 'col-4': 4, 'col-5': 'LPG', 'col-6': '', 'col-7': 150, 'col-8': 0 }, lastModifiedBy: 'Administrador' },
    { id: generateUUID(), values: { 'col-1': 'Refletor Holofote Super Led 50w - BR', 'col-2': 'Iluminação', 'col-3': 0, 'col-4': 0, 'col-5': 'Ipojuca - Caruaru', 'col-6': '', 'col-7': 25, 'col-8': 0 }, lastModifiedBy: 'Administrador' },
    { id: generateUUID(), values: { 'col-1': 'Refletor Par 38', 'col-2': 'Iluminação', 'col-3': 0, 'col-4': 20, 'col-5': 'Mercado Livre', 'col-6': '', 'col-7': 25, 'col-8': 0 }, lastModifiedBy: 'Administrador' },
    { id: generateUUID(), values: { 'col-1': 'Refletor Holofote Led 30W - PT', 'col-2': 'Iluminação', 'col-3': 0, 'col-4': 24, 'col-5': 'Mercado Livre', 'col-6': '', 'col-7': 25, 'col-8': 0 }, lastModifiedBy: 'Administrador' },
    { id: generateUUID(), values: { 'col-1': 'Refletor Holofote Led 30W - BR', 'col-2': 'Iluminação', 'col-3': 0, 'col-4': 12, 'col-5': 'Mercado Livre', 'col-6': '', 'col-7': 25, 'col-8': 0 }, lastModifiedBy: 'Administrador' },
    { id: generateUUID(), values: { 'col-1': 'Refletor Holofote Led 200w - PT', 'col-2': 'Iluminação', 'col-3': 0, 'col-4': 30, 'col-5': 'Mercado Livre', 'col-6': '', 'col-7': 25, 'col-8': 0 }, lastModifiedBy: 'Administrador' },
    { id: generateUUID(), values: { 'col-1': 'Gride Alumínio P25 (Mt)', 'col-2': 'Estrutura', 'col-3': 0, 'col-4': 40, 'col-5': 'One Light', 'col-6': '', 'col-7': 30, 'col-8': 0 }, lastModifiedBy: 'Administrador' },
    { id: generateUUID(), values: { 'col-1': 'Show DJ', 'col-2': 'Som', 'col-3': 0, 'col-4': 1, 'col-5': 'Ventura', 'col-6': '', 'col-7': 800, 'col-8': 0 }, lastModifiedBy: 'Administrador' },
    { id: generateUUID(), values: { 'col-1': 'Jatos CO2', 'col-2': 'Efeitos', 'col-3': 0, 'col-4': 4, 'col-5': 'Pirulito Recife', 'col-6': '', 'col-7': 400, 'col-8': 0 }, lastModifiedBy: 'Administrador' },
    { id: generateUUID(), values: { 'col-1': 'Efeitos Pirotécnicos', 'col-2': 'Efeitos', 'col-3': 0, 'col-4': 10, 'col-5': 'Casa do Fogueteiro - Caruaru', 'col-6': '', 'col-7': 0, 'col-8': 0 }, lastModifiedBy: 'Administrador' },
  ],
};

const Board = ({
  board,
  allBoards,
  onUpdateBoard,
  onMoveRow,
  dateFilter,
  reservedQuantities,
}: {
  board: BoardType;
  allBoards: BoardType[];
  onUpdateBoard: (board: BoardType) => void;
  onMoveRow: (rowId: string, fromBoardId: string, toBoardId: string) => void;
  dateFilter?: string;
  reservedQuantities?: Map<string, number>;
}) => {
  const { role, employeeName } = useAuth();

  const [activeCategoryRow, setActiveCategoryRow] = useState<string | null>(null);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatLabel, setEditingCatLabel] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');

  const catCol = board.columns.find(c => c.id === 'col-2');

  const updateCategoryOptions = (newOptions: ColumnOption[]) => {
    if (!catCol) return;
    onUpdateBoard({
      ...board,
      columns: board.columns.map(c => c.id === 'col-2' ? { ...c, options: newOptions } : c),
    });
  };

  const handleAddCategory = () => {
    const label = newCategoryLabel.trim();
    if (!label || !catCol) return;
    const colors = ['#3b82f6', '#f59e0b', '#84cc16', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#22c55e'];
    const usedColors = (catCol.options || []).map(o => o.color);
    const freeColor = colors.find(c => !usedColors.includes(c)) || '#6b7280';
    const newOpt: ColumnOption = { id: generateUUID(), label, color: freeColor };
    updateCategoryOptions([...(catCol.options || []), newOpt]);
    setNewCategoryLabel('');
    setAddingCategory(false);
  };

  const handleEditCategory = (opt: ColumnOption) => {
    const label = editingCatLabel.trim();
    if (!label || !catCol) return;
    updateCategoryOptions((catCol.options || []).map(o => o.id === opt.id ? { ...o, label } : o));
    setEditingCatId(null);
    setEditingCatLabel('');
  };

  const handleDeleteCategory = (opt: ColumnOption) => {
    if (!catCol || !confirm(`Excluir categoria "${opt.label}"?`)) return;
    updateCategoryOptions((catCol.options || []).filter(o => o.id !== opt.id));
    board.rows.forEach(r => {
      if (r.values['col-2'] === opt.label) {
        handleCellChange(r.id, 'col-2', '');
      }
    });
  };

  const handleAddRow = () => {
    const newRow: Row = {
      id: generateUUID(),
      values: board.columns.reduce((acc, col) => {
        acc[col.id] = col.type === 'number' || col.type === 'priority' ? 0 : '';
        return acc;
      }, {} as Record<string, unknown>),
      lastModifiedBy: employeeName || (role === 'admin' ? 'Administrador' : 'Funcionário'),
    };
    onUpdateBoard({ ...board, rows: [...board.rows, newRow] });
  };

  const handleDeleteRow = (rowId: string) => {
    if (!confirm('Excluir esta linha?')) return;
    onUpdateBoard({ ...board, rows: board.rows.filter(r => r.id !== rowId) });
  };

  const handleCellChange = (rowId: string, colId: string, value: unknown) => {
    const updated = board.rows.map(r => 
      r.id === rowId ? { ...r, values: { ...r.values, [colId]: value }, lastModifiedBy: employeeName || (role === 'admin' ? 'Administrador' : 'Funcionário') } : r
    );
    onUpdateBoard({ ...board, rows: updated });
  };

  const getOptionColor = (colId: string, value: string) => {
    const col = board.columns.find(c => c.id === colId);
    if (!col?.options) return '#6b7280';
    return col.options.find(o => o.label === value)?.color || '#6b7280';
  };

  const renderCell = (row: Row, col: Column) => {
    const value = row.values[col.id] ?? '';
    const { employeeName } = useAuth();

    // Check if value looks like a phone number for WhatsApp
    const isPhone = typeof value === 'string' && /[\d\s\-()]+$/.test(value) && value.replace(/\D/g, '').length >= 10;

    switch (col.type) {
      case 'text':
      case 'people': {
        const isPhone = typeof value === 'string' && /[\d\s\-()]+$/.test(value) && value.replace(/\D/g, '').length >= 10;
        return (
          <div className="flex items-center gap-1 w-full">
            <input
              type="text"
              value={String(value)}
              onChange={(e) => handleCellChange(row.id, col.id, e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className="flex-1 min-h-[36px] bg-transparent border-none outline-none text-sm px-3 py-2 text-white hover:bg-[#111] focus:bg-[#222] focus:border-b-2 focus:border-[#B5FF03] transition-colors"
              autoComplete="off"
              placeholder="Editar..."
            />
            {isPhone && (
              <button
                type="button"
                onClick={() => {
                  const link = generateWhatsAppLink(String(value), WHATSAPP_MESSAGE_TEMPLATES[0].template(row.values['col-1'] as string || 'Lead', employeeName || 'Usuário'));
                  window.open(link, '_blank');
                }}
                className="text-[#25D366] hover:text-green-600 transition-colors p-1"
                title="Enviar mensagem via WhatsApp"
              >
                <MessageCircle size={14} />
              </button>
            )}
          </div>
        );
      }
      case 'number':
        if (col.id === 'col-7') {
          const numVal = Number(value) || 0;
          return (
            <div className="flex items-center gap-1 px-3 w-full">
              <span className="text-[#B5FF03] text-sm font-bold shrink-0">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numVal)}
              </span>
            </div>
          );
        }
        if (col.id === 'col-8') {
          return (
            <div className="flex items-center gap-1 px-3 w-full">
              <span className="text-[#B5FF03] text-sm font-bold shrink-0">R$</span>
              <input
                type="number"
                step="0.01"
                value={String(value ?? 0)}
                onChange={(e) => handleCellChange(row.id, col.id, e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                className="flex-1 min-h-[36px] bg-transparent border-none outline-none text-sm text-white font-bold hover:bg-[#111] focus:bg-[#222] focus:border-b-2 focus:border-[#B5FF03] transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                autoComplete="off"
                placeholder="0,00"
              />
            </div>
          );
        }
        return col.id === 'col-3' ? (
          dateFilter ? (
            <div className="flex items-center gap-1 px-2">
              <span className="w-full min-h-[36px] flex items-center justify-center text-sm text-white font-bold bg-transparent">
                {Math.max(0, (Number(value) || 0) - (reservedQuantities?.get(String(row.values['col-1'] || '')) || 0))}
              </span>
            </div>
          ) : (
          <div className="flex items-center gap-1 px-2">
            <button
              type="button"
              onClick={() => handleCellChange(row.id, col.id, Math.max(0, (Number(value) || 0) - 1))}
              className="w-10 h-10 md:w-7 md:h-7 flex items-center justify-center rounded-md bg-[#222] text-white hover:bg-[#333] hover:text-[#B5FF03] transition-all font-bold text-lg"
            >
              −
            </button>
            <input
              type="number"
              value={String(value)}
              onChange={(e) => handleCellChange(row.id, col.id, e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className="w-14 sm:w-14 min-h-[44px] md:min-h-[36px] bg-transparent border-none outline-none text-sm text-center text-white font-bold focus:border-b-2 focus:border-[#B5FF03] transition-colors"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => handleCellChange(row.id, col.id, (Number(value) || 0) + 1)}
              className="w-10 h-10 md:w-7 md:h-7 flex items-center justify-center rounded-md bg-[#222] text-white hover:bg-[#333] hover:text-[#B5FF03] transition-all font-bold text-lg"
            >
              +
            </button>
          </div>
          )
        ) : (
          <input
            type="number"
            value={String(value)}
            onChange={(e) => handleCellChange(row.id, col.id, e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            className="w-full min-h-[36px] bg-transparent border-none outline-none text-sm px-3 py-2 text-white hover:bg-[#111] focus:bg-[#222] focus:border-b-2 focus:border-[#B5FF03] transition-colors"
            autoComplete="off"
          />
        );
      case 'priority':
        return (
          <div className="flex items-center gap-1 px-3 w-full">
            <span className="text-[#B5FF03] text-sm font-bold shrink-0">R$</span>
            <input
              type="number"
              step="0.01"
              value={String(value || '')}
              onChange={(e) => handleCellChange(row.id, col.id, e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className="flex-1 min-h-[36px] bg-transparent border-none outline-none text-sm text-white font-bold focus:border-b-2 focus:border-[#B5FF03] transition-colors"
              autoComplete="off"
              placeholder="0,00"
            />
          </div>
        );
      case 'status': {
        const options = col.options || [];
        const isCategory = col.id === 'col-2';
        if (isCategory) {
          const isOpen = activeCategoryRow === row.id;
          return (
            <div className="relative px-3 py-2">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setActiveCategoryRow(isOpen ? null : row.id); setAddingCategory(false); setEditingCatId(null); }}
                className="flex items-center gap-2 w-full text-left"
              >
                {value && (
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getOptionColor(col.id, String(value)) }} />
                )}
                <span className="text-sm font-bold truncate" style={{ color: value ? '#B5FF03' : '#888' }}>
                  {String(value) || '—'}
                </span>
              </button>

              {isOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setActiveCategoryRow(null)} />
                  <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-xl overflow-hidden min-w-[200px]">
                    <div className="max-h-[240px] overflow-y-auto">
                      {options.map(opt => {
                        const isEditing = editingCatId === opt.id;
                        return (
                          <div
                            key={opt.id}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-[#222] transition-colors group"
                          >
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />
                            {isEditing ? (
                              <input
                                autoFocus
                                type="text"
                                value={editingCatLabel}
                                onChange={(e) => setEditingCatLabel(e.target.value)}
                                onKeyDown={(e) => {
                                  e.stopPropagation();
                                  if (e.key === 'Enter') handleEditCategory(opt);
                                  if (e.key === 'Escape') { setEditingCatId(null); setEditingCatLabel(''); }
                                }}
                                onBlur={() => { setEditingCatId(null); setEditingCatLabel(''); }}
                                className="flex-1 bg-[#111] border border-[#B5FF03] rounded px-2 py-0.5 text-xs text-white outline-none"
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleCellChange(row.id, col.id, opt.label); setActiveCategoryRow(null); }}
                                className="flex-1 text-left text-xs text-white font-medium truncate"
                              >
                                {opt.label}
                              </button>
                            )}
                            <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setEditingCatId(opt.id); setEditingCatLabel(opt.label); setAddingCategory(false); }}
                                className="p-1 text-neutral-400 hover:text-[#B5FF03] transition-colors"
                                title="Editar"
                              >
                                ✎
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleDeleteCategory(opt); }}
                                className="p-1 text-neutral-400 hover:text-red-400 transition-colors"
                                title="Excluir"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="border-t border-[#333]">
                      {addingCategory ? (
                        <div className="flex items-center gap-2 px-3 py-2">
                          <span className="w-2 h-2 rounded-full shrink-0 bg-[#555]" />
                          <input
                            autoFocus
                            type="text"
                            value={newCategoryLabel}
                            onChange={(e) => setNewCategoryLabel(e.target.value)}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === 'Enter') handleAddCategory();
                              if (e.key === 'Escape') { setAddingCategory(false); setNewCategoryLabel(''); }
                            }}
                            placeholder="Nova categoria..."
                            className="flex-1 bg-[#111] border border-[#B5FF03] rounded px-2 py-0.5 text-xs text-white outline-none placeholder-neutral-500"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleAddCategory(); }}
                            className="text-[#B5FF03] text-xs font-bold hover:text-white transition-colors"
                          >
                            OK
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setAddingCategory(true); setEditingCatId(null); setNewCategoryLabel(''); }}
                          className="flex items-center gap-2 px-3 py-2 w-full text-left text-xs text-[#B5FF03] font-bold hover:bg-[#222] transition-colors"
                        >
                          <span className="w-4 h-4 flex items-center justify-center rounded-full border border-[#B5FF03] text-[10px]">+</span>
                          Nova Categoria
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        }
        return (
          <select
            value={String(value)}
            onChange={(e) => handleCellChange(row.id, col.id, e.target.value)}
            className="w-full min-h-[36px] px-2 py-1 text-sm border-none outline-none cursor-pointer text-white font-medium"
            style={{ backgroundColor: value ? getOptionColor(col.id, String(value)) : '#6b7280' }}
          >
            <option value="">—</option>
            {options.map(opt => (
              <option key={opt.id} value={opt.label} style={{ backgroundColor: opt.color }}>
                {opt.label}
              </option>
            ))}
          </select>
        );
      }
      case 'tags': {
        const options = col.options || [];
        const currentTags: string[] = Array.isArray(value) ? value : (value ? String(value).split(',').map((t: string) => t.trim()) : []);
        
        const removeTag = (tagToRemove: string) => {
          const newTags = currentTags.filter(t => t !== tagToRemove);
          handleCellChange(row.id, col.id, newTags);
        };
        
        const addTag = (tagToAdd: string) => {
          if (!tagToAdd || currentTags.includes(tagToAdd)) return;
          const newTags = [...currentTags, tagToAdd];
          handleCellChange(row.id, col.id, newTags);
        };
        
        const removeAllTags = () => {
          handleCellChange(row.id, col.id, []);
        };

        const createAndAddTag = () => {
          const input = document.getElementById(`new-tag-${row.id}-${col.id}`) as HTMLInputElement;
          const colorInput = document.getElementById(`new-tag-color-${row.id}-${col.id}`) as HTMLInputElement;
          const tagName = input?.value?.trim();
          const tagColor = colorInput?.value || '#6b7280';
          
          if (!tagName) return;
          
          const newOption = { id: generateUUID(), label: tagName, color: tagColor };
          const updatedOptions = [...options, newOption];
          const updatedColumns = board.columns.map(c =>
            c.id === col.id ? { ...c, options: updatedOptions } : c
          );
          const newTags = [...currentTags, tagName];
          const updatedRows = board.rows.map(r =>
            r.id === row.id ? { ...r, values: { ...r.values, [col.id]: newTags } } : r
          );
          onUpdateBoard({ ...board, columns: updatedColumns, rows: updatedRows });
          
          if (input) input.value = '';
          if (colorInput) colorInput.value = '#6b7280';
        };

        return (
          <div className="flex flex-col gap-1 px-2 py-1" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-wrap gap-1">
              {currentTags.filter(Boolean).map((tag: string, idx: number) => {
                const opt = options.find(o => o.label === tag);
                const color = opt?.color || '#6b7280';
                return (
                  <span
                    key={`${tag}-${idx}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-white rounded-full"
                    style={{ backgroundColor: color }}
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeTag(tag);
                      }}
                      className="hover:text-red-200 transition-colors cursor-pointer"
                      title="Remover tag"
                    >
                      <X size={10} />
                    </button>
                  </span>
                );
              })}
            </div>
            
            <div className="flex items-center gap-1">
              <select
                value=""
                onChange={(e) => {
                  e.stopPropagation();
                  if (e.target.value === '__remove_all__') {
                    removeAllTags();
                  } else if (e.target.value === '__create__') {
                    const container = document.getElementById(`create-tag-container-${row.id}-${col.id}`);
                    if (container) container.style.display = 'flex';
                  } else if (e.target.value) {
                    addTag(e.target.value);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="min-h-[24px] px-1 text-xs border-none outline-none cursor-pointer bg-[#222] rounded text-neutral-300 hover:bg-[#333] transition-colors"
              >
                <option value="">+ Tag</option>
                {options
                  .filter(opt => !currentTags.includes(opt.label))
                  .map(opt => (
                    <option key={opt.id} value={opt.label}>{opt.label}</option>
                  ))}
                {currentTags.length > 0 && (
                  <option value="__remove_all__">— Remover Todas —</option>
                )}
                <option value="__create__">+ Criar Nova Tag</option>
              </select>
            </div>

            <div 
              id={`create-tag-container-${row.id}-${col.id}`}
              className="hidden flex-col gap-1 p-2 border border-[#333] rounded bg-[#111] shadow-sm"
            >
              <input
                id={`new-tag-${row.id}-${col.id}`}
                type="text"
                placeholder="Nome da tag..."
                className="w-full px-2 py-1 text-xs border border-[#333] rounded outline-none focus:border-[#B5FF03] text-white bg-[#111]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createAndAddTag();
                }}
              />
              <div className="flex gap-1 flex-wrap">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      const colorInput = document.getElementById(`new-tag-color-${row.id}-${col.id}`) as HTMLInputElement;
                      if (colorInput) colorInput.value = color;
                    }}
                    className="w-5 h-5 rounded-full transition-all hover:scale-110"
                    style={{ backgroundColor: color }}
                  />
                ))}
                <input
                  id={`new-tag-color-${row.id}-${col.id}`}
                  type="hidden"
                  defaultValue="#6b7280"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const container = document.getElementById(`create-tag-container-${row.id}-${col.id}`);
                    if (container) container.style.display = 'none';
                  }}
                  className="flex-1 px-2 py-1 text-xs border border-[#333] rounded hover:bg-[#222] transition-colors text-white"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={createAndAddTag}
                   className="flex-1 px-2 py-1 text-xs bg-[#B5FF03] text-black rounded hover:bg-[#a1e600] transition-colors"
                >
                  Criar
                </button>
              </div>
            </div>
          </div>
        );
      }
      case 'date':
        return (
          <input
            type="date"
            value={String(value)}
            onChange={(e) => handleCellChange(row.id, col.id, e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
                  className="w-full min-h-[36px] bg-transparent border-none outline-none text-sm px-3 py-2 text-white hover:bg-[#111] focus:bg-[#222] transition-colors"
          />
        );
      case 'notes':
        return (
          <div className="relative group cursor-pointer" onClick={(e) => e.stopPropagation()}>
            <div className="w-full min-h-[36px] px-3 py-2 text-sm text-neutral-300 truncate">
              {String(value) || 'Clique para editar...'}
            </div>
            <button
              onClick={() => {
                const event = new CustomEvent('openNoteEditor', {
                  detail: { rowId: row.id, colId: col.id, value: String(value), boardId: board.id }
                });
                window.dispatchEvent(event);
              }}
              className="absolute inset-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 bg-black/40 flex items-center justify-center transition-opacity"
            >
              <Edit3 size={14} className="text-white" />
            </button>
          </div>
        );
      default:
        return <div className="text-sm px-3 py-2 text-neutral-400">{String(value) || '—'}</div>;
    }
  };

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-3 h-8 rounded-full" style={{ backgroundColor: board.color }} />
        <h2 className="text-xl font-black text-white">{board.title}</h2>
      </div>
        <div className="border rounded-2xl border-[#333] bg-[#111] overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-[#333] bg-[#0a0a0a]">
                <th className="w-10 p-3 border-r border-[#333] text-white font-bold">#</th>
                {board.columns.map(col => (
                  <th 
                    key={col.id} 
                     className="p-3 border-l border-[#333] text-left text-[10px] font-black uppercase tracking-widest text-white whitespace-nowrap group hover:bg-[#222] transition-colors" 
                    style={{ minWidth: col.width }}
                  >
                    <span>{col.title}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {board.rows.map(row => (
                <tr key={row.id} className="border-b border-[#1a1a1a] hover:bg-[#111]">
                  <td className="p-3 border-r border-[#333] text-center">
                    <button onClick={() => handleDeleteRow(row.id)} className="text-neutral-400 hover:text-red-400"><Trash2 size={14} /></button>
                  </td>
                  {board.columns.map(col => (
                    <td key={col.id} className="p-0 border-l border-[#333]">
                      {renderCell(row, col)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-[#333] bg-[#111]">
          <button onClick={handleAddRow} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-400 hover:text-white hover:bg-[#222] rounded-lg transition-colors">
            <Plus size={16} /> Nova Linha
          </button>
        </div>
      </div>
    </div>
  );
};

const Tarefas = () => {
  const { role } = useAuth();
  const { Orçamentos, events } = useCRM();

  const [boards, setBoards] = useState<BoardType[]>([DEFAULT_BOARD]);

  const [activeTab, setActiveTab] = useState<'inventario' | 'aluguel'>('inventario');
  const [estoqueZeroFilter, setEstoqueZeroFilter] = useState(false);
  const [dateFilterEstoque, setDateFilterEstoque] = useState('');

  const [rentalRecords, setRentalRecords] = useState<RentalRecord[]>([]);

  const [showRentalModal, setShowRentalModal] = useState(false);
  const [editingRental, setEditingRental] = useState<RentalRecord | null>(null);
  const [isNewRental, setIsNewRental] = useState(false);

  const emptyRentalForm = (): RentalRecord => ({
    id: generateUUID(),
    client: '',
    dataSaida: '',
    dataDevolucao: '',
    items: [{ id: generateUUID(), item: '', status: 'Em Trânsito', quantidade: 1 }],
  });

  const [rentalForm, setRentalForm] = useState<RentalRecord>(emptyRentalForm());

  const [clientSearch, setClientSearch] = useState('');

  const inventoryItems = boards.flatMap(b =>
    b.rows.map(r => String(r.values['col-1'] || '')).filter(Boolean)
  );

  const clientNames = (Orçamentos || []).map(o => o.name).filter(Boolean);

  const reservedByDate = useMemo(() => {
    if (!dateFilterEstoque) return new Map<string, number>();

    const eventClients = new Set<string>();
    (events || []).forEach(ev => {
      if (ev.date === dateFilterEstoque && ev.client) {
        eventClients.add(ev.client.toLowerCase().trim());
      }
    });

    const map = new Map<string, number>();
    (Orçamentos || []).forEach(lead => {
      if (lead.firstContact !== dateFilterEstoque) return;
      if (!eventClients.has(lead.name.toLowerCase().trim())) return;
      (lead.items || []).forEach(item => {
        map.set(item.item, (map.get(item.item) || 0) + item.qtdAtual);
      });
    });

    return map;
  }, [dateFilterEstoque, events, Orçamentos]);

  const pendingBoardWrites = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [saveFeedback, setSaveFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [editingNote, setEditingNote] = useState<{ rowId: string; colId: string; boardId: string } | null>(null);
  const [noteContent, setNoteContent] = useState('');

  useEffect(() => {
    const current = getBoards();
    if (current && current.length > 0) {
      setBoards(current as BoardType[]);
    }
    const unsubBoards = subscribeInventoryChanges(() => {
      const current = getBoards();
      if (current && current.length > 0) {
        setBoards(current as BoardType[]);
      }
    });
    const unsubRentals = subscribeRentals(records => {
      setRentalRecords(records);
    });
    return () => {
      unsubBoards();
      unsubRentals();
      Object.values(pendingBoardWrites.current).forEach(clearTimeout);
    };
  }, []);



  useEffect(() => {
    const handleOpenNoteEditor = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setEditingNote({ rowId: detail.rowId, colId: detail.colId, boardId: detail.boardId });
      setNoteContent(detail.value || '');
    };

    window.addEventListener('openNoteEditor', handleOpenNoteEditor);
    return () => window.removeEventListener('openNoteEditor', handleOpenNoteEditor);
  }, []);

  const handleUpdateBoard = (updatedBoard: BoardType) => {
    setBoards(boards.map(b => b.id === updatedBoard.id ? updatedBoard : b));

    if (pendingBoardWrites.current[updatedBoard.id]) {
      clearTimeout(pendingBoardWrites.current[updatedBoard.id]);
    }
    pendingBoardWrites.current[updatedBoard.id] = setTimeout(() => {
      updateBoard(updatedBoard.id, {
        title: updatedBoard.title,
        color: updatedBoard.color,
        columns: updatedBoard.columns as any,
        rows: updatedBoard.rows as any,
      }).then(() => {
        setSaveFeedback({ type: 'success', message: 'Salvo no Firestore' });
        setTimeout(() => setSaveFeedback(null), 3000);
      }).catch(err => {
        console.error('[Tarefas] Erro ao salvar board:', err);
        setSaveFeedback({ type: 'error', message: 'Erro ao salvar no Firestore' });
        setTimeout(() => setSaveFeedback(null), 5000);
      });
    }, 500);
  };



  const [seedFeedback, setSeedFeedback] = useState<string | null>(null);

  const handleSeedEstoque = async () => {
    setSeedFeedback('Limpando registros antigos...');
    const colRef = collection(db, 'estoque');
    try {
      const snapshot = await getDocs(colRef);
      const batchDelete = writeBatch(db);
      let deleted = 0;
      snapshot.forEach(d => {
        batchDelete.delete(doc(db, 'estoque', d.id));
        deleted++;
      });
      if (deleted > 0) await batchDelete.commit();
      setSeedFeedback(`Deletados ${deleted} registros antigos. Inserindo novos...`);
    } catch (err) {
      console.warn('Erro ao limpar estoque antigo:', err);
    }
    const itensSeed = [
      { item: 'Painel de Led P3.9 LPS Curvo (50x100)', categoria: 'Painel de LED', qtdAtual: 9, estoqueMinimo: 18, fornecedor: 'LPG', valorUnit: 75 },
      { item: 'Par Led 60 Led 3w Rgb Triled', categoria: 'Iluminação', qtdAtual: 49, estoqueMinimo: 50, fornecedor: 'Mercado Livre', valorUnit: 25 },
      { item: 'Varal de Lampada Comum (66 Lâmpada)', categoria: 'Iluminação', qtdAtual: 3, estoqueMinimo: 1, fornecedor: 'Mercado Livre', valorUnit: 200 },
      { item: 'Varal de Lampada Japonesa (66 Lâmpadas)', categoria: 'Iluminação', qtdAtual: 3, estoqueMinimo: 1, fornecedor: 'Mercado Livre', valorUnit: 300 },
      { item: 'Som - Medio', categoria: 'Som', qtdAtual: 2, estoqueMinimo: 2, fornecedor: 'Power System', valorUnit: 175 },
      { item: 'Som - Grave', categoria: 'Som', qtdAtual: 1, estoqueMinimo: 2, fornecedor: 'Power System', valorUnit: 175 },
      { item: 'Som Completo (Banda)', categoria: 'Som', qtdAtual: 1, estoqueMinimo: 1, fornecedor: 'Power System', valorUnit: 750 },
      { item: 'Som Completo (DJ/Evento)', categoria: 'Som', qtdAtual: 1, estoqueMinimo: 1, fornecedor: 'Power System', valorUnit: 400 },
      { item: 'Piso Palco Praticáveis (100x200x)', categoria: 'Estrutura', qtdAtual: 9, estoqueMinimo: 9, fornecedor: 'Pernambuco Estruturas', valorUnit: 80 },
      { item: 'Cabine Fotografica Infinite', categoria: 'Outros', qtdAtual: 1, estoqueMinimo: 1, fornecedor: 'Maxi Grua', valorUnit: 500 },
      { item: 'Seta de Led', categoria: 'Iluminação', qtdAtual: 5, estoqueMinimo: 1, fornecedor: 'Maxi Grua', valorUnit: 200 },
      { item: 'Totem de Led P3.9 (100x200)', categoria: 'Painel de LED', qtdAtual: 40, estoqueMinimo: 4, fornecedor: 'LPG', valorUnit: 300 },
      { item: 'Piso Paris Galáxia', categoria: 'Estrutura', qtdAtual: 1, estoqueMinimo: 16, fornecedor: 'Milleto', valorUnit: 50 },
      { item: 'Moving Beem 14R LPG', categoria: 'Iluminação', qtdAtual: 0, estoqueMinimo: 4, fornecedor: 'LPG', valorUnit: 150 },
      { item: 'Refletor Holofote Super Led 50w - BR', categoria: 'Iluminação', qtdAtual: 0, estoqueMinimo: 0, fornecedor: 'Ipojuca - Caruaru', valorUnit: 25 },
      { item: 'Refletor Par 38', categoria: 'Iluminação', qtdAtual: 0, estoqueMinimo: 20, fornecedor: 'Mercado Livre', valorUnit: 25 },
      { item: 'Refletor Holofote Led 30W - PT', categoria: 'Iluminação', qtdAtual: 0, estoqueMinimo: 24, fornecedor: 'Mercado Livre', valorUnit: 25 },
      { item: 'Refletor Holofote Led 30W - BR', categoria: 'Iluminação', qtdAtual: 0, estoqueMinimo: 12, fornecedor: 'Mercado Livre', valorUnit: 25 },
      { item: 'Refletor Holofote Led 200w - PT', categoria: 'Iluminação', qtdAtual: 0, estoqueMinimo: 30, fornecedor: 'Mercado Livre', valorUnit: 25 },
      { item: 'Gride Alumínio P25 (Mt)', categoria: 'Estrutura', qtdAtual: 0, estoqueMinimo: 40, fornecedor: 'One Light', valorUnit: 30 },
      { item: 'Show DJ', categoria: 'Som', qtdAtual: 0, estoqueMinimo: 1, fornecedor: 'Ventura', valorUnit: 800 },
      { item: 'Jatos CO2', categoria: 'Efeitos', qtdAtual: 0, estoqueMinimo: 4, fornecedor: 'Pirulito Recife', valorUnit: 400 },
      { item: 'Efeitos Pirotécnicos', categoria: 'Efeitos', qtdAtual: 0, estoqueMinimo: 10, fornecedor: 'Casa do Fogueteiro - Caruaru', valorUnit: 0 },
    ];
    try {
      const batch = writeBatch(db);
      for (const item of itensSeed) {
        const ref = doc(colRef);
        batch.set(ref, { ...item, createdAt: Timestamp.now() });
      }
      await batch.commit();
      setSeedFeedback(`${itensSeed.length} itens inseridos com sucesso!`);
      setTimeout(() => setSeedFeedback(null), 5000);
    } catch (err) {
      setSeedFeedback('Erro na inserção: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleCreateNewTask = (boardId: string) => {
    const board = boards.find(b => b.id === boardId);
    if (!board) return;
    
    const newRow: Row = {
      id: generateUUID(),
      values: board.columns.reduce((acc, col) => {
        acc[col.id] = col.type === 'number' || col.type === 'priority' ? 0 : '';
        return acc;
      }, {} as Record<string, unknown>),
    };
    
    handleUpdateBoard({ ...board, rows: [...board.rows, newRow] });
    setShowCreateTaskModal(false);
  };

  const handleSaveNote = () => {
    if (!editingNote) return;

    const board = boards.find(b => b.id === editingNote.boardId);
    if (!board) return;

    const updated = board.rows.map(r => 
      r.id === editingNote.rowId ? { ...r, values: { ...r.values, [editingNote.colId]: noteContent } } : r
    );
    handleUpdateBoard({ ...board, rows: updated });
    setEditingNote(null);
    setNoteContent('');
  };

  const handleOpenRentalModal = (record?: RentalRecord) => {
    if (record) {
      setEditingRental(record);
      setRentalForm(record);
      setIsNewRental(false);
    } else {
      setEditingRental(null);
      setRentalForm(emptyRentalForm());
      setIsNewRental(true);
    }
    setClientSearch('');
    setShowRentalModal(true);
  };

  const handleSaveRental = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rentalForm.client.trim()) return;
    const validItems = rentalForm.items.filter(i => i.item.trim());
    if (validItems.length === 0) return;

    const payload = { ...rentalForm, items: validItems };

    try {
      if (isNewRental || !editingRental) {
        await addRental({ client: payload.client, dataSaida: payload.dataSaida, dataDevolucao: payload.dataDevolucao, items: payload.items });
      } else {
        await updateRental(editingRental.id!, { client: payload.client, dataSaida: payload.dataSaida, dataDevolucao: payload.dataDevolucao, items: payload.items });
      }
    } catch (err) {
      console.error('[Tarefas] Erro ao salvar aluguel:', err);
    }
    setShowRentalModal(false);
  };

  const handleDeleteRental = async (id: string) => {
    if (confirm('Excluir este registro de aluguel?')) {
      try {
        await deleteRental(id);
      } catch (err) {
        console.error('[Tarefas] Erro ao excluir aluguel:', err);
      }
    }
  };

  const statusRentalColor: Record<string, string> = {
    'Em Trânsito': 'text-[#f59e0b] border-[#f59e0b]/50',
    'Montado': 'text-[#B5FF03] border-[#B5FF03]',
    'Devolvido': 'text-[#aaaaaa] border-[#222222]',
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-8 min-h-screen bg-black">
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight mb-1">Controle de Estoque</h1>
        <p className="text-neutral-400 text-sm font-medium mb-6">Gerencie seus itens, categorias e fornecedores.</p>
      </div>

      <div className="flex gap-6 border-b border-[#222222] overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setActiveTab('inventario')}
          className={`py-3 px-1 border-b-2 font-bold text-xs uppercase tracking-widest transition-colors whitespace-nowrap ${
            activeTab === 'inventario'
              ? 'border-[#B5FF03] text-[#B5FF03]'
              : 'border-transparent text-[#aaaaaa] hover:text-white'
          }`}
        >
          <Package size={16} className="inline mr-2" />
          Inventário
        </button>
        <button
          onClick={() => setActiveTab('aluguel')}
          className={`py-3 px-1 border-b-2 font-bold text-xs uppercase tracking-widest transition-colors whitespace-nowrap ${
            activeTab === 'aluguel'
              ? 'border-[#B5FF03] text-[#B5FF03]'
              : 'border-transparent text-[#aaaaaa] hover:text-white'
          }`}
        >
          <Building2 size={16} className="inline mr-2" />
          Controle de Aluguel
        </button>
      </div>

      {activeTab === 'inventario' && (
        <>
          {/* Inventory Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-[#0a0a0a] border border-[#1a1a1a] rounded-md">
            <div className="flex items-center gap-2">
              <FilterIcon size={14} className="text-[#B5FF03]" />
              <span className="text-[9px] font-black text-white uppercase tracking-widest">Filtros:</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-neutral-500" />
              <input
                type="date"
                value={dateFilterEstoque}
                onChange={(e) => setDateFilterEstoque(e.target.value)}
                className="bg-[#1a1a1a] border border-[#333] rounded-md px-2 py-1.5 text-[10px] font-bold text-white focus:outline-none focus:border-[#B5FF03] [color-scheme:dark]"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={estoqueZeroFilter}
                onChange={(e) => setEstoqueZeroFilter(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#B5FF03]"
              />
              <span className="text-[10px] font-bold text-neutral-400 hover:text-[#B5FF03] transition-colors">
                Estoque Zero
              </span>
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSeedEstoque}
              className="flex items-center gap-2 px-6 py-3 bg-[#1a1a2e] text-[#B5FF03] font-black rounded-lg hover:bg-[#2a2a4e] transition-colors border border-[#B5FF03]/30"
            >
              <Database size={18} /> Seed Estoque
            </button>
            <button
              onClick={() => setShowCreateTaskModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-[#B5FF03] text-black font-black rounded-lg hover:bg-[#a1e600] transition-colors"
            >
              <Plus size={20} /> Novo Item
            </button>
          </div>

          {saveFeedback && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold ${
              saveFeedback.type === 'success' ? 'bg-[#1a3a1a] text-[#B5FF03] border border-[#2a5a2a]' : 'bg-[#3a1a1a] text-red-400 border border-[#5a2a2a]'
            }`}>
              {saveFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {saveFeedback.message}
            </div>
          )}
          {seedFeedback && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-[#1a1a2e] text-[#B5FF03] border border-[#B5FF03]/20">
              <Database size={16} />
              {seedFeedback}
            </div>
          )}

          {/* Inventário */}
          {(() => {
            const board = boards[0];
            if (!board) return null;
            const filteredRows = board.rows.filter(row => {
              if (estoqueZeroFilter) {
                const qty = Number(row.values['col-3']) || 0;
                if (qty > 0) return false;
              }
              return true;
            });
            return (
              <Board
                board={{ ...board, rows: filteredRows }}
                allBoards={boards}
                onUpdateBoard={handleUpdateBoard}
                onMoveRow={() => {}}
                dateFilter={dateFilterEstoque}
                reservedQuantities={reservedByDate}
              />
            );
          })()}
        </>
      )}

      {activeTab === 'aluguel' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => handleOpenRentalModal()}
              className="flex items-center gap-2 px-6 py-3 bg-[#B5FF03] text-black font-black rounded-lg hover:bg-[#a1e600] transition-colors"
            >
              <Plus size={20} /> Novo Aluguel
            </button>
          </div>

          <div className="hidden md:block bg-[#111111] border border-[#222222] rounded-lg overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#222222]">
                  <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Cliente</th>
                  <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Itens</th>
                  <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Data de Saída</th>
                  <th className="text-left p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Data de Devolução</th>
                  <th className="text-right p-4 text-xs font-black uppercase tracking-widest text-[#B5FF03]">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rentalRecords.map(record => (
                  <tr key={record.id} className="border-b border-[#222222] hover:bg-[#1a1a1a] transition-colors">
                    <td className="p-4 text-sm text-white">{record.client}</td>
                    <td className="p-4 text-sm text-[#aaaaaa]">
                      {record.items.map((item, idx) => (
                        <div key={item.id} className="flex items-center gap-2 mb-1 last:mb-0">
                          <span className="text-white">{item.item}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] border ${statusRentalColor[item.status]}`}>{item.status}</span>
                          <span className="text-[#aaaaaa]">{item.quantidade}x</span>
                          {idx < record.items.length - 1 && <span className="text-[#333]">|</span>}
                        </div>
                      ))}
                    </td>
                    <td className="p-4 text-sm text-[#aaaaaa]">{record.dataSaida}</td>
                    <td className="p-4 text-sm text-[#aaaaaa]">{record.dataDevolucao || '—'}</td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleOpenRentalModal(record)}
                        className="text-[#B5FF03] hover:text-white transition-colors mr-3"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteRental(record.id)}
                        className="text-[#ff4444] hover:text-white transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {rentalRecords.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-sm text-[#aaaaaa]">
                      Nenhum aluguel registrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Mobile rental cards */}
          <div className="md:hidden space-y-3">
            {rentalRecords.map(record => (
              <div key={record.id} className="bg-[#111] border border-[#333] rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <span className="text-white font-bold text-sm">{record.client}</span>
                  <div className="flex gap-2">
                    <button onClick={() => handleOpenRentalModal(record)} className="text-[#B5FF03] p-2 min-h-[44px]"><Edit3 size={18} /></button>
                    <button onClick={() => handleDeleteRental(record.id)} className="text-[#ff4444] p-2 min-h-[44px]"><Trash2 size={18} /></button>
                  </div>
                </div>
                <div className="space-y-2">
                  {record.items.map(item => (
                    <div key={item.id} className="flex items-center justify-between bg-[#1a1a1a] rounded-lg px-3 py-2">
                      <div className="flex-1">
                        <span className="text-white text-xs font-bold">{item.item}</span>
                        <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] border ${statusRentalColor[item.status]}`}>{item.status}</span>
                      </div>
                      <span className="text-[#aaaaaa] text-xs ml-2">{item.quantidade}x</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-neutral-500">Saída:</span> <span className="text-white">{record.dataSaida}</span></div>
                  <div><span className="text-neutral-500">Devolução:</span> <span className="text-white">{record.dataDevolucao || '—'}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showRentalModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111] border border-[#333] rounded-2xl p-4 md:p-8 max-w-full md:max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-white">{isNewRental ? 'Novo Aluguel' : 'Editar Aluguel'}</h3>
              <button onClick={() => setShowRentalModal(false)} className="text-neutral-400 hover:text-white p-2 min-h-[44px]">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveRental} className="space-y-5">
              <div className="space-y-4 pb-4 border-b border-[#222]">
                <div>
                  <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest mb-2">Cliente</label>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                      type="text"
                      value={clientSearch}
                      onChange={(e) => { setClientSearch(e.target.value); setRentalForm({ ...rentalForm, client: e.target.value }); }}
                      placeholder="Buscar cliente dos orçamentos..."
                      className="w-full pl-10 pr-4 py-3 border border-[#333] rounded-lg font-bold text-white focus:border-[#B5FF03] outline-none transition-colors bg-[#1a1a1a]"
                      autoComplete="off"
                    />
                  </div>
                  {clientSearch && (
                    <div className="mt-1 border border-[#333] rounded-lg overflow-hidden bg-[#1a1a1a] max-h-32 overflow-y-auto">
                      {clientNames.filter(c => c.toLowerCase().includes(clientSearch.toLowerCase())).slice(0, 8).map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => { setRentalForm({ ...rentalForm, client: c }); setClientSearch(c); }}
                          className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#222] transition-colors"
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest mb-2">Data de Saída</label>
                    <input
                      type="date"
                      value={rentalForm.dataSaida}
                      onChange={(e) => setRentalForm({ ...rentalForm, dataSaida: e.target.value })}
                      className="w-full px-4 py-3 border border-[#333] rounded-lg font-bold text-white focus:border-[#B5FF03] outline-none transition-colors bg-[#1a1a1a]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest mb-2">Data de Devolução</label>
                    <input
                      type="date"
                      value={rentalForm.dataDevolucao}
                      onChange={(e) => setRentalForm({ ...rentalForm, dataDevolucao: e.target.value })}
                      className="w-full px-4 py-3 border border-[#333] rounded-lg font-bold text-white focus:border-[#B5FF03] outline-none transition-colors bg-[#1a1a1a]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest mb-3">Itens do Aluguel</label>
                <div className="space-y-3">
                  {rentalForm.items.map((item, idx) => (
                    <div key={item.id} className="flex flex-wrap gap-3 items-start bg-[#1a1a1a] border border-[#333] rounded-lg p-3">
                      <div className="flex-1 min-w-0 w-full sm:w-auto">
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                          <input
                            type="text"
                            value={item.item}
                            onChange={(e) => {
                              const newItems = [...rentalForm.items];
                              newItems[idx] = { ...newItems[idx], item: e.target.value };
                              setRentalForm({ ...rentalForm, items: newItems });
                            }}
                            placeholder="Buscar item do estoque..."
                            className="w-full pl-9 pr-3 py-2 border border-[#333] rounded-lg text-sm font-bold text-white focus:border-[#B5FF03] outline-none transition-colors bg-[#111]"
                            autoComplete="off"
                          />
                        </div>
                        {item.item && (
                          <div className="mt-1 border border-[#333] rounded-lg overflow-hidden bg-[#111] max-h-24 overflow-y-auto">
                            {inventoryItems.filter(i => i.toLowerCase().includes(item.item.toLowerCase())).slice(0, 5).map(i => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => {
                                  const newItems = [...rentalForm.items];
                                  newItems[idx] = { ...newItems[idx], item: i };
                                  setRentalForm({ ...rentalForm, items: newItems });
                                }}
                                className="w-full text-left px-3 py-1.5 text-xs text-white hover:bg-[#222] transition-colors"
                              >
                                {i}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="w-36">
                        <select
                          value={item.status}
                          onChange={(e) => {
                            const newItems = [...rentalForm.items];
                            newItems[idx] = { ...newItems[idx], status: e.target.value as RentalItem['status'] };
                            setRentalForm({ ...rentalForm, items: newItems });
                          }}
                          className="w-full px-3 py-2 border border-[#333] rounded-lg text-sm font-bold text-white focus:border-[#B5FF03] outline-none transition-colors bg-[#111]"
                        >
                          {RENTAL_STATUSES.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div className="w-20">
                        <input
                          type="number"
                          min={1}
                          value={item.quantidade}
                          onChange={(e) => {
                            const newItems = [...rentalForm.items];
                            newItems[idx] = { ...newItems[idx], quantidade: Number(e.target.value) };
                            setRentalForm({ ...rentalForm, items: newItems });
                          }}
                          className="w-full px-3 py-2 border border-[#333] rounded-lg text-sm font-bold text-white focus:border-[#B5FF03] outline-none transition-colors bg-[#111]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newItems = rentalForm.items.filter((_, i) => i !== idx);
                          setRentalForm({ ...rentalForm, items: newItems.length ? newItems : [{ id: generateUUID(), item: '', status: 'Em Trânsito', quantidade: 1 }] });
                        }}
                        className="mt-2 text-[#ff4444] hover:text-white transition-colors shrink-0"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setRentalForm({
                    ...rentalForm,
                    items: [...rentalForm.items, { id: generateUUID(), item: '', status: 'Em Trânsito', quantidade: 1 }]
                  })}
                  className="mt-3 flex items-center gap-2 text-xs font-bold text-[#B5FF03] hover:text-white transition-colors"
                >
                  + Adicionar outro item
                </button>
              </div>

              <div className="flex gap-3 pt-2 border-t border-[#222]">
                <button
                  type="button"
                  onClick={() => setShowRentalModal(false)}
                  className="flex-1 p-3 border border-[#333] rounded-lg text-neutral-400 hover:text-white hover:bg-[#222] transition-colors font-bold min-h-[44px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 p-3 bg-[#B5FF03] text-black rounded-lg font-bold hover:bg-[#a1e600] transition-colors min-h-[44px]"
                >
                  {isNewRental ? 'Adicionar' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateTaskModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111] border border-[#333] rounded-2xl p-4 md:p-8 max-w-full md:max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-black text-white mb-6">Qual categoria deseja adicionar o item?</h3>
            <div className="space-y-3">
              {boards.map(board => (
                <button
                  key={board.id}
                  onClick={() => handleCreateNewTask(board.id)}
                  className="w-full p-4 text-left border border-[#333] rounded-lg hover:bg-[#222] hover:border-[#B5FF03] transition-colors flex items-center gap-3 min-h-[44px]"
                >
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: board.color }} />
                  <span className="font-bold text-white">{board.title}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowCreateTaskModal(false)}
              className="w-full mt-6 p-3 border border-[#333] rounded-lg text-neutral-400 hover:text-white hover:bg-[#222] transition-colors min-h-[44px]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {editingNote && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111] border border-[#333] rounded-2xl p-4 md:p-8 max-w-full md:max-w-2xl w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-white">Editar Notas</h3>
              <button onClick={() => { setEditingNote(null); setNoteContent(''); }} className="text-neutral-400 hover:text-white p-2 min-h-[44px]">
                <X size={20} />
              </button>
            </div>
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={16}
              autoFocus
                className="w-full px-4 py-3 border-2 border-[#333] rounded-xl font-medium text-white focus:border-[#B5FF03] outline-none transition-colors resize-none leading-relaxed bg-[#111]"
              placeholder="Digite suas notas aqui..."
            />
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setEditingNote(null); setNoteContent(''); }}
                className="flex-1 p-3 border border-neutral-200 rounded-lg text-neutral-600 hover:text-black hover:bg-neutral-50 transition-colors font-bold min-h-[44px]"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveNote}
                className="flex-1 p-3 bg-[#B5FF03] text-black rounded-lg font-bold hover:bg-[#a1e600] transition-colors min-h-[44px]"
               >
                  Salvar Nota
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tarefas;
