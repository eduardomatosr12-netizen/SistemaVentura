import { 
  DndContext, 
  PointerSensor, 
  TouchSensor,
  useSensor, 
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
  closestCorners
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { useState, useMemo, useCallback, memo } from 'react';
import { useCRM } from '../../contexts/CRMContext';
import { useFilters } from '../../contexts/FilterContext';
import type { Lead } from '../../contexts/CRMContext';
import { Filter, XCircle } from 'lucide-react';
import { 
  STAGES, 
  type Stage, 
  STAGE_CONFIG, 
  formatCurrency, 
  parseMonetaryValue,
  isValidStage,
  calculateTotalValue
} from '../../lib/crmHelpers';
import { MessageCircle } from 'lucide-react';
import { cleanPhoneNumber, generateWhatsAppLink, WHATSAPP_MESSAGE_TEMPLATES } from '../../lib/whatsapp';
import { useAuth } from '../../contexts/AuthContext';

interface LeadCardProps {
  lead: Lead;
  isClosed: boolean;
}

const DraggableLeadCard = memo<LeadCardProps>(({ lead, isClosed }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead }
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: isDragging ? 50 : undefined,
  } : undefined;

  const { employeeName } = useAuth();
  
  return (
    <div
      ref={setNodeRef}
      style={{ ...style, width: '100%' }}
      {...listeners}
      {...attributes}
      className={`pipeline-card-base bg-[#1a1a1a] w-full p-2 md:p-4 rounded-md border border-[#333] shadow-none hover:border-[#B5FF03] transition-all cursor-grab active:cursor-grabbing group ${isDragging ? 'opacity-50 grayscale border-[#B5FF03] dragging-card' : ''}`}
    >
      <div className="font-bold text-[11px] md:text-[13px] text-white mb-0.5">{lead.name}</div>
      <div className="text-[9px] md:text-[10px] text-neutral-400 font-semibold mb-2 md:mb-3">{lead.niche}</div>
      
      {lead.whatsapp && (
        <div className="flex items-center gap-1 mb-2">
          <span className="text-[9px] md:text-[10px] text-neutral-400">{lead.whatsapp}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const link = generateWhatsAppLink(lead.whatsapp, WHATSAPP_MESSAGE_TEMPLATES[0].template(lead.name, employeeName || 'Usuário'));
              window.open(link, '_blank');
            }}
            className="text-[#25D366] hover:text-green-600 transition-colors"
            title="Enviar mensagem via WhatsApp"
          >
            <MessageCircle size={12} className="md:w-3.5 md:h-3.5" />
          </button>
        </div>
      )}

      {isClosed && (
        <div className="pt-2 md:pt-3 border-t border-[#333] mt-2 md:mt-3">
          <div className="flex justify-between items-center gap-2">
            <div className="flex flex-col">
              <span className="text-[7px] md:text-[8px] text-neutral-400 font-bold uppercase tracking-[0.1em]">Valor</span>
              <span className="text-[10px] md:text-xs font-black text-white mt-0.5">{lead.value || 'R$ 0,00'}</span>
            </div>
            <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-[#B5FF03]/20 text-[#B5FF03] flex items-center justify-center text-[9px] md:text-[10px] font-bold flex-shrink-0">
              ✓
            </div>
          </div>
        </div>
      )}

      {!isClosed && (
        <div className="flex justify-end">
          <div className="w-6 h-6 rounded-full bg-[#222] flex items-center justify-center text-[10px] font-bold text-neutral-400 group-hover:bg-[#B5FF03] group-hover:text-black transition-colors">
            →
          </div>
        </div>
      )}
    </div>
  );
});

DraggableLeadCard.displayName = 'DraggableLeadCard';

