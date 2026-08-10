import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Plus, Search, Pencil, Trash2, Package, ShoppingBag, X, FileText, ChevronDown, ChevronLeft, ChevronRight, BarChart3, TrendingUp, RefreshCw,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import { useCRM } from '../contexts/CRMContext';
import { generateUUID } from '../lib/uuid';
import { formatCurrency } from '../lib/crmHelpers';
import type { OrcamentoItem } from '../types/crm';
import {
  subscribeEventStock,
  addEventStockItem,
  updateEventStockItem,
  deleteEventStockItem,
  EVENT_STOCK_CATEGORIES,
  EVENT_STOCK_UNITS,
  type EventStockItem,
} from '../services/eventStockService';
import {
  fetchEventUsageReport,
  fetchStockMetrics,
  type EventUsageReport,
  type StockMetrics,
} from '../services/eventReportsService';

const CATEGORY_COLORS: Record<string, string> = {
  'Iluminação': '#6b7280',
  'Som': '#3b82f6',
  'Efeitos': '#ef4444',
  'Estrutura': '#f59e0b',
  'Vídeo': '#06b6d4',
  'Outros': '#22c55e',
};

const CLOSED_STAGES = new Set(['Contrato Fechado', 'Perdido']);

const CHART_COLORS = ['#B5FF03', '#22d3ee', '#a78bfa', '#fb7185', '#fbbf24', '#64748b'];

const FALLBACK_TOP_ITEMS = [
  { key: 'mock-jatos-co2', name: 'Jatos CO2', qty: 38 },
  { key: 'mock-pirotecnia', name: 'Pirotecnia', qty: 27 },
  { key: 'mock-spotlights', name: 'Spotlights', qty: 22 },
  { key: 'mock-gerador', name: 'Gerador', qty: 15 },
  { key: 'mock-painel-led', name: 'Painel LED', qty: 12 },
  { key: 'mock-outros', name: 'Outros', qty: 9 },
];

const FALLBACK_MONTHLY = [
  { monthIndex: 0, label: 'Jan', total: 12 },
  { monthIndex: 1, label: 'Fev', total: 19 },
  { monthIndex: 2, label: 'Mar', total: 14 },
  { monthIndex: 3, label: 'Abr', total: 26 },
  { monthIndex: 4, label: 'Mai', total: 21 },
  { monthIndex: 5, label: 'Jun', total: 33 },
  { monthIndex: 6, label: 'Jul', total: 28 },
  { monthIndex: 7, label: 'Ago', total: 41 },
  { monthIndex: 8, label: 'Set', total: 25 },
  { monthIndex: 9, label: 'Out', total: 30 },
  { monthIndex: 10, label: 'Nov', total: 18 },
  { monthIndex: 11, label: 'Dez', total: 36 },
];

const FULL_MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

interface EstoqueDeEventosProps {
  onMessage: (msg: string) => void;
}

