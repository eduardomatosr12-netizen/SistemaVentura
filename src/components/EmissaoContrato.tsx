import { useEffect, useMemo, useState } from 'react';
import { FileText, MessageCircle, Lock, AlertCircle, User, CalendarDays, Package, CreditCard, PenLine, Plus, Check, Sparkles, X } from 'lucide-react';
import {
  generateContractPDF, formatNumberBR, numberToExtensoBRL, formatShortDate, CONTRACTOR,
  buildServicesTerm, formatServicesList,
  type ContractData,
} from '../lib/crmHelpers';
import { eventTypeLabel } from '../lib/eventTypeLabel';
import { generateWhatsAppLink } from '../lib/whatsapp';
import {
  PRESET_CONTRACT_SERVICES, subscribeContractServiceTypes, addContractServiceType,
  deleteContractServiceType, mergeServiceNames, type ContractServiceType,
} from '../services/contractServiceTypeService';

interface Props {
  eventId: string | null;
  data: ContractData;
  onAddressChange?: (value: string) => void;
  onGenderChange?: (value: 'F' | 'M' | '') => void;
  onServicesChange?: (services: string[]) => void;
  onSave?: () => void;
  saving?: boolean;
}

const inputClass = 'w-full bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-[#CDFF00] outline-none';

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-start justify-between gap-3 py-1.5 border-b border-[#242424] last:border-b-0">
    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 shrink-0">{label}</span>
    <span className="text-xs text-white text-right break-words">{value}</span>
  </div>
);

const EditableRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="py-1.5 border-b border-[#242424]">
    <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1">{label}</label>
    {children}
  </div>
);

const Block = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <section className="border-t border-[#2d2d2d] pt-3">
    <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-2 flex items-center gap-1.5">{icon}{title}</p>
    {children}
  </section>
);

