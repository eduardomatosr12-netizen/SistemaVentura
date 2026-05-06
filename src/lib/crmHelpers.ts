export const STAGES = [
  'Novos Leads',
  'Primeiro Contato',
  'Contato Ativo',
  'Reunião Agendada',
  'Follow Up',
  'Proposta Enviada',
  'Contrato Fechado',
  'Perdido'
] as const;

export type Stage = typeof STAGES[number];

export interface StageConfig {
  id: Stage;
  label: string;
  isClosed: boolean;
}

export const STAGE_CONFIG: Record<Stage, StageConfig> = {
  'Novos Leads': { id: 'Novos Leads', label: 'Novos Leads', isClosed: false },
  'Primeiro Contato': { id: 'Primeiro Contato', label: 'Primeiro Contato', isClosed: false },
  'Contato Ativo': { id: 'Contato Ativo', label: 'Contato Ativo', isClosed: false },
  'Reunião Agendada': { id: 'Reunião Agendada', label: 'Reunião Agendada', isClosed: false },
  'Follow Up': { id: 'Follow Up', label: 'Follow Up', isClosed: false },
  'Proposta Enviada': { id: 'Proposta Enviada', label: 'Proposta Enviada', isClosed: false },
  'Contrato Fechado': { id: 'Contrato Fechado', label: 'Contrato Fechado', isClosed: true },
  'Perdido': { id: 'Perdido', label: 'Perdido', isClosed: false },
};

export interface DroppableColumnProps {
  stage: Stage;
  children: React.ReactNode;
  count: number;
  totalValue: number;
}

export interface DraggableLeadCardProps {
  lead: Lead;
}

export interface StaticLeadCardProps {
  lead: Lead;
}

export interface LeadCardSharedProps {
  lead: Lead;
  isClosed: boolean;
}

export function parseMonetaryValue(value: string): number {
  if (!value || typeof value !== 'string') return 0;
  
  const cleanValue = value
    .replace(/R\$\s*/gi, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();
  
  const parsed = parseFloat(cleanValue);
  return isNaN(parsed) ? 0 : parsed;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);
}

export function calculateTotalValue(leads: Lead[]): number {
  return leads.reduce((acc, lead) => acc + parseMonetaryValue(lead.value), 0);
}

export function isValidStage(stage: string): stage is Stage {
  return STAGES.includes(stage as Stage);
}

export function getStageLeads(leads: Lead[], stage: Stage): Lead[] {
  return leads.filter(lead => lead.stage === stage);
}

export function groupLeadsByStage(leads: Lead[]): Record<Stage, Lead[]> {
  const grouped: Record<Stage, Lead[]> = {
    'Novos Leads': [],
    'Primeiro Contato': [],
    'Contato Ativo': [],
    'Reunião Agendada': [],
    'Follow Up': [],
    'Proposta Enviada': [],
    'Contrato Fechado': [],
    'Perdido': [],
  };
  
  for (const lead of leads) {
    if (isValidStage(lead.stage)) {
      grouped[lead.stage].push(lead);
    }
  }
  
  return grouped;
}