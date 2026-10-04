import { User, Phone, Mail, CreditCard, IdCard, CalendarDays, Clock, Plus, Trash2, MapPin, Search, ChevronDown, AlertCircle } from 'lucide-react';
import type { OrcamentoItem } from '../../types/crm';
import { formatCurrency, generateEventTypeLabel, EVENT_TYPES } from '../../lib/crmHelpers';
import { EVENT_STOCK_CATEGORIES, type EventStockItem } from '../../services/eventStockService';

interface EventFormData {
  name: string; whatsapp: string; email: string; cpf: string; rg: string; clientAddress: string; clientGender: string;
  eventType: string; date: string; dateEnd: string; time: string; city: string; local: string; observacao: string;
  outroEventoType: string;
  orcamentoItems: OrcamentoItem[]; desconto: number; valor: number;
  contractServices: string[];
  downPayment: number;
  downPaymentType: 'percent' | 'fixed';
}

interface NewItemForm {
  name: string; category: string; observacao: string;
}

interface CreateEventFormProps {
  formData: EventFormData;
  setFormData: React.Dispatch<React.SetStateAction<EventFormData>>;
  filteredClients: Array<{ id: string; nome: string; whatsapp: string; cidade: string; email: string; niche: string; items: OrcamentoItem[]; valor: number }>;
  clientSearch: string;
  setClientSearch: React.Dispatch<React.SetStateAction<string>>;
  clientSearchOpen: boolean;
  setClientSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedClientId: string;
  setSelectedClientId: React.Dispatch<React.SetStateAction<string>>;
  clientContractFallbacks: (id: string, nome: string) => { cpf: string; rg: string; clientAddress: string; clientGender: string };
  matchEventType: (niche: string) => { value: string; custom: string };
  orcamentoSubTab: 'selecionar' | 'novo';
  setOrcamentoSubTab: React.Dispatch<React.SetStateAction<'selecionar' | 'novo'>>;
  orcamentoItems: EventStockItem[];
  setOrcamentoItems: React.Dispatch<React.SetStateAction<EventStockItem[]>>;
  clientSearchRef: React.RefObject<HTMLDivElement | null>;
  orcSearch: string;
  setOrcSearch: React.Dispatch<React.SetStateAction<string>>;
  orcSearchOpen: boolean;
  setOrcSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
  showCreateItemForm: boolean;
  setShowCreateItemForm: React.Dispatch<React.SetStateAction<boolean>>;
  newItemForm: NewItemForm;
  setNewItemForm: React.Dispatch<React.SetStateAction<NewItemForm>>;
  orcSearchRef: React.RefObject<HTMLDivElement | null>;
  handleRemoveItem: (id: string) => void;
  calcItemsTotal: (items: OrcamentoItem[]) => number;
  discountType: 'percent' | 'fixed';
  setDiscountType: React.Dispatch<React.SetStateAction<'percent' | 'fixed'>>;
  discountValue: number;
  setDiscountValue: React.Dispatch<React.SetStateAction<number>>;
  calculateDiscount: (items: OrcamentoItem[], type: 'percent' | 'fixed', value: number) => { total: number; discountedTotal: number; discountAmount: number };
  eventTypeOpen: boolean;
  setEventTypeOpen: React.Dispatch<React.SetStateAction<boolean>>;
  eventTypeRef: React.RefObject<HTMLDivElement | null>;
  total: number;
}

