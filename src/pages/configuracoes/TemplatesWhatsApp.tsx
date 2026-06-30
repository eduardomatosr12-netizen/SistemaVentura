import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Plus, Pencil, Trash2, X, Save, Copy,
  ChevronUp, ChevronDown,
  MessageCircle, AlertCircle, CheckCircle2, ToggleLeft, ToggleRight
} from 'lucide-react';
import {
  subscribeTemplates, addTemplate, updateTemplate,
  deleteTemplate, duplicateTemplate, moveTemplateUp, moveTemplateDown,
  fetchTemplates,
} from '../../services/whatsappTemplateService';
import { fillTemplate, TEMPLATE_VARIABLES, type WhatsAppTemplate } from '../../lib/whatsappTemplates';

type FormMode = 'create' | 'edit';

const TemplatesWhatsApp = () => {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [formId, setFormId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [formErrors, setFormErrors] = useState<{ name?: string; message?: string }>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const unsub = subscribeTemplates(tpls => {
      setTemplates(tpls.sort((a, b) => a.order - b.order));
    });
    return () => unsub();
  }, []);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const refreshTemplates = async () => {
    const tpls = await fetchTemplates();
    setTemplates(tpls.sort((a, b) => a.order - b.order));
  };

  const openCreate = () => {
    setFormMode('create');
    setFormId(null);
    setFormName('');
    setFormMessage('');
    setFormActive(true);
    setFormErrors({});
    setFormOpen(true);
  };

  const openEdit = (tpl: WhatsAppTemplate) => {
    setFormMode('edit');
    setFormId(tpl.id);
    setFormName(tpl.name);
    setFormMessage(tpl.message);
    setFormActive(tpl.active);
    setFormErrors({});
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setFormId(null);
    setFormName('');
    setFormMessage('');
    setFormActive(true);
    setFormErrors({});
  };

  const handleInsertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setFormMessage(prev => prev + variable);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newMessage = formMessage.substring(0, start) + variable + formMessage.substring(end);
    setFormMessage(newMessage);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + variable.length;
    });
  };

  const previewMessage = useMemo(() => {
    if (!formMessage) return '';
    const exampleValues: Record<string, string> = {};
    TEMPLATE_VARIABLES.forEach(v => {
      exampleValues[v.key.replace(/[{}]/g, '')] = v.example;
    });
    return fillTemplate(formMessage, exampleValues);
  }, [formMessage]);

  const handleSave = async () => {
    const errors: { name?: string; message?: string } = {};
    if (!formName.trim()) errors.name = 'Nome é obrigatório';
    if (!formMessage.trim()) errors.message = 'Mensagem é obrigatória';
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      if (formMode === 'create') {
        await addTemplate({ name: formName.trim(), message: formMessage.trim(), active: formActive });
        showToast('success', 'Template criado com sucesso!');
      } else if (formId) {
        await updateTemplate(formId, { name: formName.trim(), message: formMessage.trim(), active: formActive });
        showToast('success', 'Template atualizado com sucesso!');
      }
    } catch (err) {
      console.error('[Templates] Erro ao salvar:', err);
      showToast('error', 'Erro ao salvar no Firestore');
    }
    await refreshTemplates();
    closeForm();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Excluir o template "${name}"?`)) return;
    try {
      await deleteTemplate(id);
      await refreshTemplates();
      showToast('success', 'Template excluído com sucesso!');
    } catch (err) {
      console.error('[Templates] Erro ao excluir:', err);
      showToast('error', 'Erro ao excluir do Firestore');
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const result = await duplicateTemplate(id);
      if (result) {
        await refreshTemplates();
        showToast('success', 'Template duplicado com sucesso!');
      }
    } catch (err) {
      console.error('[Templates] Erro ao duplicar:', err);
      showToast('error', 'Erro ao duplicar no Firestore');
    }
  };

  const handleToggleActive = async (tpl: WhatsAppTemplate) => {
    try {
      await updateTemplate(tpl.id, { active: !tpl.active });
      await refreshTemplates();
    } catch (err) {
      console.error('[Templates] Erro ao alterar status:', err);
    }
    showToast('success', `Template ${tpl.active ? 'desativado' : 'ativado'} com sucesso!`);
  };

  const handleMoveUp = async (id: string) => {
    await moveTemplateUp(id);
    await refreshTemplates();
  };

  const handleMoveDown = async (id: string) => {
    await moveTemplateDown(id);
    await refreshTemplates();
  };

  return (
    <div className="min-h-screen pb-20 relative">
      {toast && (
        <div className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl border animate-in slide-in-from-top-4 duration-300 ${
          toast.type === 'success'
            ? 'bg-[#0a0a0a] border-[#B5FF03]/30 text-[#B5FF03]'
            : 'bg-[#0a0a0a] border-red-500/30 text-red-400'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span className="text-sm font-bold">{toast.message}</span>
        </div>
      )}

      <div className="mb-10 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-[#ffffff] tracking-tighter mb-1">Templates de WhatsApp</h1>
          <p className="text-[#aaaaaa] text-sm font-medium">Gerencie seus modelos de mensagens rápidas para WhatsApp.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-5 py-3 bg-[#B5FF03] text-black font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-[#a1e600] transition-all active:scale-[0.97]"
        >
          <Plus size={16} /> Novo Template
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="bg-[#111] border border-[#333] rounded-3xl p-12 text-center">
          <div className="w-16 h-16 bg-[#1a1a1a] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MessageCircle size={28} className="text-neutral-500" />
          </div>
          <p className="text-white font-bold text-lg mb-1">Nenhum template cadastrado</p>
          <p className="text-neutral-400 text-sm">Clique em "Novo Template" para criar o primeiro modelo.</p>
        </div>
      ) : (
        <div className="bg-[#0a0a0a] border border-[#333] rounded-2xl overflow-hidden">
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#222] bg-[#111]">
                  <th className="w-16 px-4 py-3.5 text-[10px] text-[#B5FF03] font-black uppercase tracking-widest text-center">#</th>
                  <th className="px-4 py-3.5 text-[10px] text-[#B5FF03] font-black uppercase tracking-widest text-left">Nome</th>
                  <th className="px-4 py-3.5 text-[10px] text-[#B5FF03] font-black uppercase tracking-widest text-left">Preview</th>
                  <th className="w-24 px-4 py-3.5 text-[10px] text-[#B5FF03] font-black uppercase tracking-widest text-center">Status</th>
                  <th className="w-48 px-4 py-3.5 text-[10px] text-[#B5FF03] font-black uppercase tracking-widest text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222]">
                {templates.map((tpl, idx) => (
                  <tr key={tpl.id} className="hover:bg-[#111] transition-colors group">
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          onClick={() => handleMoveUp(tpl.id)}
                          disabled={idx === 0}
                          className={`p-0.5 rounded transition-colors ${idx === 0 ? 'text-neutral-600 cursor-not-allowed' : 'text-neutral-400 hover:text-white hover:bg-[#222]'}`}
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          onClick={() => handleMoveDown(tpl.id)}
                          disabled={idx === templates.length - 1}
                          className={`p-0.5 rounded transition-colors ${idx === templates.length - 1 ? 'text-neutral-600 cursor-not-allowed' : 'text-neutral-400 hover:text-white hover:bg-[#222]'}`}
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-white text-sm">{tpl.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-neutral-400 truncate max-w-md">
                        {tpl.message.substring(0, 80)}{tpl.message.length > 80 ? '...' : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        tpl.active
                          ? 'bg-[#B5FF03]/10 text-[#B5FF03]'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}>
                        {tpl.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(tpl)} className="p-1.5 text-neutral-400 hover:text-white hover:bg-[#222] rounded-lg transition-all" title="Editar">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDuplicate(tpl.id)} className="p-1.5 text-neutral-400 hover:text-white hover:bg-[#222] rounded-lg transition-all" title="Duplicar">
                          <Copy size={14} />
                        </button>
                        <button onClick={() => handleToggleActive(tpl)} className={`p-1.5 rounded-lg transition-all ${tpl.active ? 'text-neutral-400 hover:text-[#B5FF03] hover:bg-[#222]' : 'text-[#B5FF03] hover:bg-[#222]'}`} title={tpl.active ? 'Desativar' : 'Ativar'}>
                          {tpl.active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                        </button>
                        <button onClick={() => handleDelete(tpl.id, tpl.name)} className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all" title="Excluir">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-[#222]">
            {templates.map((tpl, idx) => (
              <div key={tpl.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">{tpl.name}</span>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                    tpl.active
                      ? 'bg-[#B5FF03]/10 text-[#B5FF03]'
                      : 'bg-neutral-800 text-neutral-400'
                  }`}>
                    {tpl.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  {tpl.message.substring(0, 80)}{tpl.message.length > 80 ? '...' : ''}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button onClick={() => handleMoveUp(tpl.id)} disabled={idx === 0} className={`p-1.5 rounded-lg ${idx === 0 ? 'text-neutral-600' : 'text-neutral-400 hover:text-white hover:bg-[#222]'}`}>
                    <ChevronUp size={14} />
                  </button>
                  <button onClick={() => handleMoveDown(tpl.id)} disabled={idx === templates.length - 1} className={`p-1.5 rounded-lg ${idx === templates.length - 1 ? 'text-neutral-600' : 'text-neutral-400 hover:text-white hover:bg-[#222]'}`}>
                    <ChevronDown size={14} />
                  </button>
                  <div className="flex-1" />
                  <button onClick={() => openEdit(tpl)} className="p-2 text-neutral-400 hover:text-white hover:bg-[#222] rounded-lg transition-all">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDuplicate(tpl.id)} className="p-2 text-neutral-400 hover:text-white hover:bg-[#222] rounded-lg transition-all">
                    <Copy size={14} />
                  </button>
                  <button onClick={() => handleToggleActive(tpl)} className={`p-2 rounded-lg ${tpl.active ? 'text-neutral-400' : 'text-[#B5FF03]'}`}>
                    {tpl.active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                  </button>
                  <button onClick={() => handleDelete(tpl.id, tpl.name)} className="p-2 text-neutral-400 hover:text-red-500 rounded-lg transition-all">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-6 bg-black/60 backdrop-blur-md" onClick={closeForm}>
          <div
            className="bg-[#0a0a0a] border border-[#333] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#333] shrink-0">
              <div>
                <span className="text-[10px] font-black text-neutral-500 uppercase tracking-[3px] mb-1 block">Gerenciamento de Templates</span>
                <h2 className="text-xl font-black text-white tracking-tight">
                  {formMode === 'create' ? 'Novo Template' : 'Editar Template'}
                </h2>
              </div>
              <button onClick={closeForm} className="p-2 hover:bg-[#222] rounded-xl transition-colors text-neutral-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">
                  Nome do Template <span className="text-white">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => { setFormName(e.target.value); setFormErrors(prev => ({ ...prev, name: undefined })); }}
                  placeholder="Ex: Saudação inicial, Envio de proposta..."
                  className={`w-full bg-[#1a1a1a] border rounded-xl px-4 py-3 font-bold text-white placeholder-neutral-600 focus:outline-none transition-colors ${
                    formErrors.name ? 'border-red-500/50' : 'border-[#333] focus:border-[#B5FF03]'
                  }`}
                />
                {formErrors.name && <p className="text-[10px] text-red-400 font-medium ml-1">{formErrors.name}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">
                  Mensagem <span className="text-white">*</span>
                </label>
                <textarea
                  ref={textareaRef}
                  value={formMessage}
                  onChange={(e) => { setFormMessage(e.target.value); setFormErrors(prev => ({ ...prev, message: undefined })); }}
                  placeholder="Digite a mensagem do template... Use as variáveis abaixo para personalizar."
                  rows={8}
                  className={`w-full bg-[#1a1a1a] border rounded-xl px-4 py-3 font-bold text-white placeholder-neutral-600 focus:outline-none transition-colors resize-none ${
                    formErrors.message ? 'border-red-500/50' : 'border-[#333] focus:border-[#B5FF03]'
                  }`}
                />
                {formErrors.message && <p className="text-[10px] text-red-400 font-medium ml-1">{formErrors.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Inserir Variáveis</label>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATE_VARIABLES.map(v => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => handleInsertVariable(v.key)}
                      className="px-3 py-1.5 bg-[#222] border border-[#444] rounded-lg text-[11px] font-bold text-[#B5FF03] hover:bg-[#333] hover:border-[#B5FF03] transition-all"
                      title={v.label}
                    >
                      {v.key}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-neutral-500 font-medium ml-1">Clique em uma variável para inseri-la na posição do cursor.</p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Preview da Mensagem</label>
                <div className="bg-black/40 border border-dashed border-[#444] rounded-xl px-4 py-4 min-h-[80px]">
                  {previewMessage ? (
                    <p className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap">{previewMessage}</p>
                  ) : (
                    <p className="text-xs text-neutral-600 italic">Digite a mensagem para ver o preview com valores de exemplo.</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Template Ativo</span>
                <button
                  type="button"
                  onClick={() => setFormActive(!formActive)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${formActive ? 'bg-[#B5FF03]' : 'bg-[#333]'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${formActive ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
                <span className={`text-xs font-bold ${formActive ? 'text-[#B5FF03]' : 'text-neutral-500'}`}>
                  {formActive ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#333] shrink-0 flex items-center gap-3">
              <button
                onClick={closeForm}
                className="px-5 py-2.5 text-xs font-bold text-neutral-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <div className="flex-1" />
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#B5FF03] text-black font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-[#a1e600] transition-all active:scale-[0.97]"
              >
                <Save size={15} />
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplatesWhatsApp;