const EstoqueDeEventos = ({ onMessage }: EstoqueDeEventosProps) => {
  const { Orçamentos, updateLead } = useCRM();
  const [items, setItems] = useState<EventStockItem[]>([]);
  const [search, setSearch] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EventStockItem | null>(null);
  const [form, setForm] = useState<{ name: string; category: string; quantity: string; unit: string; valorReferencia: string; observacao: string }>({
    name: '',
    category: EVENT_STOCK_CATEGORIES[0],
    quantity: '',
    unit: EVENT_STOCK_UNITS[0],
    valorReferencia: '',
    observacao: '',
  });

  const [linkItem, setLinkItem] = useState<EventStockItem | null>(null);
  const [linkOrcamentoId, setLinkOrcamentoId] = useState('');
  const [linkQty, setLinkQty] = useState(1);
  const [linkError, setLinkError] = useState('');

  useEffect(() => {
    const unsub = subscribeEventStock(next => setItems(next));
    return unsub;
  }, []);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return items.filter(i =>
      i.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q)
    );
  }, [items, search]);

  const openOrcamentos = useMemo(() => {
    return Orçamentos.filter(o => !CLOSED_STAGES.has(o.stage));
  }, [Orçamentos]);

  const openForm = (item?: EventStockItem) => {
    setEditingItem(item || null);
    setForm(item ? {
      name: item.name,
      category: item.category || EVENT_STOCK_CATEGORIES[0],
      quantity: String(item.quantity || ''),
      unit: item.unit || 'unidade',
      valorReferencia: item.valorReferencia ? String(item.valorReferencia) : '',
      observacao: item.observacao || '',
    } : {
      name: '',
      category: EVENT_STOCK_CATEGORIES[0],
      quantity: '',
      unit: 'unidade',
      valorReferencia: '',
      observacao: '',
    });
    setFormOpen(true);
  };

  const handleSaveItem = async () => {
    if (!form.name.trim()) return;
    const quantity = Math.max(0, Number(form.quantity) || 0);
    const payload = {
      name: form.name.trim(),
      category: form.category,
      quantity,
      unit: form.unit,
      valorReferencia: parseFloat(String(form.valorReferencia).replace(',', '.')) || 0,
      observacao: form.observacao.trim(),
    };
    try {
      if (editingItem) {
        await updateEventStockItem(editingItem.id, payload);
        onMessage('Item atualizado com sucesso.');
      } else {
        await addEventStockItem(payload);
        onMessage('Item cadastrado no estoque de eventos.');
      }
      setFormOpen(false);
      setEditingItem(null);
    } catch (err) {
      console.error('[EstoqueDeEventos] Erro ao salvar item:', err);
      onMessage('Erro ao salvar o item. Tente novamente.');
    }
  };

  const handleDeleteItem = async (item: EventStockItem) => {
    if (!confirm(`Tem certeza que deseja excluir "${item.name}" do estoque de eventos?`)) return;
    try {
      await deleteEventStockItem(item.id);
      onMessage('Item excluído do estoque de eventos.');
    } catch (err) {
      console.error('[EstoqueDeEventos] Erro ao excluir item:', err);
      onMessage('Erro ao excluir o item. Tente novamente.');
    }
  };

  const handleConfirmLink = async () => {
    if (!linkItem || !linkOrcamentoId) {
      setLinkError('Selecione um orçamento para vincular o item.');
      return;
    }
    const qty = Math.max(1, Math.floor(Number(linkQty) || 1));
    if (qty > linkItem.quantity) {
      setLinkError(`Quantidade disponível no estoque de eventos: ${linkItem.quantity}.`);
      return;
    }
    const lead = Orçamentos.find(o => o.id === linkOrcamentoId);
    if (!lead) {
      setLinkError('Orçamento não encontrado.');
      return;
    }
    const cleanName = `${linkItem.name} — ${qty} ${linkItem.unit}`;
    const newItem: OrcamentoItem = {
      id: generateUUID(),
      item: cleanName,
      qtdAtual: qty,
      valorUnit: 0,
      semPreco: true,
      eventStockId: linkItem.id,
    };
    try {
      await updateLead(linkOrcamentoId, { items: [...(lead.items || []), newItem] });
      onMessage(`"${cleanName}" adicionado ao orçamento de ${lead.name}.`);
      setLinkItem(null);
      setLinkOrcamentoId('');
      setLinkQty(1);
      setLinkError('');
    } catch (err) {
      console.error('[EstoqueDeEventos] Erro ao vincular ao orçamento:', err);
      setLinkError('Erro ao vincular o item ao orçamento. Tente novamente.');
    }
  };

  const categoryColor = (category: string) => CATEGORY_COLORS[category] || '#6b7280';

  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [report, setReport] = useState<EventUsageReport | null>(null);
  const [metrics, setMetrics] = useState<StockMetrics | null>(null);

  const periodYear = period.getFullYear();
  const periodMonth = period.getMonth();
  const periodLabel = FULL_MONTHS[periodMonth];

  const movePeriod = useCallback((delta: number) => {
    setPeriod(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }, []);

  const loadReports = useCallback(async (year: number, month: number) => {
    try {
      const [r, m] = await Promise.all([fetchEventUsageReport(year, month), fetchStockMetrics()]);
      setReport(r);
      setMetrics(m);
    } catch (err) {
      console.error('[EstoqueDeEventos] Erro ao carregar relatórios:', err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [r, m] = await Promise.all([fetchEventUsageReport(periodYear, periodMonth), fetchStockMetrics()]);
        if (cancelled) return;
        setReport(r);
        setMetrics(m);
      } catch (err) {
        if (!cancelled) console.error('[EstoqueDeEventos] Erro ao carregar relatórios:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [periodYear, periodMonth]);

  const chartTooltipStyle = {
    backgroundColor: '#111',
    border: '1px solid #333',
    borderRadius: 8,
    fontSize: 12,
    color: '#fff',
  };

  const hasReportData = (report?.totalSaidas ?? 0) > 0;
  const topItemsData = hasReportData && report ? report.topItems : FALLBACK_TOP_ITEMS;
  const monthlyData = useMemo(() => {
    const base = hasReportData && report ? report.monthly : FALLBACK_MONTHLY;
    return base.map(m => (m.monthIndex === periodMonth ? m : { ...m, total: 0 }));
  }, [hasReportData, report, periodMonth]);

  return (
    <div className="bg-[#111] border border-[#333] rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 md:p-6 border-b border-[#222]">
        <div>
          <h2 className="text-lg font-black text-white tracking-tight">Estoque de Eventos</h2>
          <p className="text-[11px] text-neutral-400 mt-0.5">Itens entregues ao cliente em cada evento — lista limpa, sem dados internos.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center flex-1 sm:flex-none bg-[#0a0a0a] border border-[#333] rounded-lg overflow-hidden focus-within:border-[#B5FF03] transition-colors">
            <Search size={14} className="text-neutral-500 ml-3 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar item..."
              className="w-full sm:w-56 bg-transparent border-none px-2 py-2 text-sm text-white placeholder-neutral-600 outline-none"
              autoComplete="off"
            />
          </div>
          <button
            onClick={() => openForm()}
            className="rounded-full px-3 sm:px-4 py-2 bg-[#B5FF03] text-black font-bold text-[10px] sm:text-xs uppercase tracking-widest hover:bg-[#a1e600] transition-colors min-h-[44px] shrink-0 flex items-center gap-1.5"
          >
            <Plus size={14} /> Adicionar Item
          </button>
        </div>
      </div>

      {/* Relatórios Analíticos */}
      <div className="p-4 md:p-6 space-y-4 border-b border-[#222]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-[#B5FF03] flex items-center gap-2">
              <BarChart3 size={14} strokeWidth={3} /> Relatórios Analíticos
            </h3>
            <p className="text-[10px] text-neutral-500 mt-0.5">
              Saídas dos itens do estoque de eventos (eventos confirmados e realizados).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[#0a0a0a] border border-[#333] rounded-lg overflow-hidden">
              <button
                onClick={() => movePeriod(-1)}
                className="p-2 text-neutral-400 hover:text-[#B5FF03] hover:bg-[#222] transition-colors flex items-center justify-center min-w-[32px] min-h-[38px]"
                title="Mês anterior"
                aria-label="Mês anterior"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="px-2 text-xs font-black text-white whitespace-nowrap min-w-[128px] text-center select-none">
                {periodLabel} {periodYear}
              </span>
              <button
                onClick={() => movePeriod(1)}
                className="p-2 text-neutral-400 hover:text-[#B5FF03] hover:bg-[#222] transition-colors flex items-center justify-center min-w-[32px] min-h-[38px]"
                title="Próximo mês"
                aria-label="Próximo mês"
              >
                <ChevronRight size={15} />
              </button>
            </div>
            <button
              onClick={() => loadReports(periodYear, periodMonth)}
              className="p-2 rounded-lg text-neutral-400 hover:text-[#B5FF03] hover:bg-[#222] transition-colors flex items-center justify-center min-w-[38px] min-h-[38px]"
              title="Atualizar relatórios"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Cards de métricas rápidas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-[#0a0a0a] border border-[#333] rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#B5FF03]/10 border border-[#B5FF03]/30 flex items-center justify-center shrink-0">
              <Package size={17} className="text-[#B5FF03]" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Itens Cadastrados</p>
              <p className="text-xl font-black text-white leading-tight">{items.length}</p>
              <p className="text-[9px] text-neutral-500">no estoque de eventos</p>
            </div>
          </div>
          <div className="bg-[#0a0a0a] border border-[#333] rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#22d3ee]/10 border border-[#22d3ee]/30 flex items-center justify-center shrink-0">
              <ShoppingBag size={17} className="text-[#22d3ee]" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Alugados / Em Eventos</p>
              <p className="text-xl font-black text-white leading-tight">{metrics?.itemsInEvents ?? 0}</p>
              <p className="text-[9px] text-neutral-500">
                {metrics && metrics.itemsInEventsCount > 0 ? `${metrics.itemsInEventsCount} vínculos em eventos ativos` : 'nenhum vínculo ativo'}
              </p>
            </div>
          </div>
          <div className="bg-[#0a0a0a] border border-[#333] rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#a78bfa]/10 border border-[#a78bfa]/30 flex items-center justify-center shrink-0">
              <TrendingUp size={17} className="text-[#a78bfa]" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Item Mais Rentável</p>
              {report?.mostProfitable ? (
                <>
                  <p className="text-sm font-black text-white leading-tight truncate">{report.mostProfitable.name}</p>
                  <p className="text-[9px] text-[#B5FF03] font-bold">
                    {formatCurrency(report.mostProfitable.valor)} em valor de referência
                  </p>
                </>
              ) : (
                <p className="text-xl font-black text-neutral-600 leading-tight">—</p>
              )}
            </div>
          </div>
        </div>

        {/* Gráficos */}
        {!hasReportData && (
          <div className="flex items-start gap-2 bg-[#B5FF03]/5 border border-[#B5FF03]/20 rounded-lg px-3 py-2.5">
            <Package size={13} className="text-[#B5FF03] shrink-0 mt-0.5" />
            <p className="text-[10px] text-neutral-400 leading-relaxed">
              Nenhuma saída real em <span className="text-white font-bold">{periodLabel} {periodYear}</span>. Mostrando{' '}
              <span className="text-[#B5FF03] font-bold">dados de exemplo</span> — vincule itens do estoque a eventos
              confirmados e realizados para ver os dados reais.
            </p>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Doughnut — Top itens */}
          <div className="bg-[#0a0a0a] border border-[#333] rounded-xl p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-white mb-1">Top Itens Mais Usados</p>
            <p className="text-[10px] text-neutral-500 mb-2">
              {periodLabel} {periodYear} — {hasReportData && report ? `${report.eventsCount} eventos` : 'dados de exemplo'}
            </p>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={topItemsData}
                  dataKey="qty"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={3}
                  stroke="#0a0a0a"
                >
                  {topItemsData.map((entry, i) => (
                    <Cell key={entry.key} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(value, _name, props) => [`${value} saídas`, props.payload?.name]}
                />
                <Legend
                  verticalAlign="bottom"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 10, color: '#a3a3a3' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Área — Saídas por mês */}
          <div className="bg-[#0a0a0a] border border-[#333] rounded-xl p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-white mb-1">Saídas por Mês</p>
            <p className="text-[10px] text-neutral-500 mb-2">
              {periodLabel} {periodYear} — {hasReportData && report ? `${report.totalSaidas} itens no total` : 'dados de exemplo'}
            </p>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={monthlyData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="saidasGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#B5FF03" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#B5FF03" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis dataKey="label" stroke="#555" fontSize={10} tickLine={false} axisLine={{ stroke: '#333' }} />
                <YAxis stroke="#555" fontSize={10} tickLine={false} axisLine={{ stroke: '#333' }} allowDecimals={false} />
                <Tooltip contentStyle={chartTooltipStyle} formatter={value => [`${value} itens`, 'Saídas']} />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#B5FF03"
                  strokeWidth={2}
                  fill="url(#saidasGrad)"
                  dot={{ fill: '#B5FF03', r: 2.5, strokeWidth: 0 }}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="overflow-x-auto hidden md:block">
        <table className="w-full min-w-[820px] text-left">
          <thead>
            <tr className="border-b border-[#222]">
              <th className="text-[10px] font-black uppercase tracking-widest text-neutral-500 px-4 py-3">Item</th>
              <th className="text-[10px] font-black uppercase tracking-widest text-neutral-500 px-4 py-3">Categoria</th>
              <th className="text-[10px] font-black uppercase tracking-widest text-neutral-500 px-4 py-3">Quantidade</th>
              <th className="text-[10px] font-black uppercase tracking-widest text-neutral-500 px-4 py-3">Valor de Referência</th>
              <th className="text-[10px] font-black uppercase tracking-widest text-neutral-500 px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12">
                  <Package size={28} className="mx-auto text-neutral-600 mb-2" />
                  <p className="text-xs text-neutral-500 italic">Nenhum item no estoque de eventos.</p>
                  <p className="text-[10px] text-neutral-600 mt-1">Clique em "+ Adicionar Item" para cadastrar o primeiro.</p>
                </td>
              </tr>
            ) : (
              filteredItems.map(item => (
                <tr key={item.id} className="border-b border-[#222] hover:bg-[#0a0a0a] transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm text-white font-bold">{item.name}</p>
                    {item.observacao && (
                      <p className="text-[10px] text-neutral-500 truncate max-w-[260px]">{item.observacao}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: categoryColor(item.category) + '26', border: `1px solid ${categoryColor(item.category)}` }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: categoryColor(item.category) }} />
                      {item.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-white font-bold">{item.quantity} <span className="text-neutral-400 font-normal text-xs">{item.unit}</span></td>
                  <td className="px-4 py-3 text-sm text-neutral-300">
                    {item.valorReferencia > 0 ? formatCurrency(item.valorReferencia) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => { setLinkItem(item); setLinkOrcamentoId(''); setLinkQty(item.quantity > 0 ? Math.min(1, item.quantity) : 1); setLinkError(''); }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-bold text-[#B5FF03] border border-[#B5FF03]/30 hover:bg-[#B5FF03]/10 transition-colors min-h-[36px]"
                        title="Adicionar ao orçamento"
                      >
                        <ShoppingBag size={12} /> Orçamento
                      </button>
                      <button
                        onClick={() => openForm(item)}
                        className="p-2 rounded-md text-neutral-400 hover:text-[#B5FF03] hover:bg-[#222] transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                        title="Editar item"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item)}
                        className="p-2 rounded-md text-neutral-400 hover:text-red-400 hover:bg-red-400/10 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                        title="Excluir item"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden divide-y divide-[#222]">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <Package size={28} className="mx-auto text-neutral-600 mb-2" />
            <p className="text-xs text-neutral-500 italic">Nenhum item no estoque de eventos.</p>
            <p className="text-[10px] text-neutral-600 mt-1">Clique em "+ Adicionar Item" para cadastrar o primeiro.</p>
          </div>
        ) : (
          filteredItems.map(item => (
            <div key={item.id} className="p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white font-bold truncate">{item.name}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: categoryColor(item.category) + '26', border: `1px solid ${categoryColor(item.category)}` }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: categoryColor(item.category) }} />
                      {item.category}
                    </span>
                    <span className="text-xs text-white font-bold">{item.quantity} <span className="text-neutral-400 font-normal text-[10px]">{item.unit}</span></span>
                  </div>
                  {item.observacao && (
                    <p className="text-[10px] text-neutral-500 mt-1">{item.observacao}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-neutral-300">
                  {item.valorReferencia > 0 ? formatCurrency(item.valorReferencia) : '—'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { setLinkItem(item); setLinkOrcamentoId(''); setLinkQty(item.quantity > 0 ? Math.min(1, item.quantity) : 1); setLinkError(''); }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-[10px] font-bold text-[#B5FF03] border border-[#B5FF03]/30 hover:bg-[#B5FF03]/10 transition-colors min-h-[44px]"
                >
                  <ShoppingBag size={12} /> Adicionar ao Orçamento
                </button>
                <button
                  onClick={() => openForm(item)}
                  className="p-2.5 rounded-md text-neutral-400 hover:text-[#B5FF03] hover:bg-[#222] transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                  title="Editar item"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDeleteItem(item)}
                  className="p-2.5 rounded-md text-neutral-400 hover:text-red-400 hover:bg-red-400/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                  title="Excluir item"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit modal */}
      {formOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-[100] p-0 sm:p-4" onClick={() => setFormOpen(false)}>
          <div className="bg-[#0a0a0a] border border-[#222222] rounded-t-2xl sm:rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#222]">
              <h3 className="text-sm font-black uppercase tracking-widest text-[#B5FF03]">
                {editingItem ? 'Editar Item' : 'Novo Item'}
              </h3>
              <button onClick={() => setFormOpen(false)} className="p-2 hover:bg-[#222] rounded-md transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
                <X size={16} className="text-neutral-400" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5">Nome do Item *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Iluminação Cênica"
                  className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-[#B5FF03] outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5">Categoria *</label>
                <div className="relative">
                  <select
                    value={form.category}
                    onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                    className="w-full appearance-none bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none [color-scheme:dark] pr-9"
                  >
                    {EVENT_STOCK_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5">Quantidade *</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.quantity}
                    onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))}
                    className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5">Unidade *</label>
                  <div className="relative">
                    <select
                      value={form.unit}
                      onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}
                      className="w-full appearance-none bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none [color-scheme:dark] pr-9"
                    >
                      {EVENT_STOCK_UNITS.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5">Valor de Referência por Evento (R$) <span className="text-neutral-600 normal-case font-medium">— interno</span></label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.valorReferencia}
                  onChange={e => setForm(p => ({ ...p, valorReferencia: e.target.value }))}
                  placeholder="Opcional — não aparece no PDF/WhatsApp"
                  className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-[#B5FF03] outline-none [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5">Observação Interna <span className="text-neutral-600 normal-case font-medium">— não exportada</span></label>
                <textarea
                  rows={3}
                  value={form.observacao}
                  onChange={e => setForm(p => ({ ...p, observacao: e.target.value }))}
                  placeholder="Anotações internas (não vão para o cliente)..."
                  className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-[#B5FF03] outline-none resize-none"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => setFormOpen(false)}
                  className="flex-1 py-3 bg-[#1a1a1a] border border-[#333] text-white font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-[#222] transition-all min-h-[44px]"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveItem}
                  disabled={!form.name.trim()}
                  className="flex-1 py-3 bg-[#B5FF03] text-black font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-[#a1e600] transition-all min-h-[44px] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {editingItem ? 'Salvar Alterações' : 'Cadastrar Item'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Link to orçamento modal */}
      {linkItem && (
        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-[100] p-0 sm:p-4" onClick={() => setLinkItem(null)}>
          <div className="bg-[#0a0a0a] border border-[#222222] rounded-t-2xl sm:rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#222]">
              <h3 className="text-sm font-black uppercase tracking-widest text-[#B5FF03]">Adicionar ao Orçamento</h3>
              <button onClick={() => setLinkItem(null)} className="p-2 hover:bg-[#222] rounded-md transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
                <X size={16} className="text-neutral-400" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-[#111] border border-[#333] rounded-lg p-3 space-y-1">
                <p className="text-sm text-white font-bold">{linkItem.name}</p>
                <p className="text-[10px] text-neutral-500">
                  Disponível: <span className="text-white font-bold">{linkItem.quantity} {linkItem.unit}</span>
                </p>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5">Orçamento / Evento</label>
                <div className="relative">
                  <select
                    value={linkOrcamentoId}
                    onChange={e => { setLinkOrcamentoId(e.target.value); setLinkError(''); }}
                    className="w-full appearance-none bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none [color-scheme:dark] pr-9"
                  >
                    <option value="">Selecionar orçamento...</option>
                    {openOrcamentos.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.name} {o.whatsapp ? `— ${o.whatsapp}` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                {openOrcamentos.length === 0 && (
                  <p className="text-[10px] text-neutral-500 italic mt-1">Nenhum orçamento em aberto encontrado.</p>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5">Quantidade a Alocar</label>
                <input
                  type="number"
                  min="1"
                  max={linkItem.quantity}
                  step="1"
                  value={linkQty}
                  onChange={e => { setLinkQty(Number(e.target.value)); setLinkError(''); }}
                  className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:border-[#B5FF03] outline-none [color-scheme:dark]"
                />
              </div>
              <div className="bg-[#1a1a1a] border border-[#222] rounded-lg px-3 py-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500 mb-1">Aparecerá no orçamento como</p>
                <p className="text-xs text-white font-bold">
                  {linkItem.name} — {Math.max(1, Math.floor(Number(linkQty) || 1))} {linkItem.unit}
                </p>
              </div>
              {linkError && (
                <div className="px-4 py-2.5 bg-red-900/20 border border-red-900/40 rounded-lg">
                  <p className="text-[11px] text-red-400 font-bold">{linkError}</p>
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => setLinkItem(null)}
                  className="flex-1 py-3 bg-[#1a1a1a] border border-[#333] text-white font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-[#222] transition-all min-h-[44px]"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmLink}
                  className="flex-1 py-3 bg-[#B5FF03] text-black font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-[#a1e600] transition-all min-h-[44px] flex items-center justify-center gap-1.5"
                >
                  <FileText size={13} /> Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EstoqueDeEventos;
