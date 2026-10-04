export interface OrcamentoItem {
  id: string;
  item: string;
  qtdAtual: number;
  valorUnit: number;
  semPreco?: boolean;
  eventStockId?: string;
}

/**
 * Cliente com contrato emitido.
 *
 * A coleção `leads` é criada exclusivamente na aba Emissão do Contrato: quem
 * apenas tem orçamento vive apenas no calendário (`CalendarEvent`).
 */
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
  /** Evento do calendário que originou o contrato. */
  eventoId?: string;
  /** Dados pessoais do contratante — só existem porque houve contrato. */
  cpf?: string;
  rg?: string;
  clientAddress?: string;
  clientGender?: 'F' | 'M' | '';
}

export interface EventExpense {
  id: string;
  description: string;
  category: 'Transporte' | 'Alimentação' | 'Hospedagem' | 'Material' | 'Equipe' | 'Outros';
  customName?: string;
  valor: number;
  status: 'Pendente' | 'Pago';
  paymentMethod?: 'Pix' | 'Dinheiro' | 'Cartão' | 'Boleto';
  tipo: 'variavel';
  interno: true;
  financeiroId?: string;
  date: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  client?: string;
  clientId?: string;
  eventType?: string;
  date: string;
  dateEnd?: string;
  time?: string;
  local?: string;
  decorator?: string;
  city?: string;
  description?: string;
  equipe?: string;
  /** Dados pessoais do contratante — preenchidos e gravados apenas na aba de emissão do contrato. */
  clientPhone?: string;
  clientCpf?: string;
  clientRg?: string;
  clientAddress?: string;
  clientGender?: 'F' | 'M' | '';
  contractServices?: string[];
  status?: 'orcamento' | 'orcamento_cancelado' | 'evento_confirmado' | 'evento_concluido';
  valorTotal?: number;
  desconto?: number;
  despesasInternas?: EventExpense[];
  items?: OrcamentoItem[];
}
