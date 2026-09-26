import type { Lead, OrcamentoItem } from '../types/crm';
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

interface DateParts {
  day: number;
  month: string;
  year: number;
}

function parseDateParts(dateStr: string): DateParts | null {
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d.getTime())) return null;
  return {
    day: d.getDate(),
    month: d.toLocaleDateString('pt-BR', { month: 'long' }),
    year: d.getFullYear(),
  };
}

export function formatEventDateRange(start?: string, end?: string): string {
  if (!start) return '—';
  const s = parseDateParts(start);
  if (!s) return start;
  const e = end ? parseDateParts(end) : null;

  if (!e || (e.day === s.day && e.month === s.month && e.year === s.year)) {
    return `${s.day} de ${s.month} de ${s.year}`;
  }
  if (e.month === s.month && e.year === s.year) {
    return `${s.day} a ${e.day} de ${s.month} de ${e.year}`;
  }
  if (e.year === s.year) {
    return `${s.day} de ${s.month} a ${e.day} de ${e.month} de ${e.year}`;
  }
  return `${s.day} de ${s.month} de ${s.year} a ${e.day} de ${e.month} de ${e.year}`;
}

export function calculateTotalValue(Orçamentos: Lead[]): number {
  return Orçamentos.reduce((acc, lead) => acc + parseMonetaryValue(lead.value), 0);
}

