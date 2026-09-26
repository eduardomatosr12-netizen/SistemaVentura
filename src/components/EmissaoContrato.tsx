import { useMemo } from 'react';
import { FileText, MessageCircle, Lock, AlertCircle, User, CalendarDays, Package, CreditCard, PenLine } from 'lucide-react';
import {
  generateContractPDF, formatNumberBR, numberToExtensoBRL, formatShortDate, CONTRACTOR,
  type ContractData,
} from '../lib/crmHelpers';
import { eventTypeLabel } from '../lib/eventTypeLabel';
import { generateWhatsAppLink } from '../lib/whatsapp';

interface Props {
  eventId: string | null;
  data: ContractData;
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-start justify-between gap-3 py-1.5 border-b border-[#242424] last:border-b-0">
    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 shrink-0">{label}</span>
    <span className="text-xs text-white text-right break-words">{value}</span>
  </div>
);

const Block = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <section className="border-t border-[#2d2d2d] pt-3">
    <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-2 flex items-center gap-1.5">{icon}{title}</p>
    {children}
  </section>
);

export default function EmissaoContrato({ eventId, data }: Props) {
  const items = data.items || [];

  const total = data.grossTotal && data.grossTotal > 0
    ? data.grossTotal
    : items.reduce((sum, item) => sum + ((item.valorUnit || 0) > 0 ? item.qtdAtual * item.valorUnit : 0), 0);
  const finalTotal = Math.max(0, total - (data.discount > 0 ? data.discount : 0));
  const metade = finalTotal / 2;
  const pontosLuz = items.reduce((sum, item) => sum + (item.qtdAtual || 0), 0);

  const eventoData = data.dateEnd
    ? `${formatShortDate(data.date)} a ${formatShortDate(data.dateEnd)}`
    : formatShortDate(data.date);

  const pendencias = useMemo(() => {
    const list: string[] = [];
    if (!data.clientName) list.push('Nome do contratante');
    if (!data.cpf && !data.rg) list.push('CPF ou RG do contratante');
    if (!data.clientAddress) list.push('Endereço do contratante');
    if (!data.clientGender) list.push('Sexo do contratante');
    if (!data.eventType) list.push('Tipo de evento');
    if (!data.date) list.push('Data do evento');
    if (!data.city && !data.venue) list.push('Cidade ou local do evento');
    if (items.length === 0) list.push('Itens do orçamento');
    if (finalTotal <= 0) list.push('Valor do evento');
    return list;
  }, [data, items.length, finalTotal]);

  if (!eventId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-neutral-500">
        <Lock size={32} className="mb-3 text-neutral-600" />
        <p className="text-sm font-medium">Crie ou salve o evento primeiro</p>
        <p className="text-[10px] mt-1">A emissão do contrato usa os dados já preenchidos do evento</p>
      </div>
    );
  }

  const handleGeneratePDF = () => generateContractPDF(data);

  const handleSendWhatsApp = () => {
    if (!data.whatsapp) return;
    const msg = `Olá ${data.clientName || ''}! Segue o seu contrato em PDF.\n\nData do evento: ${eventoData}\n\nValor: R$ ${formatNumberBR(finalTotal)}`;
    window.open(generateWhatsAppLink(data.whatsapp, msg), '_blank');
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-4 text-center">
        <p className="text-[9px] font-black uppercase tracking-widest text-[#CDFF00]">Contrato de Prestação de Serviços</p>
        <p className="text-lg font-black text-white tracking-tight leading-tight">Iluminação Cênica</p>
        <p className="text-[10px] text-neutral-500 mt-1">
          Emitido em {new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
        </p>
      </div>

      {pendencias.length > 0 && (
        <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5 mb-1.5">
            <AlertCircle size={12} /> Campos pendentes
          </p>
          <p className="text-[11px] text-amber-200/80 leading-relaxed">
            O PDF será emitido com estas informações vazias: {pendencias.join(', ')}.
          </p>
        </div>
      )}

      <Block icon={<User size={12} />} title="Partes">
        <Row label="Contratante" value={data.clientName || '—'} />
        <Row label="CPF" value={data.cpf || '—'} />
        <Row label="RG" value={data.rg || '—'} />
        <Row label="Endereço" value={data.clientAddress || '—'} />
        <Row label="Sexo" value={data.clientGender === 'F' ? 'Feminino' : data.clientGender === 'M' ? 'Masculino' : '—'} />
        <Row label="Cidade" value={data.city || '—'} />
        <Row label="Contratado" value={CONTRACTOR.name} />
        <Row label="CPF / RG" value={`${CONTRACTOR.cpf} / ${CONTRACTOR.rg}`} />
      </Block>

      <Block icon={<CalendarDays size={12} />} title="Do Objeto do Contrato">
        <Row label="Tipo de evento" value={data.eventType ? eventTypeLabel(data.eventType) : '—'} />
        <Row label="Data" value={eventoData} />
        <Row label="Horário" value={data.time || '—'} />
        <Row label="Local" value={data.venue || '—'} />
        <Row label="Cidade" value={data.city || '—'} />
        <Row label="Pontos de luz" value={String(pontosLuz)} />
        {data.notes && <Row label="Observações" value={data.notes} />}
      </Block>

      <Block icon={<Package size={12} />} title="Itens Contratados">
        {items.length === 0 ? (
          <p className="text-[11px] text-neutral-500 italic py-1">Nenhum item adicionado ao orçamento.</p>
        ) : (
          <div className="space-y-1">
            {items.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-[#242424] last:border-b-0">
                <span className="text-xs text-white truncate">{item.item}</span>
                <span className="text-[10px] text-neutral-400 shrink-0">
                  {item.qtdAtual} x R$ {formatNumberBR(item.valorUnit || 0)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Block>

      <Block icon={<CreditCard size={12} />} title="Da Remuneração">
        <div className="flex items-center justify-between py-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Valor total</span>
          <span className="text-sm font-black text-white">R$ {formatNumberBR(finalTotal)}</span>
        </div>
        <p className="text-[10px] text-neutral-500 italic pb-1.5">({numberToExtensoBRL(finalTotal)})</p>
        <div className="flex items-center justify-between py-1.5 border-t border-[#242424]">
          <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">50% no ato</span>
          <span className="text-xs text-white">R$ {formatNumberBR(metade)}</span>
        </div>
        <div className="flex items-center justify-between py-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">50% até o evento</span>
          <span className="text-xs text-white">R$ {formatNumberBR(finalTotal - metade)}</span>
        </div>
        <div className="mt-2 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-3 space-y-0.5">
          <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Conta para depósito</p>
          <p className="text-[11px] text-white leading-relaxed">
            {CONTRACTOR.bank}<br />
            {CONTRACTOR.account}<br />
            {CONTRACTOR.agency}<br />
            {CONTRACTOR.variation}
          </p>
          <p className="text-[11px] text-white pt-1">PIX: <strong>{CONTRACTOR.pix}</strong></p>
        </div>
      </Block>

      <Block icon={<PenLine size={12} />} title="Signatários">
        <Row label="Contratante" value={data.clientName || '—'} />
        <Row label="Contratado" value={CONTRACTOR.name} />
        <Row label="Testemunhas" value="2 (duas) — CPF preenchido na assinatura" />
        <Row label="Local e data" value={`${CONTRACTOR.signDateCity}, ____ de _________________ de ____________.`} />
      </Block>

      <div className="flex flex-col gap-2 pt-1">
        <button
          type="button"
          onClick={handleGeneratePDF}
          className="w-full py-3 bg-[#CDFF00] text-black font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-[#a1e600] transition-colors flex items-center justify-center gap-2"
        >
          <FileText size={14} />
          Gerar Contrato (PDF)
        </button>
        <button
          type="button"
          onClick={handleSendWhatsApp}
          disabled={!data.whatsapp}
          className="w-full py-3 bg-[#1a1a1a] border border-[#25D366]/40 text-[#25D366] font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-[#25D366]/10 hover:border-[#25D366] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:hover:bg-[#1a1a1a] disabled:hover:border-[#25D366]/40"
        >
          <MessageCircle size={14} />
          {data.whatsapp ? 'Enviar por WhatsApp' : 'WhatsApp não informado'}
        </button>
      </div>
    </div>
  );
}
