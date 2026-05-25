import type { Lead, OrcamentoItem } from '../contexts/CRMContext';

export const STAGES = [
  'Novos Orçamentos',
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
  'Novos Orçamentos': { id: 'Novos Orçamentos', label: 'Novos Orçamentos', isClosed: false },
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

export function calculateTotalValue(Orçamentos: Lead[]): number {
  return Orçamentos.reduce((acc, lead) => acc + parseMonetaryValue(lead.value), 0);
}

export function isValidStage(stage: string): stage is Stage {
  return STAGES.includes(stage as Stage);
}

export function getStageOrçamentos(Orçamentos: Lead[], stage: Stage): Lead[] {
  return Orçamentos.filter(lead => lead.stage === stage);
}

export function groupOrçamentosByStage(Orçamentos: Lead[]): Record<Stage, Lead[]> {
  const grouped: Record<Stage, Lead[]> = {
    'Novos Orçamentos': [],
    'Primeiro Contato': [],
    'Contato Ativo': [],
    'Reunião Agendada': [],
    'Follow Up': [],
    'Proposta Enviada': [],
    'Contrato Fechado': [],
    'Perdido': [],
  };
  
  for (const lead of Orçamentos) {
    if (isValidStage(lead.stage)) {
      grouped[lead.stage].push(lead);
    }
  }
  
  return grouped;
}

export function generatePDF(lead: Lead, discountData?: { type: 'percent' | 'fixed'; value: number }): void {
  const win = window.open('', '_blank');
  if (!win) return;

  const items = lead.items || [];
  let total = items.reduce((sum, item) => sum + item.quantidade * item.valorUnitario, 0);
  let discountText = '';
  let finalTotal = total;

  if (discountData && discountData.value > 0) {
    if (discountData.type === 'percent') {
      const discountAmount = total * (discountData.value / 100);
      finalTotal = total - discountAmount;
      discountText = `Desconto: ${discountData.value}% (-${formatCurrency(discountAmount)})`;
    } else {
      finalTotal = total - discountData.value;
      discountText = `Desconto: -${formatCurrency(discountData.value)}`;
    }
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR');

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Orçamento - ${lead.name}</title>
      <style>
        @page { margin: 20mm 15mm; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #222; margin: 0; padding: 30px; }
        .header { text-align: center; border-bottom: 3px solid #B5FF03; padding-bottom: 20px; margin-bottom: 25px; }
        .header h1 { margin: 0; font-size: 24px; color: #000; letter-spacing: 2px; text-transform: uppercase; }
        .header p { margin: 5px 0 0; color: #666; font-size: 12px; }
        .info-grid { display: flex; justify-content: space-between; margin-bottom: 25px; }
        .info-box { flex: 1; }
        .info-box h3 { font-size: 10px; text-transform: uppercase; color: #B5FF03; letter-spacing: 1px; margin: 0 0 5px; }
        .info-box p { margin: 2px 0; font-size: 13px; color: #333; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        thead th { background: #000; color: #B5FF03; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
        tbody td { padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
        tbody tr:hover { background: #f9f9f9; }
        .total-row { font-weight: bold; }
        .total-row td { border-top: 2px solid #000; padding-top: 12px; }
        .discount-row td { color: #e53935; }
        .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 15px; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: bold; }
        .badge-pending { background: #fff3e0; color: #e65100; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Orçamento</h1>
        <p>Ventura Luz e Efeitos • Emitido em ${dateStr}</p>
      </div>
      <div class="info-grid">
        <div class="info-box">
          <h3>Cliente</h3>
          <p><strong>${lead.name}</strong></p>
          ${lead.whatsapp ? `<p>WhatsApp: ${lead.whatsapp}</p>` : ''}
          ${lead.email ? `<p>Email: ${lead.email}</p>` : ''}
        </div>
        <div class="info-box" style="text-align: right;">
          <h3>Evento</h3>
          <p><strong>${lead.niche || '—'}</strong></p>
          <p>Data: ${lead.firstContact ? new Date(lead.firstContact).toLocaleDateString('pt-BR') : '—'}</p>
          <p>Status: <span class="badge badge-pending">${lead.stage}</span></p>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width: 50%;">Item</th>
            <th style="width: 15%; text-align: center;">Qtd</th>
            <th style="width: 20%; text-align: right;">Valor Unit.</th>
            <th style="width: 15%; text-align: right;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td>${item.descricao}</td>
              <td style="text-align: center;">${item.quantidade}</td>
              <td style="text-align: right;">${formatCurrency(item.valorUnitario)}</td>
              <td style="text-align: right;">${formatCurrency(item.quantidade * item.valorUnitario)}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="3" style="text-align: right;">Total Bruto</td>
            <td style="text-align: right;">${formatCurrency(total)}</td>
          </tr>
          ${discountText ? `
          <tr class="discount-row">
            <td colspan="3" style="text-align: right;">${discountText}</td>
            <td style="text-align: right;">${formatCurrency(finalTotal)}</td>
          </tr>` : ''}
          <tr>
            <td colspan="3" style="text-align: right; font-size: 16px; font-weight: black;">VALOR FINAL</td>
            <td style="text-align: right; font-size: 16px; font-weight: black;">${formatCurrency(finalTotal)}</td>
          </tr>
        </tbody>
      </table>
      ${lead.notes ? `<div style="margin-top: 20px; padding: 12px; background: #f5f5f5; border-radius: 8px;"><strong style="font-size: 10px; text-transform: uppercase; color: #666;">Observações:</strong><p style="font-size: 13px; margin: 5px 0 0;">${lead.notes}</p></div>` : ''}
      <div class="footer">
        <p>Ventura Luz e Efeitos • Documento gerado automaticamente pelo sistema.</p>
      </div>
    </body>
    </html>
  `);
  win.document.close();
  win.print();
}