export default function EmissaoContrato({ eventId, data, onAddressChange, onGenderChange, onServicesChange, onSave, saving }: Props) {
  const items = data.items || [];
  const selected = data.services || [];

  const [customTypes, setCustomTypes] = useState<ContractServiceType[]>([]);
  const [newService, setNewService] = useState('');
  const [isAddingService, setIsAddingService] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => subscribeContractServiceTypes(setCustomTypes), []);

  const available = useMemo(
    () => mergeServiceNames(PRESET_CONTRACT_SERVICES, customTypes),
    [customTypes],
  );
  const customIds = useMemo(() => new Set(customTypes.map(c => c.name.toLowerCase())), [customTypes]);
  const selectedKey = (name: string) => name.trim().toLowerCase();

  const toggleService = (name: string) => {
    if (!onServicesChange) return;
    const key = selectedKey(name);
    const next = selected.some(s => selectedKey(s) === key)
      ? selected.filter(s => selectedKey(s) !== key)
      : [...selected, name.trim()];
    onServicesChange(next);
  };

  const handleAddService = async () => {
    const name = newService.trim();
    if (!name || isAddingService) return;
    setIsAddingService(true);
    setCatalogError(null);
    try {
      await addContractServiceType(name);
      setNewService('');
      if (onServicesChange && !selected.some(s => selectedKey(s) === selectedKey(name))) {
        onServicesChange([...selected, name]);
      }
    } catch (err) {
      console.error('[EmissaoContrato] Erro ao cadastrar tipo de serviço:', err);
      setCatalogError('Não foi possível cadastrar o serviço. Tente novamente.');
    } finally {
      setIsAddingService(false);
    }
  };

  const handleRemoveService = async (name: string) => {
    const match = customTypes.find(c => c.name.toLowerCase() === selectedKey(name));
    setCatalogError(null);
    if (match) {
      try {
        await deleteContractServiceType(match.id);
      } catch (err) {
        console.error('[EmissaoContrato] Erro ao remover tipo de serviço:', err);
        setCatalogError('Não foi possível remover o serviço. Tente novamente.');
        return;
      }
    }
    if (onServicesChange) {
      onServicesChange(selected.filter(s => selectedKey(s) !== selectedKey(name)));
    }
  };

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
        {onAddressChange ? (
          <EditableRow label="Endereço do Contratante">
            <input
              type="text"
              value={data.clientAddress || ''}
              onChange={e => onAddressChange(e.target.value)}
              placeholder="Ex: Rua Henrique Dias, nº 274"
              className={inputClass}
            />
          </EditableRow>
        ) : (
          <Row label="Endereço" value={data.clientAddress || '—'} />
        )}
        {onGenderChange ? (
          <EditableRow label="Sexo do Contratante">
            <select
              value={data.clientGender || ''}
              onChange={e => onGenderChange(e.target.value as 'F' | 'M' | '')}
              className={inputClass}
              style={{ colorScheme: 'dark' }}
            >
              <option value="">Não informado</option>
              <option value="F">Feminino</option>
              <option value="M">Masculino</option>
            </select>
          </EditableRow>
        ) : (
          <Row label="Sexo" value={data.clientGender === 'F' ? 'Feminino' : data.clientGender === 'M' ? 'Masculino' : '—'} />
        )}
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

      <Block icon={<Sparkles size={12} />} title="Serviços Contratados">
        {onServicesChange ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-3">
              {available.map(name => {
                const isOn = selected.some(s => selectedKey(s) === selectedKey(name));
                const isCustom = customIds.has(selectedKey(name));
                return (
                  <div
                    key={name}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-colors ${
                      isOn ? 'border-[#CDFF00]/60 bg-[#CDFF00]/10' : 'border-[#2d2d2d] bg-[#1a1a1a]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleService(name)}
                      className="flex items-center gap-2 min-w-0 flex-1 text-left"
                    >
                      <span className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center ${
                        isOn ? 'bg-[#CDFF00] border-[#CDFF00]' : 'border-[#555] bg-transparent'
                      }`}>
                        {isOn && <Check size={11} className="text-black" strokeWidth={3} />}
                      </span>
                      <span className={`text-xs truncate ${isOn ? 'text-white font-medium' : 'text-neutral-400'}`}>{name}</span>
                    </button>
                    {isCustom && (
                      <button
                        type="button"
                        onClick={() => handleRemoveService(name)}
                        title="Remover dos tipos de serviço"
                        className="p-1 hover:bg-[#2a2a2a] rounded transition-colors shrink-0"
                      >
                        <X size={12} className="text-neutral-500 hover:text-red-400" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newService}
                onChange={e => setNewService(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); handleAddService(); }
                }}
                placeholder="Cadastrar novo tipo de serviço..."
                className="flex-1 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-600 focus:border-[#CDFF00] outline-none"
              />
              <button
                type="button"
                onClick={handleAddService}
                disabled={!newService.trim() || isAddingService}
                className="shrink-0 px-3 py-2 bg-[#CDFF00] text-black rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-[#a1e600] transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={12} /> {isAddingService ? 'Salvando' : 'Adicionar'}
              </button>
            </div>
            {catalogError && <p className="text-[10px] text-red-400 mt-1.5">{catalogError}</p>}
          </>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {formatServicesList(data.services).map(name => (
              <span key={name} className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded bg-[#1a1a1a] border border-[#2d2d2d] text-white">
                {name}
              </span>
            ))}
          </div>
        )}
        <p className="text-[10px] text-neutral-500 italic mt-2 leading-relaxed">
          No contrato: {buildServicesTerm(data.services, pontosLuz)}.
        </p>
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
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="w-full py-3 bg-[#1a1a1a] border border-[#CDFF00]/50 text-[#CDFF00] font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-[#CDFF00]/10 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <PenLine size={14} />
            {saving ? 'Salvando...' : 'Salvar Dados do Contrato'}
          </button>
        )}
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