export const CreateEventForm = ({
  formData,
  setFormData,
  filteredClients,
  clientSearch,
  setClientSearch,
  clientSearchOpen,
  setClientSearchOpen,
  selectedClientId,
  setSelectedClientId,
  clientContractFallbacks,
  matchEventType,
  orcamentoSubTab,
  setOrcamentoSubTab,
  orcamentoItems,
  setOrcamentoItems,
  clientSearchRef,
  orcSearch,
  setOrcSearch,
  orcSearchOpen,
  setOrcSearchOpen,
  showCreateItemForm,
  setShowCreateItemForm,
  newItemForm,
  setNewItemForm,
  orcSearchRef,
  handleRemoveItem,
  calcItemsTotal,
  discountType,
  setDiscountType,
  discountValue,
  setDiscountValue,
  calculateDiscount,
  eventTypeOpen,
  setEventTypeOpen,
  eventTypeRef,
  total,
}: CreateEventFormProps) => {
  return (
    <div>
      {/* Seção 1 — quem é o cliente + dados do evento */}
      <div className="space-y-5 min-w-0">
          <div>
            {/* Sub-tabs for Orçamento */}
            <div className="grid grid-cols-2 border-b border-[#2d2d2d] mb-4">
              <button
                type="button"
                onClick={() => setOrcamentoSubTab('selecionar')}
                className={`px-3 py-2 text-[10px] font-black uppercase leading-tight transition-colors ${orcamentoSubTab === 'selecionar' ? 'text-[#CDFF00] border-b-2 border-[#CDFF00]' : 'text-neutral-500 hover:text-white'}`}
              >
                Selecionar Cliente
              </button>
              <button
                type="button"
                onClick={() => setOrcamentoSubTab('novo')}
                className={`px-3 py-2 text-[10px] font-black uppercase leading-tight transition-colors border-l border-[#2d2d2d] ${orcamentoSubTab === 'novo' ? 'text-[#CDFF00] border-b-2 border-[#CDFF00]' : 'text-neutral-500 hover:text-white'}`}
              >
                Adicionar Novo Cliente
              </button>
            </div>
            {orcamentoSubTab === 'selecionar' ? (
              <div ref={clientSearchRef}>
                <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 flex items-center gap-1.5">
                  <User size={12} /> Selecionar Cliente
                </label>
                <div className="relative">
                  <div className="flex items-center bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg overflow-hidden focus-within:border-[#CDFF00] transition-colors">
                    <Search size={14} className="text-neutral-500 ml-3 shrink-0" />
                    <input
                      type="text"
                      value={clientSearch}
                      onChange={e => { setClientSearch(e.target.value); setClientSearchOpen(true); setSelectedClientId(''); }}
                      onFocus={() => setClientSearchOpen(true)}
                      placeholder="Digite para buscar..."
                      className="w-full bg-transparent border-none px-2 py-2 text-sm text-white placeholder-neutral-600 outline-none"
                      autoComplete="off"
                    />
                  </div>
                  {clientSearchOpen && (
                    <div className="mt-1 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg max-h-48 overflow-y-auto z-50 shadow-xl">
                      {filteredClients.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-neutral-500 italic">Nenhum cliente encontrado</div>
                      ) : (
                        filteredClients.map(lead => (
                          <button
                            type="button"
                            key={lead.id}
                            onClick={() => {
                              setSelectedClientId(lead.id);
                              setClientSearch(`${lead.nome} — ${lead.whatsapp}`);
                              setClientSearchOpen(false);
                              setFormData(prev => {
                                const fb = clientContractFallbacks(lead.id, lead.nome);
                                const evType = matchEventType(lead.niche);
                                const valorBase = lead.valor && lead.valor > 0 ? lead.valor : 0;
                                return {
                                  ...prev,
                                  name: lead.nome,
                                  city: lead.cidade,
                                  whatsapp: lead.whatsapp,
                                  email: lead.email || '',
                                  cpf: fb.cpf || prev.cpf,
                                  rg: fb.rg || prev.rg,
                                  clientAddress: fb.clientAddress || prev.clientAddress,
                                  clientGender: fb.clientGender || prev.clientGender,
                                  eventType: evType.value || prev.eventType,
                                  outroEventoType: evType.custom || prev.outroEventoType,
                                  orcamentoItems: (lead.items && lead.items.length > 0) ? lead.items : prev.orcamentoItems,
                                  valor: (lead.items && lead.items.length > 0) ? prev.valor : (valorBase > 0 ? valorBase : prev.valor),
                                };
                              });
                            }}
                            className={`w-full text-left px-3 py-2 text-sm text-white hover:bg-[#2a2a2a] transition-colors flex items-center gap-2 ${selectedClientId === lead.id ? 'bg-[#2a2a2a] border-l-2 border-[#CDFF00]' : ''}`}
                          >
                            <User size={12} className="text-neutral-500 shrink-0" />
                            <div className="min-w-0">
                              <span className="block truncate">{lead.nome}</span>
                              <span className="block text-[10px] text-neutral-500 truncate">{lead.whatsapp}</span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  {selectedClientId && (
                    <p className="text-[10px] text-[#CDFF00] mt-1">Cliente selecionado</p>
                  )}
                </div>
              </div>
              ) : (
                <div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 flex items-center gap-1.5">
                      <User size={12} /> Nome
                    </label>
                    <input type="text" value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg px-3 py-2 text-sm text-white focus:border-[#CDFF00] outline-none" required />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 flex items-center gap-1.5">
                      <Phone size={12} /> WhatsApp
                    </label>
                    <input type="text" value={formData.whatsapp} onChange={e => setFormData(prev => ({ ...prev, whatsapp: e.target.value }))}
                      className="w-full bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg px-3 py-2 text-sm text-white focus:border-[#CDFF00] outline-none" required />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 flex items-center gap-1.5">
                        <Mail size={12} /> E-mail
                      </label>
                      <input type="email" value={formData.email} onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg px-3 py-2 text-sm text-white focus:border-[#CDFF00] outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 flex items-center gap-1.5">
                        <CreditCard size={12} /> CPF
                      </label>
                      <input type="text" value={formData.cpf} onChange={e => setFormData(prev => ({ ...prev, cpf: e.target.value }))}
                        className="w-full bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg px-3 py-2 text-sm text-white focus:border-[#CDFF00] outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 flex items-center gap-1.5">
                        <IdCard size={12} /> RG
                      </label>
                      <input type="text" value={formData.rg} onChange={e => setFormData(prev => ({ ...prev, rg: e.target.value }))}
                        className="w-full bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg px-3 py-2 text-sm text-white focus:border-[#CDFF00] outline-none" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 flex items-center gap-1.5">
                        <MapPin size={12} /> Endereço do Cliente
                      </label>
                      <input type="text" value={formData.clientAddress} onChange={e => setFormData(prev => ({ ...prev, clientAddress: e.target.value }))}
                        className="w-full bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg px-3 py-2 text-sm text-white focus:border-[#CDFF00] outline-none" placeholder="Rua, número, bairro, cidade, estado" />
                    </div>
                  </div>
                </div>
              )}
          </div>
      {/* Event fields — common to both modes */}
      <div className="border-t border-[#2d2d2d] pt-4">
        <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-3">Dados do Evento</p>
        <div className="space-y-3">
          <div ref={eventTypeRef}>
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 flex items-center gap-1.5">
              <CalendarDays size={12} /> Tipo de Evento
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setEventTypeOpen(prev => !prev)}
                className={`w-full bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between gap-2 transition-colors ${formData.eventType ? 'text-white' : 'text-neutral-500'} focus:border-[#CDFF00] outline-none`}
              >
                <span>{formData.eventType ? generateEventTypeLabel(formData.eventType, formData.outroEventoType) : 'Selecionar...'}</span>
                <ChevronDown size={14} className={`text-neutral-500 transition-transform ${eventTypeOpen ? 'rotate-180' : ''}`} />
              </button>
              {eventTypeOpen && (
                <div className="mt-1 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg overflow-hidden z-50 shadow-xl">
                  {EVENT_TYPES.map(t => (
                    <button
                      type="button"
                      key={t.value}
                      onClick={() => { setFormData(prev => ({ ...prev, eventType: t.value })); setEventTypeOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${formData.eventType === t.value ? 'bg-[#2a2a2a] text-[#CDFF00] font-bold' : 'text-white hover:bg-[#2a2a2a]'}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {formData.eventType === 'Outros' && (
              <div className="mt-3">
                <input type="text" value={formData.outroEventoType} onChange={e => setFormData(prev => ({ ...prev, outroEventoType: e.target.value }))}
                  placeholder="Especifique o tipo de evento..."
                  className="w-full bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-[#CDFF00] outline-none" />
              </div>
            )}
          </div>
          {/* Cidade */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 flex items-center gap-1.5">
              <MapPin size={12} /> Cidade
            </label>
            <input type="text" value={formData.city} onChange={e => setFormData(prev => ({ ...prev, city: e.target.value }))}
              placeholder="Ex: São Paulo, SP"
              className="w-full bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-[#CDFF00] outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 flex items-center gap-1.5">
              <MapPin size={12} /> Local do Evento
            </label>
            <input type="text" value={formData.local} onChange={e => setFormData(prev => ({ ...prev, local: e.target.value }))}
              placeholder="Ex: Fazenda Terra do Sol"
              className="w-full bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-[#CDFF00] outline-none" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 flex items-center gap-1.5">
                <CalendarDays size={12} /> Data do Evento
              </label>
              <input type="date" value={formData.date} onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg px-3 py-2 text-sm text-white focus:border-[#CDFF00] outline-none" style={{ colorScheme: 'dark' }} required />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 flex items-center gap-1.5">
                <Clock size={12} /> Horário
              </label>
              <input type="time" value={formData.time} onChange={e => setFormData(prev => ({ ...prev, time: e.target.value }))}
                className="w-full bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg px-3 py-2 text-sm text-white focus:border-[#CDFF00] outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 flex items-center gap-1.5">
              <CalendarDays size={12} /> Data de Término
            </label>
            <input type="date" value={formData.dateEnd || ''} onChange={e => setFormData(prev => ({ ...prev, dateEnd: e.target.value }))}
              className="w-full bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg px-3 py-2 text-sm text-white focus:border-[#CDFF00] outline-none" style={{ colorScheme: 'dark' }} />
          </div>
        </div>
      </div>
      {/* Seção 2 — itens do orçamento, valores e observação */}
      <div className="space-y-5 min-w-0">
        {/* Itens do Orçamento */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Itens do Orçamento</p>
            <button type="button" onClick={() => { setOrcSearch(''); setOrcSearchOpen(true); }}
              className="flex items-center gap-1 text-[10px] font-bold text-[#CDFF00] hover:text-white transition-colors">
              <Plus size={12} /> Adicionar Item
            </button>
          </div>

          {/* Orçamento search combobox */}
          {orcSearchOpen && (
            <div ref={orcSearchRef} className="mb-3">
              {showCreateItemForm || orcamentoItems.length === 0 ? (
                <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-3 space-y-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Criar item no estoque de eventos</p>
                  <input
                    type="text"
                    value={newItemForm.name}
                    onChange={e => setNewItemForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Nome do item (obrigatório)"
                    className="w-full bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-[#CDFF00]"
                    autoFocus
                    autoComplete="off"
                  />
                  <select
                    value={newItemForm.category}
                    onChange={e => setNewItemForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#CDFF00] [color-scheme:dark]"
                  >
                    {EVENT_STOCK_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <textarea
                    rows={2}
                    value={newItemForm.observacao}
                    onChange={e => setNewItemForm(prev => ({ ...prev, observacao: e.target.value }))}
                    placeholder="Observação interna (não exportada)..."
                    className="w-full bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-[#CDFF00] resize-none"
                  />
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateItemForm(false);
                        if (orcamentoItems.length === 0) setOrcSearchOpen(false);
                      }}
                      className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-white transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!newItemForm.name.trim()) return;
                        setOrcamentoItems(prev => [...prev, { id: crypto.randomUUID(), name: newItemForm.name, category: newItemForm.category, observacao: newItemForm.observacao, quantity: 0, unit: '', valorReferencia: 0 }]);
                        setNewItemForm({ name: '', category: EVENT_STOCK_CATEGORIES[0], observacao: '' });
                        setShowCreateItemForm(false);
                        setOrcSearchOpen(false);
                      }}
                      className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-[#CDFF00] text-black hover:bg-[#a1e600] rounded transition-colors"
                    >
                      Salvar Item
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-3">
                  <div className="relative">
                    <Search size={14} className="text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={orcSearch}
                      onChange={e => setOrcSearch(e.target.value)}
                      onFocus={() => setOrcSearchOpen(true)}
                      placeholder="Buscar item no estoque..."
                      className="w-full bg-transparent border-none pl-10 py-2 text-sm text-white placeholder-neutral-600 outline-none"
                      autoComplete="off"
                    />
                  </div>
                  <div className="mt-2 max-h-48 overflow-y-auto">
                    {orcamentoItems.filter(item =>
                      item.name.toLowerCase().includes(orcSearch.toLowerCase()) ||
                      item.category.toLowerCase().includes(orcSearch.toLowerCase())
                    ).length === 0 ? (
                      <div className="px-3 py-2 text-xs text-neutral-500 italic">Nenhum item encontrado</div>
                    ) : (
                      orcamentoItems.filter(item =>
                        item.name.toLowerCase().includes(orcSearch.toLowerCase()) ||
                        item.category.toLowerCase().includes(orcSearch.toLowerCase())
                      ).map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setOrcamentoItems(prev => [...prev, { id: crypto.randomUUID(), name: item.name, category: item.category, observacao: item.observacao, quantity: item.quantity, unit: item.unit, valorReferencia: item.valorReferencia }]);
                            setOrcSearchOpen(false);
                            setOrcSearch('');
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-white hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
                        >
                          <div className="min-w-0">
                            <span className="block truncate">{item.name}</span>
                            <span className="block text-[10px] text-neutral-500 truncate">{item.category}</span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setShowCreateItemForm(true); setOrcSearchOpen(true); }}
                    className="w-full mt-2 flex items-center justify-center gap-1.5 text-[10px] font-bold text-[#CDFF00] hover:text-white transition-colors"
                  >
                    <Plus size={12} /> Criar novo item no estoque
                  </button>
                </div>
              )}
            </div>
          )}
          </div>

          {formData.orcamentoItems && formData.orcamentoItems.length > 0 && (
            <div className="space-y-2 mb-4">
              {formData.orcamentoItems.map(item => (
                <div key={item.id} className="flex items-center gap-2 bg-[#1a1a1a] border border-[#2d2d2d] rounded-md px-3 py-2">
                  <span className="flex-1 text-white text-sm font-medium truncate">{item.item}</span>
                  <span className="text-neutral-400 text-xs whitespace-nowrap">{item.qtdAtual}x</span>
                  <span className="text-white text-xs font-bold whitespace-nowrap">
                    {formatCurrency(item.valorUnit)}
                  </span>
                  <button type="button" onClick={() => handleRemoveItem(item.id)} className="text-neutral-500 hover:text-red-500 transition-colors p-2 min-w-[44px] min-h-[44px] flex items-center justify-center">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              
              {/* Discount Section */}
              {formData.orcamentoItems.length > 0 && calcItemsTotal(formData.orcamentoItems) > 0 && (
                <div className="bg-[#111] border border-[#333] rounded-md p-4 mt-3 space-y-3">
                  <label className="flex items-center gap-2 text-[10px] font-black text-[#CDFF00] uppercase tracking-widest">
                    <div className="w-4 h-4 border border-[#CDFF00] rounded" /> Desconto
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-[#1a1a1a] border border-[#333] rounded-md p-1">
                      <button
                        type="button"
                        onClick={() => { setDiscountType('percent'); setDiscountValue(0); }}
                        className={`px-3 py-1.5 text-[10px] font-black rounded transition-colors ${discountType === 'percent' ? 'bg-[#CDFF00] text-black' : 'text-neutral-400 hover:text-white'}`}
                      >
                        %
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDiscountType('fixed'); setDiscountValue(0); }}
                        className={`px-3 py-1.5 text-[10px] font-black rounded transition-colors ${discountType === 'fixed' ? 'bg-[#CDFF00] text-black' : 'text-neutral-400 hover:text-white'}`}
                      >
                        R$
                      </button>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max={discountType === 'percent' ? 100 : undefined}
                      value={discountValue}
                      onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)}
                      className="w-20 bg-[#1a1a1a] border border-[#333] rounded-md px-3 py-1.5 text-xs font-bold text-white text-center focus:outline-none focus:border-[#CDFF00]"
                      placeholder="0"
                    />
                    <span className="text-[10px] text-neutral-500 font-bold">
                      {discountType === 'percent' ? '%' : 'R$'}
                    </span>
                  </div>

                  {/* Discount preview */}
                  {(() => {
                    const { total: subtotal, discountedTotal, discountAmount } = calculateDiscount(formData.orcamentoItems || [], discountType, discountValue);
                    return (
                      <div className="space-y-1 pt-2 border-t border-[#333]">
                        <div className="flex justify-between text-xs text-neutral-400">
                          <span>Total Bruto:</span>
                          <span className="text-white font-bold">{formatCurrency(subtotal)}</span>
                        </div>
                        {discountAmount > 0 && (
                          <div className="flex justify-between text-xs text-red-400">
                            <span>Desconto:</span>
                            <span>-{formatCurrency(discountAmount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm font-black text-[#CDFF00] border-t border-[#333] pt-1 mt-1">
                          <span>Total:</span>
                          <span>{formatCurrency(discountedTotal)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
          {formData.orcamentoItems.length === 0 && !orcSearchOpen && (
            <div className="text-center py-3 bg-[#1a1a1a] border border-dashed border-[#2d2d2d] rounded-lg">
              <p className="text-[10px] text-neutral-500 italic">Clique em "Adicionar Item" para buscar ou criar itens no estoque de eventos</p>
            </div>
          )}

          {/* Financial footer */}
          <div className="border-t border-[#2d2d2d] pt-3 mt-3 space-y-2">
            <div className="flex items-center justify-between gap-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 shrink-0">Valor do Evento (R$)</label>
              <input type="number" min="0" step="0.01" value={formData.valor}
                onChange={e => setFormData(prev => ({ ...prev, valor: Math.max(0, Number(e.target.value) || 0) }))}
                className="w-28 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg px-2 py-1.5 text-sm text-white text-right focus:border-[#CDFF00] outline-none" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 shrink-0">Desconto (R$)</label>
              <input type="number" min="0" step="0.01" value={formData.desconto}
                onChange={e => setFormData(prev => ({ ...prev, desconto: Math.max(0, Number(e.target.value) || 0) }))}
                className="w-28 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg px-2 py-1.5 text-sm text-white text-right focus:border-[#CDFF00] outline-none" />
            </div>
            <div className="border-t border-[#2d2d2d] pt-2 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-widest text-[#CDFF00]">Valor Total do Aluguel</span>
              <span className="text-base font-black text-white">R$ {total.toFixed(2)}</span>
            </div>
          </div>
          </div>
          {/* Observação */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 flex items-center gap-1.5">
              <AlertCircle size={12} /> Observação
            </label>
            <textarea value={formData.observacao} onChange={e => setFormData(prev => ({ ...prev, observacao: e.target.value }))}
              placeholder="Informações adicionais sobre o evento..."
              rows={3}
              className="w-full bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-[#CDFF00] outline-none resize-none" />
          </div>
        </div>
    </div>
  );
};