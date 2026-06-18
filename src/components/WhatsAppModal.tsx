import { useState, useMemo, useRef, useEffect } from 'react';
import { X, MessageCircle, Edit3, Send, ChevronDown, ChevronUp, AlertCircle, ExternalLink } from 'lucide-react';
import { cleanPhoneNumber, generateWhatsAppLink } from '../lib/whatsapp';
import { subscribeTemplates } from '../services/whatsappTemplateService';
import { fillTemplate, type WhatsAppTemplate } from '../lib/whatsappTemplates';
import { useAuth } from '../contexts/AuthContext';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadName: string;
  leadWhatsapp: string;
  leadEvent?: string;
  leadEventDate?: string;
  leadValue?: string;
  onEditLead?: () => void;
}

function formatDateBR(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('pt-BR');
}

const WhatsAppModal = ({
  isOpen,
  onClose,
  leadName,
  leadWhatsapp,
  leadEvent,
  leadEventDate,
  leadValue,
  onEditLead,
}: WhatsAppModalProps) => {
  const { employeeName } = useAuth();
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedMessage, setEditedMessage] = useState('');
  const [expandedTemplates, setExpandedTemplates] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [allTemplates, setAllTemplates] = useState<WhatsAppTemplate[]>([]);

  useEffect(() => {
    const unsub = subscribeTemplates(tpls => {
      setAllTemplates(tpls);
    });
    return () => unsub();
  }, []);

  const templates = useMemo(() => {
    return allTemplates.filter(t => t.active).sort((a, b) => a.order - b.order);
  }, [allTemplates]);

  const hasPhone = leadWhatsapp && leadWhatsapp.replace(/\D/g, '').length >= 10;

  const variableValues = useMemo(() => ({
    nome: leadName,
    evento: leadEvent || 'evento',
    data_evento: formatDateBR(leadEventDate),
    valor: leadValue || 'R$ 0,00',
    responsavel: employeeName || 'Usuário',
    empresa: 'Ventura Luz e Efeitos',
  }), [leadName, leadEvent, leadEventDate, leadValue, employeeName]);

  const previewMessage = useMemo(() => {
    if (!selectedTemplate) return '';
    return fillTemplate(editedMessage || selectedTemplate.message, variableValues);
  }, [selectedTemplate, editedMessage, variableValues]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedTemplate(null);
      setIsEditing(false);
      setEditedMessage('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const handleSelectTemplate = (tpl: WhatsAppTemplate) => {
    setSelectedTemplate(tpl);
    setEditedMessage(tpl.message);
    setIsEditing(false);
  };

  const handleOpenWhatsApp = (message: string) => {
    const link = generateWhatsAppLink(leadWhatsapp, message);
    window.open(link, '_blank');
  };

  const handleSendNow = () => {
    if (!previewMessage) return;
    handleOpenWhatsApp(previewMessage);
    onClose();
  };

  const handleSendWithoutMessage = () => {
    handleOpenWhatsApp('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#111] border border-[#333] rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#333] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#25D366]/20 flex items-center justify-center">
              <MessageCircle size={18} className="text-[#25D366]" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Enviar via WhatsApp</h3>
              <p className="text-[10px] text-neutral-400 font-medium">{leadName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[#222] rounded-lg transition-colors">
            <X size={16} className="text-neutral-400" />
          </button>
        </div>

        {!hasPhone ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-red-900/20 flex items-center justify-center mx-auto">
              <AlertCircle size={24} className="text-red-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Telefone não cadastrado</p>
              <p className="text-xs text-neutral-400 mt-1">
                Este cliente não possui telefone ou o número é inválido.
              </p>
            </div>
            {onEditLead && (
              <button
                onClick={() => { onClose(); onEditLead(); }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#B5FF03] text-black font-bold text-xs uppercase tracking-widest rounded-lg hover:bg-[#a1e600] transition-colors"
              >
                <Edit3 size={14} /> Editar Cadastro
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="px-6 py-4 border-b border-[#333]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">WhatsApp</span>
              </div>
              <p className="text-sm font-bold text-white mt-1">{leadWhatsapp}</p>
            </div>

            <div className="px-6 py-4 border-b border-[#333]">
              <button
                onClick={() => setExpandedTemplates(!expandedTemplates)}
                className="flex items-center justify-between w-full text-left"
              >
                <span className="text-[10px] font-black text-white uppercase tracking-widest">
                  Templates de Mensagem
                </span>
                {expandedTemplates ? <ChevronUp size={14} className="text-neutral-400" /> : <ChevronDown size={14} className="text-neutral-400" />}
              </button>

              {expandedTemplates && (
                <div className="mt-3 space-y-2">
                  {templates.map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => handleSelectTemplate(tpl)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        selectedTemplate?.id === tpl.id
                          ? 'border-[#B5FF03] bg-[#B5FF03]/5'
                          : 'border-[#333] hover:border-[#555] bg-[#0a0a0a]'
                      }`}
                    >
                      <span className={`text-xs font-bold ${selectedTemplate?.id === tpl.id ? 'text-[#B5FF03]' : 'text-white'}`}>
                        {tpl.name}
                      </span>
                      <p className="text-[10px] text-neutral-500 mt-0.5 truncate">
                        {fillTemplate(tpl.message, variableValues).substring(0, 60)}...
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedTemplate && (
              <div className="px-6 py-4 border-b border-[#333]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">
                    {isEditing ? 'Editar Mensagem' : 'Preview da Mensagem'}
                  </span>
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                      isEditing
                        ? 'bg-[#B5FF03] text-black'
                        : 'bg-[#222] text-neutral-300 hover:bg-[#333]'
                    }`}
                  >
                    <Edit3 size={12} />
                    {isEditing ? 'Concluir' : 'Editar antes de enviar'}
                  </button>
                </div>

                {isEditing ? (
                  <textarea
                    ref={textareaRef}
                    value={editedMessage}
                    onChange={(e) => setEditedMessage(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#333] rounded-xl px-4 py-3 text-sm text-white focus:border-[#B5FF03] outline-none transition-colors resize-none"
                    rows={5}
                  />
                ) : (
                  <div className="bg-[#0a0a0a] border border-[#333] rounded-xl px-4 py-3">
                    <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{previewMessage}</p>
                  </div>
                )}

                {isEditing && (
                  <div className="mt-3">
                    <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mb-2">Preview:</p>
                    <div className="bg-black/40 border border-dashed border-[#333] rounded-xl px-4 py-3">
                      <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">{fillTemplate(editedMessage, variableValues)}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="px-6 py-4 border-t border-[#333] shrink-0 flex items-center gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-bold text-neutral-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <div className="flex-1" />
          <button
            onClick={handleSendWithoutMessage}
            className="px-4 py-2.5 text-[10px] font-bold text-neutral-500 hover:text-white border border-[#333] hover:border-[#555] rounded-lg transition-all uppercase tracking-widest"
          >
            Sem Mensagem
          </button>
          {selectedTemplate && hasPhone && (
            <button
              onClick={handleSendNow}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#25D366] text-white font-bold text-xs rounded-lg hover:bg-[#20bd5a] transition-colors"
            >
              <ExternalLink size={14} />
              Abrir no WhatsApp
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WhatsAppModal;
