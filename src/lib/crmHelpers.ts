import type { Lead } from '../types/crm';
import { generateWhatsAppLink } from './whatsapp';
import { eventTypeLabel } from './eventTypeLabel';

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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
  'Perdido': { id: 'Perdido', label: 'Perdido', isClosed: true },
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
  if (!Number.isFinite(value)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
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

export function generatePDF(lead: Lead, discountData?: { type: 'percent' | 'fixed'; value: number }, grossTotal?: number): void {
  const win = window.open('', '_blank');
  if (!win) return;

  const items = lead.items || [];
  const total = grossTotal && grossTotal > 0
    ? grossTotal
    : items.reduce((sum, item) => sum + ((item.valorUnit || 0) > 0 ? item.qtdAtual * item.valorUnit : 0), 0);
  let discountAmount = 0;
  let discountLabel = '';
  let finalTotal = total;

  if (discountData && discountData.value > 0) {
    if (discountData.type === 'percent') {
      discountAmount = total * (discountData.value / 100);
      finalTotal = total - discountAmount;
      discountLabel = `${discountData.value}%`;
    } else {
      discountAmount = discountData.value;
      finalTotal = total - discountAmount;
      discountLabel = `${formatCurrency(discountAmount)}`;
    }
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR');

  const safeName = escapeHtml(lead.name);
  const safeWhatsapp = escapeHtml(lead.whatsapp);
  const safeEmail = escapeHtml(lead.email);
  const safeInstagram = escapeHtml(lead.instagram);
  const safeAddress = escapeHtml(lead.address);
  const safeNotes = escapeHtml(lead.notes);
  const safeStage = escapeHtml(lead.stage);

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Orçamento - ${safeName}</title>
      <style>
        @page { margin: 15mm 12mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', Arial, sans-serif;
          color: #222;
          position: relative;
          min-height: 100vh;
          padding: 0;
        }
        .watermark {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-25deg);
          font-size: 120px;
          font-weight: 900;
          color: #000;
          opacity: 0.04;
          letter-spacing: 12px;
          text-transform: uppercase;
          pointer-events: none;
          z-index: -1;
          white-space: nowrap;
          font-family: 'Segoe UI', Arial, sans-serif;
        }
        .company-header {
          background: #2d2d2d;
          color: #fff;
          padding: 22px 35px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .company-header .company-info {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .company-header .company-info .company-name {
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 2px;
          text-transform: uppercase;
          margin: 0 0 4px 0;
        }
        .company-header .company-info .info-row {
          font-size: 11px;
          color: #ccc;
          margin: 0;
          line-height: 1.5;
        }
        .company-header .company-info .info-row strong {
          color: #fff;
          font-weight: 600;
        }
        .company-header .doc-info {
          text-align: right;
          white-space: nowrap;
        }
        .company-header .doc-info .doc-title {
          font-size: 22px;
          font-weight: 700;
          letter-spacing: 4px;
          text-transform: uppercase;
          color: #fff;
        }
        .company-header .doc-info .doc-date {
          font-size: 11px;
          color: #aaa;
          margin-top: 2px;
        }
        .content {
          padding: 30px 35px;
        }
        .client-section {
          display: flex;
          justify-content: space-between;
          margin-bottom: 28px;
          padding-bottom: 20px;
          border-bottom: 1px solid #e0e0e0;
        }
        .client-section .col h3 {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: #6B8E23;
          margin-bottom: 8px;
        }
        .client-section .col p {
          font-size: 13px;
          color: #333;
          line-height: 1.6;
          margin: 0;
        }
        .client-section .col p strong {
          font-size: 15px;
          color: #1a1a1a;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 0 0 5px 0;
        }
        thead th {
          background: #6B8E23;
          color: #fff;
          padding: 11px 14px;
          text-align: left;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          font-weight: 600;
        }
        thead th:last-child { text-align: right; }
        thead th:nth-child(2) { text-align: center; }
        thead th:nth-child(3) { text-align: right; }
        tbody td {
          padding: 12px 14px;
          border-bottom: 1px solid #e8e8e8;
          font-size: 13px;
          color: #333;
          vertical-align: top;
        }
        tbody td:last-child { text-align: right; font-weight: 600; }
        tbody td:nth-child(2) { text-align: center; }
        tbody td:nth-child(3) { text-align: right; }
        tbody tr:last-child td { border-bottom: none; }
        .table-spacer td {
          padding: 6px 14px;
          border-bottom: none;
        }
        .summary-section {
          margin-top: 25px;
          border-top: 2px solid #6B8E23;
          padding-top: 15px;
        }
        .summary-row {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          padding: 6px 0;
          font-size: 13px;
        }
        .summary-row .label {
          color: #555;
          width: 260px;
          text-align: right;
          padding-right: 20px;
        }
        .summary-row .value {
          font-weight: 600;
          width: 160px;
          text-align: right;
        }
        .summary-row.total {
          font-size: 15px;
          font-weight: 700;
          color: #1a1a1a;
        }
        .summary-row.discount .label,
        .summary-row.discount .value {
          color: #c62828;
        }
        .final-block {
          margin-top: 20px;
          background: #2E7D32;
          color: #fff;
          padding: 16px 24px;
          display: flex;
          justify-content: flex-end;
          align-items: center;
          border-radius: 4px;
        }
        .final-block .final-label {
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin-right: 30px;
        }
        .final-block .final-value {
          font-size: 22px;
          font-weight: 800;
          letter-spacing: 1px;
        }
        .notes-section {
          margin-top: 25px;
          padding: 14px 16px;
          background: #f9f9f9;
          border-left: 3px solid #6B8E23;
          border-radius: 2px;
        }
        .notes-section h4 {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #6B8E23;
          margin-bottom: 6px;
        }
        .notes-section p {
          font-size: 13px;
          color: #444;
          line-height: 1.5;
        }
        .page-footer {
          margin-top: 40px;
          text-align: center;
          font-size: 10px;
          color: #999;
          border-top: 1px solid #e0e0e0;
          padding-top: 14px;
        }
        .badge {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 600;
          background: #f1f8e9;
          color: #558B2F;
        }
      </style>
    </head>
    <body>
      <div class="watermark">VENTURA</div>

      <div class="company-header">
        <div class="company-info">
          <div class="company-name">Ventura Luz e Efeitos</div>
          <p class="info-row"><strong>Endereço:</strong> Rua Coronel Constantino, 224, Ipanema, Águas Belas - PE</p>
          <p class="info-row"><strong>Telefone:</strong> (87) 9.9618-9979</p>
          <p class="info-row"><strong>E-mail:</strong> producaoleoventura@gmail.com</p>
        </div>
        <div class="doc-info">
          <div class="doc-title">Orçamento</div>
          <div class="doc-date">Emitido em ${dateStr}</div>
        </div>
      </div>

      <div class="content">
        <div class="client-section">
          <div class="col">
            <h3>Cliente</h3>
            <p><strong>${safeName}</strong></p>
            ${lead.whatsapp ? `<p>WhatsApp: <a href="${generateWhatsAppLink(lead.whatsapp)}" target="_blank" style="color: #25D366; text-decoration: underline;">${safeWhatsapp}</a></p>` : ''}
            ${lead.email ? `<p>Email: ${safeEmail}</p>` : ''}
            ${lead.instagram ? `<p>Instagram: ${safeInstagram}</p>` : ''}
          </div>
          <div class="col" style="text-align: right;">
            <h3>Evento</h3>
            <p><strong>${eventTypeLabel(lead.niche)}</strong></p>
            <p>Data: ${lead.firstContact ? new Date(lead.firstContact).toLocaleDateString('pt-BR') : '—'}</p>
            ${lead.address ? `<p>Local: ${safeAddress}</p>` : ''}
            <p style="margin-top: 6px;"><span class="badge">${safeStage}</span></p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 48%;">Serviços</th>
              <th style="width: 12%;">Unidade</th>
              <th style="width: 20%;">Valor por unidade</th>
              <th style="width: 20%;">Custo</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, i) => item.semPreco && !((item.valorUnit || 0) > 0) ? `
              <tr${i === 0 ? '' : ''}>
                <td>${escapeHtml(item.item)}</td>
                <td>${item.qtdAtual}</td>
                <td>—</td>
                <td>—</td>
              </tr>
            ` : `
              <tr${i === 0 ? '' : ''}>
                <td>${escapeHtml(item.item)}</td>
                <td>${item.qtdAtual}</td>
                <td>${formatCurrency(item.valorUnit)}</td>
                <td>${formatCurrency(item.qtdAtual * item.valorUnit)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="summary-section">
          <div class="summary-row">
            <span class="label">Valor Bruto</span>
            <span class="value">${formatCurrency(total)}</span>
          </div>
          ${discountData && discountData.value > 0 ? `
          <div class="summary-row discount">
            <span class="label">Desconto (${discountLabel})</span>
            <span class="value">- ${formatCurrency(discountAmount)}</span>
          </div>` : ''}
        </div>

        <div class="final-block">
          <span class="final-label">Valor Total${discountData && discountData.value > 0 ? ' com desconto' : ''}</span>
          <span class="final-value">${formatCurrency(finalTotal)}</span>
        </div>

        ${lead.notes ? `
        <div class="notes-section">
          <h4>Observações</h4>
          <p>${safeNotes}</p>
        </div>` : ''}
      </div>

      <div class="page-footer">
        <p>Ventura Luz e Efeitos • Iluminação Profissional • Documento gerado automaticamente pelo sistema.</p>
      </div>
    </body>
    </html>
  `);
  win.document.close();
  win.print();
}