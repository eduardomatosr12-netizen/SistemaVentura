export interface OrcamentoItem {
  id: string;
  item: string;
  qtdAtual: number;
  valorUnit: number;
  semPreco?: boolean;
  eventStockId?: string;
}

export interface Lead {
  id: string;
  name: string;
  niche: string;
  whatsapp: string;
  email: string;
  instagram: string;
  stage: string;
  origin?: string;
  firstContact: string;
  closingDate: string;
  followUpReminder: string;
  address: string;
  notes: string;
  value: string;
  items?: OrcamentoItem[];
  lastModifiedBy?: string;
}

export interface EventExpense {
  id: string;
  description: string;
  category: 'Transporte' | 'Alimentação' | 'Hospedagem' | 'Material' | 'Equipe' | 'Outros';
  valor: number;
  status: 'Pendente' | 'Pago';
  paymentMethod?: 'Pix' | 'Dinheiro' | 'Cartão' | 'Boleto';
  tipo: 'variavel';
  interno: true;
  financeiroId?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  client?: string;
  clientId?: string;
  eventType?: string;
  date: string;
  time?: string;
  local?: string;
  decorator?: string;
  city?: string;
  description?: string;
  equipe?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientCpf?: string;
  status?: 'orcamento' | 'orcamento_cancelado' | 'evento_confirmado' | 'evento_concluido';
  dataMontagem?: string;
  dataDesmontagem?: string;
  valorTotal?: number;
  desconto?: number;
  despesasInternas?: EventExpense[];
  items?: OrcamentoItem[];
}
