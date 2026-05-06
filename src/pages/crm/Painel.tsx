import { useEffect, useState, useMemo, useCallback } from 'react';
import { Users, Calendar, MessageSquare, Clock, UserX, CheckCircle, UserPlus, ArrowRight, CheckSquare, Activity, AlertCircle, FileText, Filter, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCRM, type Lead } from '../../contexts/CRMContext';
import { useActivityLogs } from '../../contexts/ActivityContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useFilters } from '../../contexts/FilterContext';

// Dados iniciais como fallback
const INITIAL_LEADS: Lead[] = [
  { id: '1', name: 'João Silva', niche: 'Odontologia', whatsapp: '11 99999-9999', email: 'joao@example.com', instagram: '@joaosilva', stage: 'Reunião Agendada', firstContact: '2026-04-01', closingDate: '2026-04-30', followUpReminder: '2026-04-22', address: 'São Paulo - SP', gmnReviews: '248', gmnStars: '4.7', notes: 'Cliente interessado.', value: 'R$ 5.000' },
  { id: '2', name: 'Maria Santos', niche: 'Dermatologia', whatsapp: '11 88888-8888', email: 'maria@example.com', instagram: '@mariasan', stage: 'Novos Leads', firstContact: '2026-04-10', closingDate: '', followUpReminder: '2026-04-25', address: 'Rio de Janeiro - RJ', gmnReviews: '89', gmnStars: '4.2', notes: '', value: 'R$ 8.000' },
  { id: '3', name: 'Pedro Oliveira', niche: 'Clínica Geral', whatsapp: '11 77777-7777', email: 'pedro@example.com', instagram: '@pedrooli', stage: 'Proposta Enviada', firstContact: '2026-03-20', closingDate: '2026-05-15', followUpReminder: '2026-04-23', address: 'Belo Horizonte - MG', gmnReviews: '312', gmnStars: '4.9', notes: 'Aguardando aprovação.', value: 'R$ 12.000' },
  { id: '4', name: 'Clínica Sorriso', niche: 'Odontologia', whatsapp: '11 5555-5555', email: 'contato@sorriso.com', instagram: '@clinicasorriso', stage: 'Contrato Fechado', firstContact: '2026-03-10', closingDate: '2026-04-15', followUpReminder: '', address: 'Curitiba - PR', gmnReviews: '150', gmnStars: '4.8', notes: 'Contrato fechado!', value: 'R$ 15.000' },
];

const STAGES = [
  'Novos Leads',
  'Primeiro Contato',
  'Contato Ativo',
  'Reunião Agendada',
  'Follow Up',
  'Proposta Enviada',
  'Contrato Fechado',
  'Perdido'
] as const;

interface Stat {
  title: string;
  value: string;
  icon: LucideIcon;
  stageFilter?: string;
}

interface ChartDataPoint {
  name: string;
  value: number;
}

interface ActionIconConfig {
  [key: string]: LucideIcon;
}

const ACTION_ICONS: ActionIconConfig = {
  lead_criado: UserPlus,
  lead_movido: ArrowRight,
  lead_atualizado: ArrowRight,
  tarefa_concluida: CheckSquare,
};

const CHART_CONFIG = {
  margin: { top: 20, right: 10, left: 0, bottom: 60 },
  barSize: 40,
  colors: {
    fill: '#000',
    grid: '#f1f5f9',
    stroke: '#000',
    tooltip: { bg: '#fff', border: '#e2e8f0', text: '#000', fontSize: '12px' },
  },
};

