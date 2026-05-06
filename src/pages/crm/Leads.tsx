import { useState, useMemo, useRef, useEffect } from 'react';
import { ReactNode } from 'react';
import { Plus, Pencil, Trash2, X, Save, Filter, XCircle, ChevronDown, ChevronUp, AlertCircle, MessageCircle } from 'lucide-react';
import { cleanPhoneNumber, generateWhatsAppLink, WHATSAPP_MESSAGE_TEMPLATES } from '../../lib/whatsapp';
import { useCRM, type Lead } from '../../contexts/CRMContext';
import { useFilters } from '../../contexts/FilterContext';
import { useAuth } from '../../contexts/AuthContext';

const formatBRL = (val: string) => {
  const numeric = val.replace(/\D/g, '');
  if (!numeric) return '';
  const num = parseFloat(numeric) / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
};

const EMPTY_LEAD: Partial<Lead> = {
  name: '', niche: '', whatsapp: '', email: '', instagram: '',
  stage: 'Novos Leads', firstContact: '', closingDate: '',
  followUpReminder: '', address: '', gmnReviews: '', gmnStars: '',
  notes: '', value: '',
};

const STAGES = [
  'Novos Leads',
  'Primeiro Contato',
  'Contato Ativo',
  'Reunião Agendada',
  'Follow Up',
  'Proposta Enviada',
  'Contrato Fechado',
  'Perdido'
];

const STAGE_ORIGINS = [
  'Instagram',
  'Indicação',
  'WhatsApp',
  'Facebook',
  'Google',
  'Site',
  'Evento',
  'Outros'
];

const stageStyle: Record<string, string> = {
  'Novos Leads':      'bg-neutral-100 text-neutral-600',
  'Primeiro Contato': 'bg-neutral-200 text-neutral-700',
  'Contato Ativo':    'bg-slate-100 text-slate-700',
  'Reunião Agendada': 'bg-black text-white',
  'Follow Up':        'bg-slate-800 text-white',
  'Proposta Enviada': 'bg-zinc-100 text-zinc-700',
  'Contrato Fechado': 'bg-emerald-100 text-emerald-700',
  'Perdido':          'bg-red-50 text-red-600',
};

const FilterSection = ({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-neutral-100 px-3 py-2">
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)} 
        className="flex items-center justify-between w-full text-left py-1"
      >
        <span className="text-[9px] font-black text-black uppercase tracking-widest">{title}</span>
        {isOpen ? <ChevronUp size={12} className="text-neutral-400" /> : <ChevronDown size={12} className="text-neutral-400" />}
      </button>
      {isOpen && <div className="mt-1 space-y-1">{children}</div>}
    </div>
  );
};

const CheckboxFilter = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) => (
  <label className="flex items-center gap-2 cursor-pointer group">
    <div className={`w-4 h-4 border rounded flex items-center justify-center transition-all ${checked ? 'bg-black border-black' : 'border-neutral-300 group-hover:border-black'}`}>
      {checked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>}
    </div>
    <input type="checkbox" className="hidden" checked={checked} onChange={e => onChange(e.target.checked)} />
    <span className="text-xs font-medium text-neutral-600 group-hover:text-black">{label}</span>
  </label>
);