export function formatNumberBR(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return (0).toFixed(decimals).replace('.', ',');
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

const EXTENSO_UNIDADES = ['', 'Um', 'Dois', 'Três', 'Quatro', 'Cinco', 'Seis', 'Sete', 'Oito', 'Nove'];
const EXTENSO_CENTENAS = ['', 'Cem', 'Duzentos', 'Trezentos', 'Quatrocentos', 'Quinhentos', 'Seiscentos', 'Setecentos', 'Oitocentos', 'Novecentos'];
const EXTENSO_DEZENAS: Record<number, string> = {
  10: 'Dez', 11: 'Onze', 12: 'Doze', 13: 'Treze', 14: 'Quatorze', 15: 'Quinze',
  16: 'Dezesseis', 17: 'Dezessete', 18: 'Dezoito', 19: 'Dezenove',
  20: 'Vinte', 30: 'Trinta', 40: 'Quarenta', 50: 'Cinquenta',
  60: 'Sessenta', 70: 'Setenta', 80: 'Oitenta', 90: 'Noventa',
};

function extensoAte999(n: number): string {
  if (n <= 0) return '';
  const out: string[] = [];
  const c = Math.floor(n / 100);
  const r = n % 100;

  if (c) out.push(c === 1 && r > 0 ? 'Cento' : EXTENSO_CENTENAS[c]);

  if (r >= 10 && r < 20) {
    out.push(EXTENSO_DEZENAS[r]);
  } else if (r > 0) {
    const d = Math.floor(r / 10);
    const u = r % 10;
    if (d) out.push(EXTENSO_DEZENAS[d * 10]);
    if (u) out.push(EXTENSO_UNIDADES[u]);
  }

  return out.join(' e ');
}

function extensoMilhar(n: number): string {
  if (n <= 0) return '';
  const m = Math.floor(n / 1000);
  const r = n % 1000;
  if (!m) return extensoAte999(r);
  const head = m === 1 ? 'Mil' : `${extensoAte999(m)} Mil`;
  if (!r) return head;
  // "e" só quando o resto é centena exata: "dois mil e quatrocentos", mas "mil duzentos e trinta e quatro".
  return r % 100 === 0 ? `${head} e ${extensoAte999(r)}` : `${head} ${extensoAte999(r)}`;
}

export function numberToExtensoBRL(value: number): string {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
  const inteiro = Math.floor(safe);
  const centavos = Math.round((safe - inteiro) * 100);

  if (inteiro === 0 && centavos === 0) return 'Zero Reais';

  let out = '';
  if (inteiro > 0) {
    const m = Math.floor(inteiro / 1_000_000);
    const resto = inteiro % 1_000_000;
    const grupos: string[] = [];
    if (m) grupos.push(m === 1 ? 'Um Milhão' : `${extensoAte999(m)} Milhões`);
    if (resto) {
      const txt = extensoMilhar(resto);
      grupos.push(grupos.length && resto < 100 ? ` e ${txt}` : ` ${txt}`);
    }
    const txt = grupos.join('').trim();
    out = `${txt.charAt(0).toUpperCase()}${txt.slice(1)} ${inteiro === 1 ? 'Real' : 'Reais'}`;
  }

  if (centavos > 0) {
    const cents = `${centavos === 1 ? 'Um' : extensoAte999(centavos)} Centavo${centavos === 1 ? '' : 's'}`;
    out = out ? `${out} e ${cents}` : cents;
  }

  return out;
}

export function formatShortDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
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

const COMPANY_NAME = 'Ventura Luz e Efeitos';
const COMPANY_ADDRESS = 'Rua Coronel Constantino, 224, Ipanema, Águas Belas - PE';
const COMPANY_PHONE = '(87) 9.9618-9979';
const COMPANY_EMAIL = 'producaoleoventura@gmail.com';

// Dados do CONTRATADO (empresa) e condições de pagamento do contrato.
export const CONTRACTOR = {
  name: 'José Leony de Matos Ventura',
  rg: '7.623.964',
  cpf: '074.389.574-62',
  address: 'Rua Coronel Constantino, n.º 224, Centro, Águas Belas (PE)',
  forum: 'Águas Belas (PE)',
  signDateCity: 'Águas Belas (PE)',
  pix: '074.389.574-62',
  bank: 'Banco do Brasil',
  account: 'Conta/Poupança 25573-4',
  agency: 'Agência 1012-x',
  variation: 'Variação 51',
};

const DOC_CSS = `
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
      `;

const CONTRACT_CSS = `
        .contract-title {
          text-align: center;
          font-size: 17px;
          font-weight: 800;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: #1a1a1a;
          margin-bottom: 6px;
        }
        .contract-subtitle {
          text-align: center;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 2px;
          color: #6B8E23;
          margin-bottom: 24px;
        }
        .parties { margin-bottom: 22px; }
        .party { margin-bottom: 10px; }
        .party p {
          font-size: 12.5px;
          line-height: 1.7;
          color: #333;
          text-align: justify;
        }
        .party p strong { color: #1a1a1a; }
        .section {
          margin-top: 22px;
          page-break-inside: avoid;
        }
        .section-title {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: #6B8E23;
          border-bottom: 1px solid #6B8E23;
          padding-bottom: 4px;
          margin-bottom: 10px;
        }
        .clause { margin-bottom: 12px; }
        .clause p {
          font-size: 12.5px;
          line-height: 1.75;
          color: #333;
          text-align: justify;
        }
        .clause p + p { margin-top: 6px; }
        .clause .indent { padding-left: 22px; }
        .clause strong { color: #1a1a1a; }
        .payment-box {
          margin-top: 12px;
          padding: 14px 16px;
          background: #f9f9f9;
          border-left: 3px solid #6B8E23;
          border-radius: 2px;
        }
        .payment-box p {
          font-size: 12.5px;
          line-height: 1.7;
          color: #333;
        }
        .payment-box .pay-title {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          color: #6B8E23;
          margin-bottom: 6px;
        }
        .closing {
          margin-top: 22px;
          font-size: 12.5px;
          line-height: 1.75;
          color: #333;
          text-align: justify;
        }
        .signatures {
          margin-top: 45px;
          page-break-inside: avoid;
        }
        .signatures .sig-row {
          display: flex;
          gap: 40px;
          margin-bottom: 30px;
        }
        .signatures .sig-col {
          flex: 1;
          text-align: center;
        }
        .signatures .sig-line {
          border-top: 1px solid #444;
          padding-top: 6px;
          font-size: 10.5px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #444;
        }
        .signatures .sig-line strong {
          display: block;
          color: #1a1a1a;
          font-size: 12px;
          text-transform: none;
          letter-spacing: 0;
          margin-bottom: 2px;
        }
        .sign-date {
          margin-top: 8px;
          text-align: center;
          font-size: 11.5px;
          color: #333;
        }
      `;

function companyHeaderHtml(docTitle: string, dateLabel: string): string {
  return `
      <div class="company-header">
        <div class="company-info">
          <div class="company-name">${COMPANY_NAME}</div>
          <p class="info-row"><strong>Endereço:</strong> ${COMPANY_ADDRESS}</p>
          <p class="info-row"><strong>Telefone:</strong> ${COMPANY_PHONE}</p>
          <p class="info-row"><strong>E-mail:</strong> ${COMPANY_EMAIL}</p>
        </div>
        <div class="doc-info">
          <div class="doc-title">${docTitle}</div>
          <div class="doc-date">${dateLabel}</div>
        </div>
      </div>`;
}

function itemsTableHtml(items: OrcamentoItem[]): string {
  return `
        <table>
          <thead>
            <tr>
              <th style="width: 58%;">Serviços</th>
              <th style="width: 12%;">Unidade</th>
              <th style="width: 30%;">Valor por unidade</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => item.semPreco && !((item.valorUnit || 0) > 0) ? `
              <tr>
                <td>${escapeHtml(item.item)}</td>
                <td>${item.qtdAtual}</td>
                <td>—</td>
              </tr>
            ` : `
              <tr>
                <td>${escapeHtml(item.item)}</td>
                <td>${item.qtdAtual}</td>
                <td>${formatCurrency(item.valorUnit)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>`;
}

export function generatePDF(lead: Lead, discountData?: { type: 'percent' | 'fixed'; value: number }, grossTotal?: number, dateEnd?: string): void {
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

  const dateStr = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

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
      <style>${DOC_CSS}</style>
    </head>
    <body>
      <div class="watermark">VENTURA</div>

${companyHeaderHtml('Orçamento', `Emitido em ${dateStr}`)}

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
            <p>Data: ${formatEventDateRange(lead.firstContact, dateEnd)}</p>
            ${lead.address ? `<p>Local: ${safeAddress}</p>` : ''}
            <p style="margin-top: 6px;"><span class="badge">${safeStage}</span></p>
          </div>
        </div>

${itemsTableHtml(items)}

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

export interface ContractData {
  clientName: string;
  whatsapp: string;
  email: string;
  cpf: string;
  rg?: string;
  clientAddress?: string;
  clientGender?: 'F' | 'M';
  eventType: string;
  date: string;
  dateEnd?: string;
  time?: string;
  city: string;
  venue?: string;
  notes: string;
  items: OrcamentoItem[];
  grossTotal: number;
  discount: number;
  services?: string[];
}

/** Serviço principal da empresa, usado quando nenhum foi selecionado. */
export const DEFAULT_CONTRACT_SERVICES = ['Iluminação Cênica'];

/**
 * Monta o trecho "serviços de X, de Y e de Z" da Cláusula 1ª.
 * Iluminação cênica é a única que carrega a contagem de pontos de luz.
 */
export function buildServicesTerm(services: string[] | undefined, pontosLuz: number): string {
  const selected = (services || []).map(s => s.trim()).filter(Boolean);
  const names = selected.length > 0 ? selected : DEFAULT_CONTRACT_SERVICES;

  const isLighting = (name: string) => /^ilumina[cç][aã]o/i.test(name.trim());
  const phrases = names.map(name => {
    const lower = name.trim().toLowerCase();
    return isLighting(name) ? `${lower} para cerimônia e recepção com uma média de ${pontosLuz} pontos de luzes` : lower;
  });

  // "serviços de A" / "serviços de A e de B" / "serviços de A, de B e de C"
  const [first, ...rest] = phrases;
  const tail = rest.length === 1
    ? ` e de ${rest[0]}`
    : rest.length > 1
      ? `, de ${rest.slice(0, -1).join(', de ')} e de ${rest[rest.length - 1]}`
      : '';

  return `serviços de ${first}${tail}`;
}

/** Lista os serviços para legendas e descrições, no formato "X • Y". */
export function formatServicesList(services: string[] | undefined): string[] {
  const selected = (services || []).map(s => s.trim()).filter(Boolean);
  return selected.length > 0 ? selected : DEFAULT_CONTRACT_SERVICES;
}

export function generateContractPDF(data: ContractData): void {
  const win = window.open('', '_blank');
  if (!win) return;

  const items = data.items || [];
  const total = data.grossTotal && data.grossTotal > 0
    ? data.grossTotal
    : items.reduce((sum, item) => sum + ((item.valorUnit || 0) > 0 ? item.qtdAtual * item.valorUnit : 0), 0);
  const discountAmount = data.discount > 0 ? data.discount : 0;
  const finalTotal = Math.max(0, total - discountAmount);

  const dateStr = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const eventType = eventTypeLabel(data.eventType);
  const pontosLuz = items.reduce((sum, item) => sum + (item.qtdAtual || 0), 0);
  const eventoData = data.dateEnd
    ? `${formatShortDate(data.date)} a ${formatShortDate(data.dateEnd)}`
    : formatShortDate(data.date);
  const metade = finalTotal / 2;
  const servicesTerm = escapeHtml(buildServicesTerm(data.services, pontosLuz));
  const servicesSubtitle = formatServicesList(data.services).map(escapeHtml).join(' • ');
  const servicesParenthetical = escapeHtml(formatServicesList(data.services).join(', ').toLowerCase());

  const safeName = escapeHtml(data.clientName || 'Contratante');
  const safeCpf = escapeHtml(data.cpf);
  const safeRg = escapeHtml(data.rg || '');
  const safeCity = escapeHtml(data.city);
  const safeVenue = escapeHtml(data.venue || '');
  const safeClientAddress = escapeHtml(data.clientAddress || '');
  const safeEventType = escapeHtml(eventType);
  const safeNotas = escapeHtml(data.notes);

  // Concordância de gênero com o contratante.
  const genero = data.clientGender === 'F'
    ? { nacional: 'brasileira', portador: 'portadora', domiciliado: 'domiciliada' }
    : data.clientGender === 'M'
      ? { nacional: 'brasileiro', portador: 'portador', domiciliado: 'domiciliado' }
      : { nacional: 'brasileiro(a)', portador: 'portador(a)', domiciliado: 'domiciliado(a)' };

  const cpfTermo = safeCpf ? `, ${genero.portador} do CPF sob o n.º ${safeCpf}` : '';
  const rgTermo = safeRg ? `${safeCpf ? '' : `, ${genero.portador} do`}${safeCpf ? '' : ' '}${!safeCpf ? '' : ''} RG sob o n.º ${safeRg}` : ''; // keep minimal
  const identidadeTermo = cpfTermo || rgTermo
    ? `${cpfTermo}${safeRg && safeCpf ? ' e portador(a) do RG sob o n.º ' + safeRg : (safeRg && !safeCpf ? ', ' + genero.portador + ' do RG sob o n.º ' + safeRg : '')}`
    : '';
  const domicilioTermo = safeClientAddress
    ? `, residente e ${genero.domiciliado} na ${safeClientAddress}${safeCity ? `, ${safeCity}` : ''}`
    : safeCity
      ? `, residente e ${genero.domiciliado} na cidade de ${safeCity}`
      : '';
  const localTermo = safeVenue
    ? `em <strong>${safeVenue}</strong>${safeCity ? `, ${safeCity}` : ''}`
    : safeCity
      ? `na cidade de <strong>${safeCity}</strong>`
      : 'em local a ser informado';

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Contrato - ${safeName}</title>
      <style>${DOC_CSS}${CONTRACT_CSS}</style>
    </head>
    <body>
      <div class="watermark">VENTURA</div>

${companyHeaderHtml('Contrato', `Emitido em ${dateStr}`)}

      <div class="content">
        <div class="contract-title">Contrato de Prestação de Serviços</div>
        <div class="contract-subtitle">${servicesSubtitle}</div>

        <div class="parties">
          <div class="party">
            <p><strong>CONTRATANTE:</strong> ${safeName}, ${genero.nacional}${identidadeTermo}${domicilioTermo}.</p>
          </div>
          <div class="party">
            <p><strong>CONTRATADO:</strong> ${CONTRACTOR.name}, brasileiro, portador do RG sob o n.º ${CONTRACTOR.rg}, e CPF sob o n.º ${CONTRACTOR.cpf}, residente e domiciliado na ${CONTRACTOR.address}.</p>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Do Objeto do Contrato</div>
          <div class="clause">
            <p>Cláusula 1ª. O presente contrato tem como OBJETO a realização, do evento pela Ventura Luz &amp; Efeitos, neste ato denominado simplesmente CONTRATADO, ${servicesTerm}. O evento será realizado ${localTermo}, no dia <strong>(${eventoData})</strong>.</p>
            <p class="indent">Tipo de evento: <strong>${safeEventType}</strong>${data.time ? ` — horário: <strong>${escapeHtml(data.time)}</strong>` : ''}.</p>
            ${itemsTableHtml(items)}
            ${safeNotas ? `<p class="indent"><strong>Observações:</strong> ${safeNotas}</p>` : ''}
          </div>
        </div>

        <div class="section">
          <div class="section-title">Das Obrigações</div>
          <div class="clause">
            <p>Cláusula 2ª. O CONTRATADO se responsabiliza por sua presença no dia e local do evento, para fazer montagem dos serviços contratados no ato desse contrato, salvo as situações de caso fortuito ou força maior, que impeçam de comparecer no evento.</p>
            <p>Parágrafo Primeiro. O CONTRATADO se responsabiliza pela montagem e operação dos serviços contratados (${servicesParenthetical}) para a realização da mesma.</p>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Das Perdas e Danos</div>
          <div class="clause">
            <p>Cláusula 3ª. Caso não haja cumprimento de qualquer das cláusulas do presente instrumento, a parte que der causa se responsabilizará por perdas e danos que causar à outra.</p>
            <p>Cláusula 4ª. Fica estipulada a indenização de 50% do valor deste contrato, a qualquer das partes pelo não cumprimento dos compromissos acima referenciados, exceto se for por motivo de força maior, ocorrer impossibilidades, tais como: calamidade pública, convulsão social, acidentes de viagem ou transporte.</p>
            <p>Parágrafo Único. O CONTRATANTE se obriga a dar garantia ao material, responsabilizando-se por qualquer dano causado por desafachas com convidados durante a execução do evento.</p>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Da Remuneração</div>
          <div class="clause">
            <p>Cláusula 5ª. Pelos serviços contratados pactuados neste instrumento, o CONTRATANTE se compromete a pagar a quantia de <strong>R$ (${formatNumberBR(finalTotal)})</strong> (${numberToExtensoBRL(finalTotal)}). Com a seguinte forma de pagamento: <strong>50%</strong> (R$ (${formatNumberBR(metade)})) no ato do contrato e o restante (R$ (${formatNumberBR(finalTotal - metade)})) até o dia da realização do evento.</p>
            <div class="payment-box">
              <div class="pay-title">Conta para depósito</div>
              <p>${CONTRACTOR.bank}<br>${CONTRACTOR.account}<br>${CONTRACTOR.agency}<br>${CONTRACTOR.variation}<br>${CONTRACTOR.name}</p>
              <p>PIX: <strong>${CONTRACTOR.pix}</strong></p>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Do Foro</div>
          <div class="clause">
            <p>Cláusula 6ª. Para dirimir quaisquer controvérsias oriundas do CONTRATO, as partes elegem o foro da comarca de ${CONTRACTOR.forum}.</p>
          </div>
        </div>

        <p class="closing">Por estarem assim justas e contratadas, firmam o presente instrumento, em duas vias de igual teor, juntamente com 2 (duas) testemunhas.</p>

        <div class="signatures">
          <div class="sig-row">
            <div class="sig-col">
              <div class="sig-line">
                <strong>${safeName}</strong>
                Contratante
              </div>
            </div>
            <div class="sig-col">
              <div class="sig-line">
                <strong>${CONTRACTOR.name}</strong>
                Contratado
              </div>
            </div>
          </div>
          <div class="sig-row">
            <div class="sig-col">
              <div class="sig-line">
                <strong>Testemunha 1</strong>
                CPF: ______________________
              </div>
            </div>
            <div class="sig-col">
              <div class="sig-line">
                <strong>Testemunha 2</strong>
                CPF: ______________________
              </div>
            </div>
          </div>
        </div>

        <div class="sign-date">${CONTRACTOR.signDateCity}, ____ de _________________ de ____________.</div>
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