const formatRelativeTime = (timestamp: string): string => {
  if (!timestamp || typeof timestamp !== 'string') return '';
  
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';
  
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 60000);
  
  if (diff < 1) return 'agora';
  if (diff < 60) return `${diff}min`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h`;
  return `${Math.floor(diff / 1440)}d`;
};

const sanitizeDescription = (desc: string | null | undefined): string => {
  if (!desc || typeof desc !== 'string') return '';
  return desc.trim().slice(0, 500);
};

const filterLeads = (leads: Lead[], filters: { stages?: string[]; niches?: string[]; dateFilter?: string }): Lead[] => {
  const { stages = [], niches = [], dateFilter = '' } = filters;
  const hasActiveFilters = stages.length > 0 || niches.length > 0 || dateFilter !== '';
  
  if (!hasActiveFilters) return leads;
  
  return (leads || []).filter(lead => {
    if (stages.length > 0 && !stages.includes(lead.stage)) return false;
    if (niches.length > 0 && !niches.includes(lead.niche)) return false;
    
    if (dateFilter) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (dateFilter === 'today') {
        if (!lead.firstContact) return false;
        const leadDate = new Date(lead.firstContact);
        return leadDate.toDateString() === today.toDateString();
      }
      
      if (dateFilter === 'week') {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        if (!lead.firstContact) return false;
        const leadDate = new Date(lead.firstContact);
        return leadDate >= weekAgo;
      }
      
      if (dateFilter === 'month') {
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        if (!lead.firstContact) return false;
        const leadDate = new Date(lead.firstContact);
        return leadDate >= monthAgo;
      }
    }
    
    return true;
  });
};

const calculateStats = (leads: Lead[], icons: typeof CHART_ICONS) => {
  const stats: Stat[] = [
    { title: 'Total de Leads', value: leads.length.toString(), icon: icons.Users },
    { title: 'Reuniões', value: leads.filter(l => l.stage === 'Reunião Agendada').length.toString(), icon: icons.Calendar, stageFilter: 'Reunião Agendada' },
    { title: 'Contatos Ativos', value: leads.filter(l => l.stage === 'Contato Ativo').length.toString(), icon: icons.MessageSquare, stageFilter: 'Contato Ativo' },
    { title: 'Follow-ups', value: leads.filter(l => l.stage === 'Follow Up').length.toString(), icon: icons.Clock, stageFilter: 'Follow Up' },
    { title: 'Propostas Enviadas', value: leads.filter(l => l.stage === 'Proposta Enviada').length.toString(), icon: icons.FileText, stageFilter: 'Proposta Enviada' },
    { title: 'Leads Perdidos', value: leads.filter(l => l.stage === 'Perdido').length.toString(), icon: icons.UserX, stageFilter: 'Perdido' },
    { title: 'Fechados', value: leads.filter(l => l.stage === 'Contrato Fechado').length.toString(), icon: icons.CheckCircle, stageFilter: 'Contrato Fechado' },
  ];
  return stats;
};

const CHART_ICONS = { Users, Calendar, MessageSquare, Clock, FileText, UserX, CheckCircle };

const CRMDashboard = () => {
  const { leads: contextLeads } = useCRM();
  const { filters, hasActiveFilters } = useFilters();
  const { activityLogs, isLoadingLogs, fetchActivityLogsError, fetchActivityLogs } = useActivityLogs();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Fallback defensivo: usar dados locais se contexto estiver vazio
  const leads = useMemo(() => {
    if (contextLeads && Array.isArray(contextLeads) && contextLeads.length > 0) {
      return contextLeads;
    }
    return INITIAL_LEADS;
  }, [contextLeads]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isSidebarOpen) {
      setIsSidebarOpen(false);
    }
  }, [isSidebarOpen]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    fetchActivityLogs(15).catch(err => {
      console.error('Error fetching activity logs:', err);
    });
  }, [fetchActivityLogs]);

  const filteredLeads = useMemo(() => filterLeads(leads, {
    stages: filters.stages,
    niches: filters.niches,
    dateFilter: filters.dateFilter,
  }), [leads, filters]);

  const chartData = useMemo((): ChartDataPoint[] => {
    return STAGES.map(stage => ({
      name: stage,
      value: filteredLeads.filter(l => l.stage === stage).length
    }));
  }, [filteredLeads]);

  const stats = useMemo(() => calculateStats(filteredLeads, CHART_ICONS), [filteredLeads]);

  const displayLogs = useMemo(() => {
    return activityLogs.slice(0, 10).filter(log => log?.id && log?.acao);
  }, [activityLogs]);

  const hasChartData = chartData.length > 0 && filteredLeads.length > 0;

  return (
    <div className="relative min-h-screen bg-white">
      {isSidebarOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/20 z-40" 
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />
          <div 
            className="absolute top-14 left-4 w-[280px] bg-white border border-neutral-200 rounded-xl shadow-xl z-50 p-3"
            role="dialog"
            aria-label="Filtros ativos"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black text-black uppercase tracking-widest">Filtros</span>
              <button 
                onClick={() => setIsSidebarOpen(false)} 
                className="p-1 hover:bg-neutral-100 rounded-md"
                aria-label="Fechar filtros"
              >
                <XCircle size={14} className="text-neutral-400" />
              </button>
            </div>
            <p className="text-[10px] text-neutral-400">Aplique filtros na aba Leads para filtrar dados aqui.</p>
          </div>
        </>
      )}

      {/* Header section */}
      <div className="mb-4 md:mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl md:text-4xl font-black text-black tracking-tight mb-2 whitespace-nowrap">Painel de Vendas</h1>
          <p className="text-neutral-500 text-xs md:text-sm">Monitoramento em tempo real do seu funil de vendas.</p>
        </div>
        <div className="relative group">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`p-2 rounded-lg border transition-all relative ${hasActiveFilters ? 'bg-neutral-100 text-black border-neutral-200' : 'bg-transparent border-transparent text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50'}`}
          >
            <Filter size={16} strokeWidth={hasActiveFilters ? 2.5 : 1.5} />
            {hasActiveFilters && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
            )}
          </button>
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-neutral-800 text-white text-[10px] font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
            Filtros
          </span>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-2 md:gap-3 lg:gap-4 mb-6 md:mb-10">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-white border border-slate-200 rounded-md p-3 md:p-5 hover:border-black transition-all shadow-sm">
              <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
                <div className="w-6 md:w-8 h-6 md:h-8 rounded-md bg-slate-100 flex items-center justify-center">
                  <Icon size={14} className="text-black md:w-4 md:h-4" />
                </div>
                <p className="text-slate-500 text-[9px] md:text-[11px] font-bold uppercase tracking-widest leading-none">{stat.title}</p>
              </div>
              <p className="text-2xl md:text-3xl font-black text-black">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Chart Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-8 shadow-sm overflow-x-auto mb-6 md:mb-10">
        <div className="mb-6 md:mb-8">
          <h2 className="text-lg md:text-xl font-bold text-black mb-1">Visão Geral do Pipeline</h2>
          <p className="text-slate-400 text-[10px] md:text-xs uppercase font-bold tracking-widest">Distribuição de leads por etapa</p>
        </div>
        
        <div className="min-h-[280px] md:min-h-[400px]">
          {hasChartData ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart 
                data={chartData} 
                margin={CHART_CONFIG.margin}
              >
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke={CHART_CONFIG.colors.grid} 
                  vertical={false} 
                />
                <XAxis 
                  dataKey="name" 
                  stroke={CHART_CONFIG.colors.stroke} 
                  fontSize={10} 
                  fontWeight={600}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  dy={8}
                  dx={5}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={11} 
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                  contentStyle={{ 
                    backgroundColor: CHART_CONFIG.colors.tooltip.bg, 
                    border: `1px solid ${CHART_CONFIG.colors.tooltip.border}`,
                    borderRadius: '12px',
                    color: CHART_CONFIG.colors.tooltip.text,
                    fontSize: CHART_CONFIG.colors.tooltip.fontSize,
                    fontWeight: '600'
                  }}
                />
                <Bar 
                  dataKey="value" 
                  fill={CHART_CONFIG.colors.fill} 
                  radius={[4, 4, 0, 0]}
                  barSize={CHART_CONFIG.barSize}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              Nenhum dado disponível
            </div>
          )}
        </div>
      </div>

      {/* Atividades Recentes */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-8 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <Activity className="w-4 h-4 text-black" aria-hidden="true" />
          <h2 className="text-lg md:text-xl font-bold text-black">Atividades Recentes</h2>
        </div>
        {isLoadingLogs ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-black/20 border-t-black rounded-full animate-spin" />
            <span className="ml-2 text-sm text-neutral-500">Carregando atividades...</span>
          </div>
        ) : fetchActivityLogsError ? (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-md" role="alert">
            <AlertCircle className="w-5 h-5 text-red-500" aria-hidden="true" />
            <p className="text-sm text-red-600">{fetchActivityLogsError}</p>
          </div>
        ) : displayLogs.length === 0 ? (
          <p className="text-slate-400 text-xs">Nenhuma atividade registrada.</p>
        ) : (
          <div className="space-y-3">
            {displayLogs.map((log) => {
              const Icon = ACTION_ICONS[log.acao] || Activity;
              return (
                <div key={log.id} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-3.5 h-3.5 text-black" strokeWidth={2} aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm text-black leading-snug">{sanitizeDescription(log.descricao)}</p>
                    <p className="text-[10px] md:text-xs text-slate-400 font-medium mt-0.5">há {formatRelativeTime(log.timestamp)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CRMDashboard;
