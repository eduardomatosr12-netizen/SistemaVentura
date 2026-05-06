import { useState, useEffect } from 'react';
import { Plus, Trash2, X, Edit3, MessageCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { generateUUID } from '../../lib/uuid';
import { cleanPhoneNumber, generateWhatsAppLink, WHATSAPP_MESSAGE_TEMPLATES } from '../../lib/whatsapp';

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

const DEFAULT_STATUS_COLUMNS: ColumnOption[] = [
  { id: 'st-1', label: 'Pendente', color: '#6b7280' },
  { id: 'st-2', label: 'Em Andamento', color: '#f59e0b' },
  { id: 'st-3', label: 'Concluído', color: '#B5FF03' },
];

const DEFAULT_PRIORITY_COLUMNS: ColumnOption[] = [
  { id: 'pr-1', label: 'Baixa', color: '#6b7280' },
  { id: 'pr-2', label: 'Média', color: '#f59e0b' },
  { id: 'pr-3', label: 'Alta', color: '#ef4444' },
];

const PRESET_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#3b82f6', '#6366f1', '#8b5cf6'];

const COLUMN_TYPES = [
  { type: 'text', label: 'Texto', icon: 'Aa' },
  { type: 'number', label: 'Número', icon: '#' },
  { type: 'status', label: 'Status', icon: '●●' },
  { type: 'priority', label: 'Prioridade', icon: '!' },
  { type: 'people', label: 'Pessoa', icon: '👤' },
  { type: 'date', label: 'Data', icon: '📅' },
  { type: 'notes', label: 'Notas', icon: '📝' },
  { type: 'tags', label: 'Tags', icon: '🏷' },
] as const;

const DEFAULT_BOARD: BoardType = {
  id: 'board-1',
  title: 'Quadro Principal',
  color: '#3b82f6',
  columns: [
    { id: 'col-1', title: 'Tarefa', type: 'text', width: 250 },
    { id: 'col-2', title: 'Responsável', type: 'people', width: 150 },
    { id: 'col-3', title: 'Status', type: 'status', width: 140, options: DEFAULT_STATUS_COLUMNS },
    { id: 'col-4', title: 'Prioridade', type: 'priority', width: 120, options: DEFAULT_PRIORITY_COLUMNS },
    { id: 'col-5', title: 'Notas', type: 'notes', width: 200 },
    { id: 'col-6', title: 'Prazo', type: 'date', width: 130 },
  ],
  rows: [],
};

const Board = ({
  board,
  allBoards,
  onUpdateBoard,
  onDeleteBoard,
  onMoveRow,
  onAddColumn,
}: {
  board: BoardType;
  allBoards: BoardType[];
  onUpdateBoard: (board: BoardType) => void;
  onDeleteBoard: () => void;
  onMoveRow: (rowId: string, fromBoardId: string, toBoardId: string) => void;
  onAddColumn: (boardId: string) => void;
}) => {
  const { role, employeeName } = useAuth();

  const handleAddRow = () => {
    const newRow: Row = {
      id: generateUUID(),
      values: board.columns.reduce((acc, col) => {
        acc[col.id] = col.type === 'number' ? 0 : '';
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

  const handleDeleteColumn = (colId: string) => {
    if (colId === 'col-1') {
      alert('Não é possível excluir a coluna "Tarefa"');
      return;
    }
    
    if (!confirm('Tem certeza que deseja excluir esta coluna?')) {
      return;
    }
    
    const updatedBoard = {
      ...board,
      columns: board.columns.filter(c => c.id !== colId),
      rows: board.rows.map(row => {
        const newValues = { ...row.values };
        delete newValues[colId];
        return { ...row, values: newValues };
      }),
    };
    
    onUpdateBoard(updatedBoard);
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
        return (
          <input
            type="number"
            value={String(value)}
            onChange={(e) => handleCellChange(row.id, col.id, e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            className="w-full min-h-[36px] bg-transparent border-none outline-none text-sm px-3 py-2 text-white hover:bg-[#111] focus:bg-[#222] focus:border-b-2 focus:border-[#B5FF03] transition-colors"
            autoComplete="off"
          />
        );
      case 'status':
      case 'priority': {
        const options = col.options || [];
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
              className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/40 flex items-center justify-center transition-opacity"
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
        <button onClick={onAddColumn}           className="px-3 py-1 text-xs font-bold text-neutral-400 hover:text-white hover:bg-[#222] rounded-md transition-colors">
          + Coluna
        </button>
        <button onClick={onDeleteBoard} className="ml-auto text-neutral-400 hover:text-red-400"><Trash2 size={16} /></button>
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
                    <div className="flex items-center justify-between">
                      <span>{col.title}</span>
                      {col.id !== 'col-1' && (
                        <button
                          onClick={() => handleDeleteColumn(col.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-neutral-400 hover:text-red-500 ml-2 cursor-pointer"
                          title="Excluir coluna"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                {role === 'admin' && (
                  <th className="p-3 border-l border-[#333] text-left text-[10px] font-black uppercase tracking-widest text-white whitespace-nowrap">
                    Última Modificação
                  </th>
                )}
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
                  {role === 'admin' && (
                    <td className="p-3 border-l border-[#333] text-sm text-neutral-400">
                      {row.lastModifiedBy || '—'}
                    </td>
                  )}
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
  const [boards, setBoards] = useState<BoardType[]>(() => {
    const stored = localStorage.getItem('axium_boards_v3');
    return stored ? JSON.parse(stored) : [DEFAULT_BOARD];
  });

  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [showNewBoardModal, setShowNewBoardModal] = useState(false);
  const [showAddColumnModal, setShowAddColumnModal] = useState(false);
  const [selectedBoardForColumn, setSelectedBoardForColumn] = useState<string | null>(null);
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [newBoardColor, setNewBoardColor] = useState('#3b82f6');

  const [editingNote, setEditingNote] = useState<{ rowId: string; colId: string; boardId: string } | null>(null);
  const [noteContent, setNoteContent] = useState('');

  const [newColumnData, setNewColumnData] = useState({
    title: '',
    type: 'text' as Column['type'],
    width: 150,
  });

  useEffect(() => {
    const handleOpenNoteEditor = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setEditingNote({ rowId: detail.rowId, colId: detail.colId, boardId: detail.boardId });
      setNoteContent(detail.value || '');
    };

    window.addEventListener('openNoteEditor', handleOpenNoteEditor);
    return () => window.removeEventListener('openNoteEditor', handleOpenNoteEditor);
  }, []);

  useEffect(() => {
    localStorage.setItem('axium_boards_v3', JSON.stringify(boards));
  }, [boards]);

  const handleUpdateBoard = (updatedBoard: BoardType) => {
    setBoards(boards.map(b => b.id === updatedBoard.id ? updatedBoard : b));
  };

  const handleDeleteBoard = (id: string) => {
    if (boards.length > 1 && confirm('Excluir quadro?')) {
      setBoards(boards.filter(b => b.id !== id));
    }
  };

  const handleCreateNewTask = (boardId: string) => {
    const board = boards.find(b => b.id === boardId);
    if (!board) return;
    
    const newRow: Row = {
      id: generateUUID(),
      values: board.columns.reduce((acc, col) => {
        acc[col.id] = col.type === 'number' ? 0 : '';
        return acc;
      }, {} as Record<string, unknown>),
    };
    
    handleUpdateBoard({ ...board, rows: [...board.rows, newRow] });
    setShowCreateTaskModal(false);
  };

  const handleCreateNewBoard = () => {
    if (!newBoardTitle.trim()) return;
    
    const newBoard: BoardType = {
      id: generateUUID(),
      title: newBoardTitle,
      color: newBoardColor,
      columns: DEFAULT_BOARD.columns,
      rows: [],
    };
    
    setBoards([...boards, newBoard]);
    setNewBoardTitle('');
    setNewBoardColor('#3b82f6');
    setShowNewBoardModal(false);
  };

  const handleAddColumn = (boardId: string) => {
    setSelectedBoardForColumn(boardId);
    setShowAddColumnModal(true);
  };

  const handleConfirmAddColumn = () => {
    if (!newColumnData.title.trim() || !selectedBoardForColumn) return;

    const board = boards.find(b => b.id === selectedBoardForColumn);
    if (!board) return;

    const newColumn: Column = {
      id: generateUUID(),
      title: newColumnData.title,
      type: newColumnData.type,
      width: newColumnData.width,
      options:
        newColumnData.type === 'status' ? [
  { id: 'st-1', label: 'Pendente', color: '#6b7280' },
  { id: 'st-2', label: 'Em Andamento', color: '#f59e0b' },
  { id: 'st-3', label: 'Concluído', color: '#B5FF03' },
        ] :
        newColumnData.type === 'priority' ? [
  { id: 'pr-1', label: 'Baixa', color: '#6b7280' },
  { id: 'pr-2', label: 'Media', color: '#f59e0b' },
  { id: 'pr-3', label: 'Alta', color: '#ef4444' },
        ] :
        newColumnData.type === 'tags' ? [
  { id: 'tg-1', label: 'Urgente', color: '#ef4444' },
  { id: 'tg-2', label: 'Importante', color: '#f59e0b' },
  { id: 'tg-3', label: 'Normal', color: '#B5FF03' },
        ] :
        undefined,
    };

    handleUpdateBoard({ ...board, columns: [...board.columns, newColumn] });
    setShowAddColumnModal(false);
    setSelectedBoardForColumn(null);
    setNewColumnData({ title: '', type: 'text', width: 150 });
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

  return (
    <div className="p-6 space-y-8 min-h-screen bg-black">
      <div className="flex flex-wrap gap-3 mb-6">
        <button 
          onClick={() => setShowCreateTaskModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-[#B5FF03] text-black font-black rounded-lg hover:bg-[#a1e600] transition-colors"
        >
          <Plus size={20} /> Nova Tarefa
        </button>
        <button 
          onClick={() => setShowNewBoardModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-transparent border-2 border-[#B5FF03] text-[#B5FF03] font-black rounded-lg hover:bg-[#B5FF03]/10 transition-colors"
        >
          <Plus size={20} /> Novo Quadro
        </button>
      </div>

      {boards.map(board => (
        <Board 
          key={board.id} 
          board={board} 
          allBoards={boards} 
          onUpdateBoard={handleUpdateBoard}
          onDeleteBoard={() => handleDeleteBoard(board.id)}
          onMoveRow={() => {}}
          onAddColumn={() => handleAddColumn(board.id)}
        />
      ))}

      {showCreateTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111] border border-[#333] rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-black text-white mb-6">Qual quadro deseja criar a tarefa?</h3>
            <div className="space-y-3">
              {boards.map(board => (
                <button
                  key={board.id}
                  onClick={() => handleCreateNewTask(board.id)}
                  className="w-full p-4 text-left border border-[#333] rounded-lg hover:bg-[#222] hover:border-[#B5FF03] transition-colors flex items-center gap-3"
                >
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: board.color }} />
                  <span className="font-bold text-white">{board.title}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowCreateTaskModal(false)}
              className="w-full mt-6 p-3 border border-[#333] rounded-lg text-neutral-400 hover:text-white hover:bg-[#222] transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {showNewBoardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111] border border-[#333] rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-black text-white mb-6">Criar Novo Quadro</h3>
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest mb-2">Nome do Quadro</label>
                <input
                  type="text"
                  value={newBoardTitle}
                  onChange={(e) => setNewBoardTitle(e.target.value)}
                  placeholder="Ex: Projetos, Vendas, Leads..."
                  className="w-full px-4 py-3 border-2 border-[#333] rounded-lg font-bold text-white focus:border-[#B5FF03] outline-none transition-colors bg-[#111]"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest mb-2">Cor</label>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setNewBoardColor(color)}
                      className={`w-10 h-10 rounded-full transition-all ${newBoardColor === color ? 'scale-110 ring-2 ring-offset-2 ring-[#B5FF03]' : 'hover:scale-105'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setShowNewBoardModal(false)}
                className="flex-1 p-3 border border-neutral-200 rounded-lg text-neutral-600 hover:text-black hover:bg-neutral-50 transition-colors font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateNewBoard}
                disabled={!newBoardTitle.trim()}
                className="flex-1 p-3 bg-[#B5FF03] text-black rounded-lg font-bold hover:bg-[#a1e600] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
               >
                  Criar Quadro
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddColumnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111] border border-[#333] rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-white">Adicionar Coluna</h3>
              <button onClick={() => setShowAddColumnModal(false)} className="text-neutral-400 hover:text-black">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest mb-2">Nome da Coluna</label>
                <input
                  type="text"
                  value={newColumnData.title}
                  onChange={(e) => setNewColumnData({ ...newColumnData, title: e.target.value })}
                  placeholder="Ex: Descrição, Valor, Data..."
                  className="w-full px-4 py-3 border-2 border-[#333] rounded-lg font-bold text-white focus:border-[#B5FF03] outline-none transition-colors bg-[#111]"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-neutral-500 uppercase tracking-widest mb-2">Tipo da Coluna</label>
                <div className="grid grid-cols-2 gap-2">
                  {COLUMN_TYPES.map(ct => (
                    <button
                      key={ct.type}
                      onClick={() => setNewColumnData({ ...newColumnData, type: ct.type })}
                      className={`p-3 rounded-lg border-2 text-left transition-colors ${newColumnData.type === ct.type ? 'border-[#B5FF03] bg-black text-[#B5FF03]' : 'border-[#333] hover:border-[#555]'}`}
                    >
                      <span className="text-sm">{ct.icon}</span>
                      <span className="ml-2 text-xs font-bold">{ct.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-black text-neutral-500 uppercase tracking-widest mb-2">Largura (px)</label>
                <input
                  type="number"
                  value={newColumnData.width}
                  onChange={(e) => setNewColumnData({ ...newColumnData, width: Number(e.target.value) })}
                  className="w-full px-4 py-3 border-2 border-[#333] rounded-lg font-bold text-white focus:border-[#B5FF03] outline-none transition-colors bg-[#111]"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setShowAddColumnModal(false)}
                  className="flex-1 p-3 border border-[#333] rounded-lg text-neutral-400 hover:text-white hover:bg-[#222] transition-colors font-bold"
                >
                  Cancelar
              </button>
              <button
                onClick={handleConfirmAddColumn}
                disabled={!newColumnData.title.trim()}
                className="flex-1 p-3 bg-[#B5FF03] text-black rounded-lg font-bold hover:bg-[#a1e600] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
               >
                  Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {editingNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111] border border-[#333] rounded-2xl p-8 max-w-2xl w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-white">Editar Notas</h3>
              <button onClick={() => { setEditingNote(null); setNoteContent(''); }} className="text-neutral-400 hover:text-white">
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
                className="flex-1 p-3 border border-neutral-200 rounded-lg text-neutral-600 hover:text-black hover:bg-neutral-50 transition-colors font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveNote}
                className="flex-1 p-3 bg-[#B5FF03] text-black rounded-lg font-bold hover:bg-[#a1e600] transition-colors"
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
