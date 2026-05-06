import { useState, useEffect } from 'react';
import { X, MessageSquare, CreditCard, Shield, Key, Loader2, CheckCircle2, Share2, Globe } from 'lucide-react';

interface Integration {
  id: string;
  name: string;
  description: string;
  connected: boolean;
  icon?: any;
  type?: 'default' | 'n8n';
}

const CRMIntegracoes = () => {
  const [integrations, setIntegrations] = useState<Integration[]>([
    { id: 'whatsapp', name: 'WhatsApp', description: 'Envio de notificações automáticas e mensagens diretas', connected: false, icon: MessageSquare },
    { id: 'asaas', name: 'Asaas', description: 'Automação de cobranças e faturamento via Financeiro', connected: false, icon: CreditCard },
    { id: 'n8n', name: 'n8n', description: 'Orquestrador de fluxos de dados e automações complexas', connected: false, icon: Share2, type: 'n8n' },
    { id: 'salesforce', name: 'Salesforce', description: 'Sincronização completa de leads e contatos', connected: true },
    { id: 'google', name: 'Google Workspace', description: 'Integração com Gmail e Google Contacts', connected: false },
    { id: 'mailchimp', name: 'Mailchimp', description: 'Sincronização com listas de email', connected: false },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Load local storage states
    const whatsappConnected = localStorage.getItem('axium_int_whatsapp') === 'true';
    const asaasConnected = localStorage.getItem('axium_int_asaas') === 'true';
    const n8nConnected = localStorage.getItem('axium_int_n8n') === 'true';
    
    setIntegrations(prev => prev.map(int => {
      if (int.id === 'whatsapp') return { ...int, connected: whatsappConnected };
      if (int.id === 'asaas') return { ...int, connected: asaasConnected };
      if (int.id === 'n8n') return { ...int, connected: n8nConnected };
      return int;
    }));
  }, []);

  const handleConnectClick = (integration: Integration) => {
    if (integration.connected) {
      localStorage.removeItem(`axium_int_${integration.id}`);
      localStorage.removeItem(`axium_key_${integration.id}`);
      if (integration.type === 'n8n') localStorage.removeItem('axium_webhook_n8n');
      
      setIntegrations(prev => prev.map(int => int.id === integration.id ? { ...int, connected: false } : int));
      return;
    }
    setSelectedIntegration(integration);
    setApiKey('');
    setWebhookUrl('');
    setIsModalOpen(true);
  };

  const handleSaveConnection = () => {
    if (!selectedIntegration || !apiKey) return;
    if (selectedIntegration.type === 'n8n' && !webhookUrl) return;
    
    setIsSaving(true);
    
    setTimeout(() => {
      localStorage.setItem(`axium_int_${selectedIntegration.id}`, 'true');
      localStorage.setItem(`axium_key_${selectedIntegration.id}`, apiKey);
      if (selectedIntegration.type === 'n8n') localStorage.setItem('axium_webhook_n8n', webhookUrl);
      
      setIntegrations(prev => prev.map(int => int.id === selectedIntegration.id ? { ...int, connected: true } : int));
      setIsSaving(false);
      setIsModalOpen(false);
      setSelectedIntegration(null);
    }, 1500);
  };

  return (
    <div className="min-h-screen">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-black text-black tracking-tight mb-1">Integrações</h1>
        <p className="text-neutral-500 text-xs md:text-sm">Conecte o CRM com outras ferramentas e plataformas.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
        {integrations.map((integration, idx) => {
          const Icon = integration.icon || Shield;
          return (
            <div key={idx} className="bg-white border border-neutral-200 rounded-2xl p-8 hover:border-black transition-all group shadow-sm">
              <div className="flex items-start justify-between mb-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                  integration.connected ? 'bg-black text-white' : 'bg-neutral-50 text-neutral-400 group-hover:bg-neutral-100'
                }`}>
                  <Icon size={24} />
                </div>
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                  integration.connected ? 'bg-emerald-50 text-emerald-600' : 'bg-neutral-50 text-neutral-400'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${integration.connected ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-300'}`} />
                  {integration.connected ? 'Conectado' : 'Disponível'}
                </span>
              </div>
              
              <h3 className="font-black text-lg text-black mb-2">{integration.name}</h3>
              <p className="text-xs text-neutral-500 font-bold leading-relaxed mb-8 h-10 line-clamp-2">
                {integration.description}
              </p>
              
              <button 
                onClick={() => handleConnectClick(integration)}
                className={`w-full py-3.5 rounded-md text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98] ${
                  integration.connected
                    ? 'bg-neutral-50 text-neutral-600 hover:bg-red-50 hover:text-red-600 hover:border-red-100 border border-transparent'
                    : 'bg-black text-white hover:bg-neutral-800 shadow-sm'
                }`}
              >
                {integration.connected ? 'Desconectar' : 'Configurar Conexão'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Connection Modal */}
      {isModalOpen && selectedIntegration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-neutral-200 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform animate-in slide-in-from-bottom-4 duration-300">
            <div className="px-8 py-7 border-b border-neutral-100 flex justify-between items-start">
              <div>
                <span className="text-[9px] font-black text-neutral-400 uppercase tracking-[2px] mb-2 block">Integração Oficial</span>
                <h2 className="text-2xl font-black text-black tracking-tighter leading-tight">Conectar {selectedIntegration.name}</h2>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-neutral-100 rounded-full transition-colors text-neutral-400 hover:text-black"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="bg-neutral-50 rounded-2xl p-4 flex gap-4 items-center">
                <div className="w-10 h-10 bg-white rounded-md shadow-sm flex items-center justify-center text-black shrink-0">
                  {selectedIntegration.icon ? <selectedIntegration.icon size={20} /> : <Shield size={20} />}
                </div>
                <p className="text-[11px] text-neutral-500 font-bold leading-tight italic">
                  "Esta conexão permitirá que o CRM envie comandos diretamente para sua conta {selectedIntegration.name}."
                </p>
              </div>

              {selectedIntegration.type === 'n8n' && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[9px] font-black text-neutral-400 uppercase tracking-widest">
                    <Globe size={12} strokeWidth={3} />
                    n8n Webhook URL
                  </label>
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://sua-instancia.n8n.cloud/webhook/..."
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-md px-4 py-3 text-sm font-black text-black focus:ring-1 focus:ring-black outline-none transition-all placeholder:text-neutral-300"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[9px] font-black text-neutral-400 uppercase tracking-widest">
                  <Key size={12} strokeWidth={3} />
                  API Key / Token
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Insira seu token de acesso..."
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-md px-4 py-3 text-sm font-black text-black focus:ring-1 focus:ring-black outline-none transition-all placeholder:text-neutral-300"
                />
              </div>
            </div>

            <div className="px-8 py-6 bg-neutral-50 flex gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-3.5 rounded-md font-black text-[10px] uppercase tracking-widest text-neutral-400 hover:text-black transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveConnection}
                disabled={!apiKey || (selectedIntegration.type === 'n8n' && !webhookUrl) || isSaving}
                className="flex-[2] bg-black text-white py-3.5 rounded-md font-black text-[10px] uppercase tracking-widest hover:bg-neutral-800 transition-all active:scale-[0.98] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Autenticando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    Confirmar Conexão
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMIntegracoes;