const StaticLeadCard = memo<LeadCardProps>(({ lead, isClosed }) => (
  <div className="pipeline-card-base bg-[#1a1a1a] w-full p-4 rounded-md border-2 border-[#B5FF03] shadow-xl pointer-events-none">
    <div className="font-bold text-[13px] text-white mb-0.5">{lead.name}</div>
    <div className="text-[10px] text-neutral-400 font-semibold mb-3">{lead.niche}</div>
    {isClosed && (
        <div className="pt-3 border-t border-[#333] mt-3">
          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-[8px] text-neutral-400 font-bold uppercase tracking-[0.1em]">Valor do Contrato</span>
              <span className="text-xs font-black text-white mt-0.5">{lead.value || 'R$ 0,00'}</span>
            </div>
            <div className="w-6 h-6 rounded-full bg-[#B5FF03]/20 text-[#B5FF03] flex items-center justify-center text-[10px] font-bold">
              ✓
            </div>
          </div>
        </div>
    )}
  </div>
));

StaticLeadCard.displayName = 'StaticLeadCard';

interface DroppableColumnProps {
  stage: Stage;
  children: React.ReactNode;
  count: number;
  totalValue: number;
}

const DroppableColumn = memo<DroppableColumnProps>(({ stage, children, count, totalValue }) => {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const config = STAGE_CONFIG[stage];

  return (
    <div 
      ref={setNodeRef}
      className={`bg-[#0a0a0a] border-2 rounded-md w-[300px] shrink-0 flex flex-col max-h-full transition-colors ${isOver ? 'border-[#B5FF03] bg-[#111]' : 'border-[#333]'}`}
    >
      <div className="bg-[#111] border-b border-[#333] rounded-t-xl">
        <div className="p-5 border-b border-[#333] bg-[#111] rounded-t-xl">
          <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-black text-white uppercase tracking-widest">{stage}</h3>
                <span className="text-[10px] font-bold bg-[#222] text-[#B5FF03] px-2 py-0.5 rounded-md">
                  {count}
                </span>
          </div>
          
          {config.isClosed ? (
            <div className="flex flex-col">
              <span className="text-lg font-black text-white tracking-tight">{formatCurrency(totalValue)}</span>
              <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">Faturamento Real</span>
            </div>
          ) : (
            <div className="h-[38px] flex items-center">
              <div className="h-1.5 w-12 bg-[#333] rounded-full"></div>
            </div>
          )}
        </div>

        <div className="p-3 space-y-3 overflow-y-auto min-h-[200px]">
          {children}
          {count === 0 && !isOver && (
            <div className="py-12 border-2 border-dashed border-[#333] rounded-md flex flex-col items-center justify-center opacity-40">
              <div className="w-8 h-8 rounded-full bg-[#222] mb-2"></div>
              <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Sem Orçamentos</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

DroppableColumn.displayName = 'DroppableColumn';

interface DateFilterParams {
  dateFilter?: string;
  firstContact?: string;
}

function isDateInRange(lead: Lead, dateFilter: string | undefined): boolean {
  if (!dateFilter) return true;
  if (!lead.firstContact) return false;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const leadDate = new Date(lead.firstContact);

  switch (dateFilter) {
    case 'today':
      return leadDate.toDateString() === today.toDateString();
    case 'week': {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return leadDate >= weekAgo;
    }
    case 'month': {
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return leadDate >= monthAgo;
    }
    default:
      return true;
  }
}

function applyFilters(Orçamentos: Lead[], filters: { stages?: string[]; niches?: string[]; dateFilter?: string }, searchTerm: string): Lead[] {
  const { stages, niches, dateFilter } = filters;
  
  return Orçamentos.filter(lead => {
    if (stages?.length > 0 && !stages.includes(lead.stage)) return false;
    if (niches?.length > 0 && !niches.includes(lead.niche)) return false;
    if (!isDateInRange(lead, dateFilter)) return false;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        lead.name?.toLowerCase().includes(term) ||
        lead.niche?.toLowerCase().includes(term) ||
        lead.email?.toLowerCase().includes(term)
      );
    }
    
    return true;
  });
}

function searchOrçamentos(Orçamentos: Lead[], stage: Stage, searchTerm: string): Lead[] {
  if (!searchTerm) return Orçamentos.filter(l => l.stage === stage);
  
  const term = searchTerm.toLowerCase();
  return Orçamentos.filter(l => 
    l.stage === stage && (
      l.name?.toLowerCase().includes(term) ||
      l.niche?.toLowerCase().includes(term) ||
      l.email?.toLowerCase().includes(term)
    )
  );
}

const CRMPipeline = () => {
  const { Orçamentos, updateLead } = useCRM();
  const { filters, hasActiveFilters } = useFilters();
  const [searchTerm, setSearchTerm] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  const filteredOrçamentos = useMemo(() => {
    return applyFilters(Orçamentos || [], filters, '');
  }, [Orçamentos, filters]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const lead = Orçamentos?.find(l => l.id === active.id);
    setActiveLead(lead ?? null);
  }, [Orçamentos]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveLead(null);
    
    if (!over) return;
    
    const leadId = active.id as string;
    const newStage = over.id as string;
    
    if (!isValidStage(newStage)) {
      console.error('Estágio inválido:', newStage);
      return;
    }
    
    const lead = Orçamentos?.find(l => l.id === leadId);
    if (!lead) return;
    
    if (lead.stage !== newStage) {
      updateLead(leadId, { stage: newStage });
    }
  }, [Orçamentos, updateLead]);

  const columnData = useMemo(() => {
    return STAGES.map(stage => {
      const stageOrçamentos = searchOrçamentos(filteredOrçamentos, stage, searchTerm);
      const totalValue = calculateTotalValue(stageOrçamentos);
      return {
        stage,
        Orçamentos: stageOrçamentos,
        count: stageOrçamentos.length,
        totalValue,
      };
    });
  }, [filteredOrçamentos, searchTerm]);

  return (
    <div className="relative flex flex-col h-full bg-black">
      {isSidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setIsSidebarOpen(false)} />
          <div className="absolute top-14 left-4 w-[280px] bg-[#111] border border-[#333] rounded-xl shadow-xl z-50 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black text-white uppercase tracking-widest">Filtros</span>
              <button onClick={() => setIsSidebarOpen(false)}                 className="p-1 hover:bg-[#222] rounded-md">
                <XCircle size={14} className="text-neutral-400 hover:text-[#B5FF03]" />
              </button>
            </div>
            <p className="text-[10px] text-neutral-500">Aplique filtros na aba Orçamentos para filtrar dados aqui.</p>
          </div>
        </>
      )}

      <div className="mb-4 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-1">Pipeline</h1>
          <p className="text-neutral-400 text-sm">Visualize o progresso das suas oportunidades. Arraste e solte para mover entre etapas.</p>
        </div>
        <div className="relative group">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`p-2 rounded-lg border transition-all relative ${hasActiveFilters ? 'bg-[#B5FF03] text-black border-[#B5FF03]' : 'bg-transparent border-transparent text-neutral-400 hover:text-white hover:bg-[#222]'}`}
          >
            <Filter size={16} strokeWidth={hasActiveFilters ? 2.5 : 1.5} />
            {hasActiveFilters && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
            )}
          </button>
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#111] text-white text-[10px] font-medium rounded opacity-0 md:group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap hidden md:block">
            Filtros
          </span>
        </div>
      </div>

      <DndContext 
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div         className="flex-1 overflow-x-auto pb-6 scrollbar-thin scrollbar-thumb-[#333] scrollbar-track-transparent">
          <div className="flex gap-5 min-w-max h-full items-start">
            {columnData.map(({ stage, Orçamentos: columnOrçamentos, count, totalValue }) => (
              <DroppableColumn 
                key={stage} 
                stage={stage}
                count={count}
                totalValue={totalValue}
              >
                {columnOrçamentos.map(lead => (
                  <DraggableLeadCard 
                    key={lead.id} 
                    lead={lead} 
                    isClosed={STAGE_CONFIG[stage].isClosed}
                  />
                ))}
              </DroppableColumn>
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeLead ? (
            <StaticLeadCard 
              lead={activeLead} 
              isClosed={activeLead.stage === 'Contrato Fechado'} 
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default CRMPipeline;