const Field = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
      {label}{required && <span className="text-black ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const inputCls =
  'w-full bg-white border border-slate-200 rounded-md py-2.5 px-3.5 text-black text-sm placeholder-slate-300 focus:outline-none focus:border-black transition-colors';

const CRMLeads = () => {
  const { leads, addLead, updateLead, deleteLead, searchTerm } = useCRM();
  const { filters, setStagesFilter, setNichesFilter, setOriginsFilter, setDateFilter, clearFilters, hasActiveFilters } = useFilters();
  const { role, employeeName } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [current, setCurrent] = useState<Partial<Lead>>(EMPTY_LEAD);
  const [mode, setMode] = useState<'add' | 'edit'>('add');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [nicheSearch, setNicheSearch] = useState('');
  const [whatsAppModal, setWhatsAppModal] = useState<{ lead: Lead | null; selectedTemplate: string | null }>({ lead: null, selectedTemplate: null });
  const [nicheSuggestions, setNicheSuggestions] = useState<string[]>([]);
  const [showNicheSuggestions, setShowNicheSuggestions] = useState(false);

  const uniqueNiches = useMemo(() => {
    if (!leads || !Array.isArray(leads)) return [];
    try {
      const niches = new Set(leads.map(l => l.niche).filter(Boolean));
      return Array.from(niches).sort();
    } catch {
      return [];
    }
  }, [leads]);

  const handleNicheSelect = (niche: string) => {
    const currentNiches = filters?.niches || [];
    if (!currentNiches.includes(niche)) {
      setNichesFilter([...currentNiches, niche]);
    }
    setNicheSearch('');
    setShowNicheSuggestions(false);
  };

  const handleAddNiche = () => {
    if (nicheSearch.trim()) {
      handleNicheSelect(nicheSearch.trim());
    }
  };

  useEffect(() => {
    if (!nicheSearch.trim()) {
      setNicheSuggestions([]);
      return;
    }
    try {
      const search = nicheSearch.toLowerCase();
      const suggestions = uniqueNiches
        .filter(n => n.toLowerCase().includes(search))
        .slice(0, 8);
      setNicheSuggestions(suggestions);
    } catch {
      setNicheSuggestions([]);
    }
  }, [nicheSearch, uniqueNiches]);

  const openAdd = () => { setMode('add'); setCurrent(EMPTY_LEAD); setIsOpen(true); };
  const openEdit = (lead: Lead) => { setMode('edit'); setCurrent({ ...lead }); setIsOpen(true); };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const modifiedLead = {
      ...current,
      lastModifiedBy: employeeName || (role === 'admin' ? 'Administrador' : 'Funcionário')
    };
    
    if (mode === 'add') {
      addLead(modifiedLead as Omit<Lead, 'id'>);
    } else {
      updateLead(current.id!, modifiedLead);
    }
    setIsOpen(false);
  };

  const handleDelete = (id: string | undefined) => {
    if (!id) return;
    if (confirm('Excluir este lead?')) deleteLead(id);
  };

  const updateField = (field: keyof Lead, val: string) =>
    setCurrent(prev => ({ ...prev, [field]: val }));

  const toggleStageFilter = (stage: string) => {
    try {
      const currentStages = filters?.stages || [];
      const newStages = currentStages.includes(stage)
        ? currentStages.filter(s => s !== stage)
        : [...currentStages, stage];
      setStagesFilter(newStages);
    } catch (err) {
      console.error('Erro ao filtrar por etapa:', err);
    }
  };

  const toggleOriginFilter = (origin: string) => {
    try {
      const currentOrigins = filters?.origins || [];
      const newOrigins = currentOrigins.includes(origin)
        ? currentOrigins.filter((o: string) => o !== origin)
        : [...currentOrigins, origin];
      setOriginsFilter(newOrigins);
    } catch (err) {
      console.error('Erro ao filtrar por origem:', err);
    }
  };

  const toggleNicheFilter = (niche: string) => {
    try {
      const currentNiches = filters?.niches || [];
      const newNiches = currentNiches.includes(niche)
        ? currentNiches.filter(n => n !== niche)
        : [...currentNiches, niche];
      setNichesFilter(newNiches);
    } catch (err) {
      console.error('Erro ao filtrar por nicho:', err);
    }
  };

  const filteredLeads = useMemo(() => {
    if (!leads || !Array.isArray(leads)) return [];
    let result = leads;

    if (searchTerm) {
      result = result.filter(lead => 
        lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.niche?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filters.stages && filters.stages.length > 0) {
      result = result.filter(lead => filters.stages.includes(lead.stage));
    }

    if (filters.origins && filters.origins.length > 0) {
      result = result.filter(lead => filters.origins.includes(lead.origin));
    }

    if (filters.niches && filters.niches.length > 0) {
      result = result.filter(lead => filters.niches.includes(lead.niche));
    }

    if (filters.dateFilter) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (filters.dateFilter === 'today') {
        result = result.filter(lead => {
          if (!lead.firstContact) return false;
          const leadDate = new Date(lead.firstContact);
          return leadDate.toDateString() === today.toDateString();
        });
      } else if (filters.dateFilter === 'week') {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        result = result.filter(lead => {
          if (!lead.firstContact) return false;
          const leadDate = new Date(lead.firstContact);
          return leadDate >= weekAgo;
        });
      } else if (filters.dateFilter === 'month') {
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        result = result.filter(lead => {
          if (!lead.firstContact) return false;
          const leadDate = new Date(lead.firstContact);
          return leadDate >= monthAgo;
        });
      }
    }

    return result;
  }, [leads, searchTerm, filters]);

  return (
    <div className="relative min-h-screen">
      {isSidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setIsSidebarOpen(false)} />
          <div className="absolute top-14 left-4 w-[280px] max-h-[70vh] bg-white border border-neutral-200 rounded-xl shadow-xl overflow-y-auto z-50">
            <div className="p-3 sticky top-0 bg-white border-b border-neutral-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter size={12} className="text-black" />
                <span className="text-[10px] font-black text-black uppercase tracking-widest">Filtros</span>
              </div>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="p-1 hover:bg-neutral-100 rounded-md transition-colors"
              >
                <X size={14} className="text-neutral-400" />
              </button>
            </div>
            {hasActiveFilters && (
              <button 
                onClick={clearFilters}
                className="text-[10px] font-bold text-neutral-400 hover:text-red-500 transition-colors flex items-center gap-1 px-3 py-2 border-b border-neutral-100 w-full"
              >
                <XCircle size={10} />
                Limpar filtros
              </button>
            )}

            <FilterSection title="Etapa" defaultOpen={true}>
              {(STAGES || []).map(stage => (
                <CheckboxFilter
                  key={stage}
                  label={stage}
                  checked={(filters?.stages || []).includes(stage)}
                  onChange={() => toggleStageFilter(stage)}
                />
              ))}
            </FilterSection>

            <FilterSection title="Origem">
              {(STAGE_ORIGINS || []).map(origin => (
                <CheckboxFilter
                  key={origin}
                  label={origin}
                  checked={(filters?.origins || []).includes(origin)}
                  onChange={() => toggleOriginFilter(origin)}
                />
              ))}
            </FilterSection>

            <FilterSection title="Nicho do Cliente">
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type="text"
                    value={nicheSearch}
                    onChange={(e) => { setNicheSearch(e.target.value); setShowNicheSuggestions(true); }}
                    onFocus={() => setShowNicheSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowNicheSuggestions(false), 200)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddNiche()}
                    placeholder="Buscar ou adicionar nicho..."
                    className="w-full bg-white border border-slate-200 rounded-md py-2 px-3 text-xs font-medium text-black focus:outline-none focus:border-black"
                  />
                  {showNicheSuggestions && nicheSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {nicheSuggestions.map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => handleNicheSelect(s)}
                          className="w-full text-left px-3 py-2 text-xs font-medium text-black hover:bg-slate-100"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleAddNiche}
                  className="w-full py-2 text-xs font-bold text-neutral-500 hover:text-black text-center border border-dashed border-neutral-300 rounded-md"
                >
                  + Adicionar "{nicheSearch || '...'}"
                </button>
                {(filters?.niches || []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {filters.niches.map(n => (
                      <span key={n} className="px-2 py-1 bg-black text-white text-[10px] font-bold rounded-md flex items-center gap-1">
                        {n}
                        <button type="button" onClick={() => toggleNicheFilter(n)} className="hover:text-red-400">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </FilterSection>

            <FilterSection title="Data de Entrada">
              <div className="space-y-2">
                {[
                  { value: '', label: 'Todos' },
                  { value: 'today', label: 'Hoje' },
                  { value: 'week', label: 'Esta semana' },
                  { value: 'month', label: 'Este mês' }
                ].map(opt => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
                    <div className={`w-4 h-4 border rounded-full flex items-center justify-center transition-all ${filters?.dateFilter === opt.value ? 'bg-black border-black' : 'border-neutral-300 group-hover:border-black'}`}>
                      {filters?.dateFilter === opt.value && (
                        <div className="w-2 h-2 bg-white rounded-full" />
                      )}
                    </div>
                    <input 
                      type="radio" 
                      className="hidden" 
                      checked={filters?.dateFilter === opt.value}
                      onChange={() => setDateFilter(opt.value as any)}
                    />
                    <span className={`text-xs font-medium ${filters?.dateFilter === opt.value ? 'text-black' : 'text-neutral-500'}`}>{opt.label}</span>
                  </label>
                ))}
              </div>
            </FilterSection>
          </div>
        </>
      )}

      <main className="flex-1 overflow-hidden">
        <div className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-start gap-4 mb-2 md:mb-4">
            <div className="flex items-center gap-3">
              <div className="relative group">
                <button 
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className={`p-2 rounded-lg border transition-all relative ${hasActiveFilters ? 'bg-neutral-100 text-black border-neutral-200' : 'bg-transparent border-transparent text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50'}`}
                >
                  <Filter size={16} strokeWidth={hasActiveFilters ? 2.5 : 1.5} />
                  {hasActiveFilters && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
                  )}
                </button>
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-neutral-800 text-white text-[10px] font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                  Filtros
                </span>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-black tracking-tight mb-1">Leads</h1>
                <p className="text-neutral-500 text-xs md:text-sm">
                  {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''} encontrado{filteredLeads.length !== 1 ? 's' : ''}
                  {hasActiveFilters && <span className="text-neutral-400"> (filtrado{filteredLeads.length !== 1 ? 's' : ''})</span>}
                </p>
              </div>
            </div>
            <button onClick={openAdd} className="btn-primary flex items-center gap-2 whitespace-nowrap">
              <Plus size={15} strokeWidth={2.5} />
              <span className="hidden sm:inline">Novo Lead</span>
              <span className="sm:hidden text-xs">Novo</span>
            </button>
          </div>

          <div className="bg-white border border-neutral-200 rounded-md overflow-x-auto shadow-sm">
            <table className="w-full text-xs md:text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  {['Nome / Nicho', 'WhatsApp', 'Instagram', 'GMN ⭐', 'Valor', 'Etapa', 'Ações'].map(h => (
                    <th key={h} className="px-3 md:px-5 py-2 md:py-3.5 text-left text-[10px] md:text-[11px] text-neutral-400 font-semibold uppercase tracking-wider last:text-center whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {Array.isArray(filteredLeads) && filteredLeads.length > 0 ? filteredLeads.map(lead => (
                  <tr key={lead?.id} className="hover:bg-neutral-50 transition-colors group">
                    <td className="px-3 md:px-5 py-2 md:py-4">
                      <div className="font-semibold text-black text-xs md:text-sm">{lead?.name}</div>
                      <div className="text-[10px] md:text-xs text-neutral-400 truncate">{lead?.niche} · {lead?.email}</div>
                    </td>
                    <td className="px-3 md:px-5 py-2 md:py-4 text-neutral-600 text-xs md:text-sm whitespace-nowrap">
                      {lead?.whatsapp ? (
                        <div className="flex items-center gap-1.5">
                          <span>{lead.whatsapp}</span>
                          <button
                            type="button"
                            onClick={() => setWhatsAppModal({ lead, selectedTemplate: null })}
                            className="text-[#25D366] hover:text-green-600 transition-colors"
                            title="Enviar mensagem via WhatsApp"
                          >
                            <MessageCircle size={14} className="md:w-4 md:h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="px-3 md:px-5 py-2 md:py-4 text-neutral-600 text-xs md:text-sm whitespace-nowrap">{lead?.instagram}</td>
                    <td className="px-3 md:px-5 py-2 md:py-4">
                      <div className="text-black font-semibold text-xs md:text-sm">{lead?.gmnStars} ★</div>
                      <div className="text-[10px] md:text-xs text-neutral-400">{lead?.gmnReviews} avaliações</div>
                    </td>
                    <td className="px-3 md:px-5 py-2 md:py-4 text-black font-medium text-xs md:text-sm whitespace-nowrap">{lead?.value || '—'}</td>
                    <td className="px-3 md:px-5 py-2 md:py-4">
                      <span className={`px-2 md:px-2.5 py-1 rounded-md text-[10px] md:text-[11px] font-semibold ${stageStyle[lead?.stage] ?? 'bg-neutral-100 text-neutral-600'}`}>
                        {lead?.stage}
                      </span>
                    </td>
                    <td className="px-3 md:px-5 py-2 md:py-4">
                      <div className="flex items-center justify-center gap-0.5 md:gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(lead)} className="p-1 md:p-1.5 text-neutral-400 hover:text-black hover:bg-neutral-100 rounded-md transition-all">
                          <Pencil size={12} className="md:w-3.5 md:h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(lead?.id)} className="p-1 md:p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all">
                          <Trash2 size={12} className="md:w-3.5 md:h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} className="px-3 md:px-5 py-8 md:py-12 text-center text-neutral-400 font-medium italic text-xs md:text-sm">
                      {hasActiveFilters ? 'Nenhum lead encontrado com os filtros aplicados' : `Nenhum lead encontrado para "${searchTerm}"`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 w-full max-w-sm md:max-w-2xl rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-start md:items-center gap-3 px-4 md:px-7 py-3 md:py-5 border-b border-slate-100 shrink-0">
              <div>
                <h2 className="text-lg md:text-xl font-black text-black tracking-tight">
                  {mode === 'add' ? 'Novo Lead' : 'Editar Lead'}
                </h2>
                <p className="text-[10px] md:text-xs text-slate-400 mt-0.5 md:mt-0.5">
                  {mode === 'add' ? 'Preencha os dados para cadastrar um novo lead.' : `Editando: ${current.name}`}
                </p>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-black transition-colors p-1 flex-shrink-0" type="button">
                <X size={20} className="w-5 h-5 md:w-5 md:h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="overflow-y-auto flex-1">
              <div className="px-4 md:px-7 py-4 md:py-6 space-y-3 md:space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <Field label="Nome" required>
                    <input type="text" value={current.name} onChange={e => updateField('name', e.target.value)}
                      required className={inputCls} placeholder="Ex: João Silva" />
                  </Field>
                  <Field label="Nicho">
                    <input type="text" value={current.niche} onChange={e => updateField('niche', e.target.value)}
                      className={inputCls} placeholder="Ex: Odontologia" />
                  </Field>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <Field label="WhatsApp">
                    <input type="text" value={current.whatsapp} onChange={e => updateField('whatsapp', e.target.value)}
                      className={inputCls} placeholder="(11) 99999-9999" />
                  </Field>
                  <Field label="Email">
                    <input type="email" value={current.email} onChange={e => updateField('email', e.target.value)}
                      className={inputCls} placeholder="email@dominio.com" />
                  </Field>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <Field label="Instagram">
                    <input type="text" value={current.instagram} onChange={e => updateField('instagram', e.target.value)}
                      className={inputCls} placeholder="@usuario" />
                  </Field>
                  <Field label="Etapa do Pipeline">
                    <select value={current.stage} onChange={e => updateField('stage', e.target.value)}
                      className={`${inputCls} appearance-none cursor-pointer`}>
                      {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <Field label="Primeiro Contato">
                    <input type="date" value={current.firstContact} onChange={e => updateField('firstContact', e.target.value)}
                      className={`${inputCls} [color-scheme:light]`} />
                  </Field>
                  <Field label="Data de Fechamento">
                    <input type="date" value={current.closingDate} onChange={e => updateField('closingDate', e.target.value)}
                      className={`${inputCls} [color-scheme:light]`} />
                  </Field>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <Field label="Lembrete de Follow-up">
                    <input type="date" value={current.followUpReminder} onChange={e => updateField('followUpReminder', e.target.value)}
                      className={`${inputCls} [color-scheme:light]`} />
                  </Field>
                  <Field label="Valor do Contrato">
                    <input 
                      type="text" 
                      value={current.value} 
                      onChange={e => updateField('value', formatBRL(e.target.value))}
                      className={inputCls} 
                      placeholder="R$ 0,00" 
                    />
                  </Field>
                </div>

                <Field label="Endereço / Localização">
                  <input type="text" value={current.address} onChange={e => updateField('address', e.target.value)}
                    className={inputCls} placeholder="Ex: São Paulo - SP" />
                </Field>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <Field label="Quantidade de Avaliações GMN">
                    <input type="number" min="0" value={current.gmnReviews} onChange={e => updateField('gmnReviews', e.target.value)}
                      className={inputCls} placeholder="Ex: 248" />
                  </Field>
                  <Field label="Média de Estrelas GMN">
                    <input type="number" min="0" max="5" step="0.1" value={current.gmnStars} onChange={e => updateField('gmnStars', e.target.value)}
                      className={inputCls} placeholder="Ex: 4.7" />
                  </Field>
                </div>

                <Field label="Observações">
                  <textarea value={current.notes} onChange={e => updateField('notes', e.target.value)}
                    rows={4} className={`${inputCls} resize-none`}
                    placeholder="Notas internas, contexto do lead..." />
                </Field>
              </div>

              <div className="flex flex-col md:flex-row gap-2 md:gap-3 px-4 md:px-7 py-3 md:py-5 border-t border-slate-100 shrink-0 bg-white">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 px-4 py-2 md:py-3 rounded-md bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-colors text-xs md:text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 bg-black text-white px-4 py-2 md:py-3 rounded-md font-bold hover:bg-neutral-800 active:scale-[0.98] transition-all text-xs md:text-sm"
                >
                  <Save size={15} strokeWidth={2.5} />
                  {mode === 'add' ? 'Criar' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>

    {whatsAppModal.lead && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-white border border-neutral-200 rounded-2xl p-8 max-w-md w-full shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black text-black">Enviar mensagem via WhatsApp</h3>
            <button onClick={() => setWhatsAppModal({ lead: null, selectedTemplate: null })} className="text-neutral-400 hover:text-black">
              <X size={20} />
            </button>
          </div>
          <div className="mb-4">
            <p className="text-sm text-neutral-600">Lead: <span className="font-bold">{whatsAppModal.lead.name}</span></p>
            <p className="text-sm text-neutral-600">WhatsApp: <span className="font-bold">{whatsAppModal.lead.whatsapp}</span></p>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-black text-neutral-500 uppercase tracking-widest mb-2">Escolha uma mensagem rápida:</p>
            {WHATSAPP_MESSAGE_TEMPLATES.map(template => (
              <button
                key={template.id}
                type="button"
                onClick={() => {
                  const message = template.template(whatsAppModal.lead.name, employeeName || 'Usuário');
                  const link = generateWhatsAppLink(whatsAppModal.lead.whatsapp, message);
                  window.open(link, '_blank');
                  setWhatsAppModal({ lead: null, selectedTemplate: null });
                }}
                className="w-full p-4 text-left border border-neutral-200 rounded-lg hover:bg-neutral-50 hover:border-neutral-300 transition-colors"
              >
                <div className="font-bold text-black text-sm">{template.label}</div>
                <div className="text-xs text-neutral-500 mt-1">
                  {template.template(whatsAppModal.lead.name, employeeName || 'Usuário').substring(0, 60)}...
                </div>
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                const link = generateWhatsAppLink(whatsAppModal.lead.whatsapp);
                window.open(link, '_blank');
                setWhatsAppModal({ lead: null, selectedTemplate: null });
              }}
              className="w-full p-4 text-left border border-dashed border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors text-sm text-neutral-500"
            >
              Abrir sem mensagem personalizada
            </button>
          </div>
        </div>
      </div>
    )}
  );
};

export default function LeadsPage() {
  return <CRMleads />;
}