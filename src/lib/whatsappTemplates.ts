export interface WhatsAppTemplate {
  id: string;
  name: string;
  message: string;
  active: boolean;
  order: number;
}

const STORAGE_KEY = 'ventura_whatsapp_templates';

const DEFAULT_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'default-1',
    name: 'Saudação',
    message: 'Olá {nome}! Tudo bem? Aqui é {responsavel} da {empresa}. Gostaria de conversar sobre o seu evento. Pode falar agora?',
    active: true,
    order: 0,
  },
  {
    id: 'default-2',
    name: 'Envio de proposta',
    message: 'Olá {nome}! Preparei uma proposta para o evento *{evento}* no dia {data_evento}. O investimento total é de *{valor}*. Posso te enviar os detalhes completos?',
    active: true,
    order: 1,
  },
  {
    id: 'default-3',
    name: 'Acompanhamento',
    message: 'Oi {nome}, tudo bem? Estou passando para saber se você teve a oportunidade de analisar nossa proposta para o {evento}. Ficou com alguma dúvida?',
    active: true,
    order: 2,
  },
];

export function getTemplates(): WhatsAppTemplate[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_TEMPLATES;
}

export function saveTemplates(templates: WhatsAppTemplate[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function addTemplate(input: { name: string; message: string; active?: boolean }): WhatsAppTemplate {
  const templates = getTemplates();
  const newTemplate: WhatsAppTemplate = {
    id: crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2),
    name: input.name,
    message: input.message,
    active: input.active ?? true,
    order: templates.length,
  };
  templates.push(newTemplate);
  saveTemplates(templates);
  return newTemplate;
}

export function updateTemplate(id: string, updates: Partial<WhatsAppTemplate>): void {
  const templates = getTemplates();
  const index = templates.findIndex(t => t.id === id);
  if (index !== -1) {
    templates[index] = { ...templates[index], ...updates };
    saveTemplates(templates);
  }
}

export function deleteTemplate(id: string): void {
  let templates = getTemplates();
  templates = templates.filter(t => t.id !== id);
  templates.forEach((t, i) => { t.order = i; });
  saveTemplates(templates);
}

export function duplicateTemplate(id: string): WhatsAppTemplate | null {
  const templates = getTemplates();
  const source = templates.find(t => t.id === id);
  if (!source) return null;
  const duplicate: WhatsAppTemplate = {
    ...source,
    id: crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2),
    name: `${source.name} (cópia)`,
    order: templates.length,
  };
  templates.push(duplicate);
  saveTemplates(templates);
  return duplicate;
}

export function reorderTemplates(ids: string[]): void {
  const templates = getTemplates();
  const reordered = ids
    .map((id, i) => {
      const t = templates.find(t => t.id === id);
      if (t) return { ...t, order: i };
      return null;
    })
    .filter(Boolean) as WhatsAppTemplate[];
  saveTemplates(reordered);
}

export function moveTemplateUp(id: string): void {
  const templates = getTemplates();
  const idx = templates.findIndex(t => t.id === id);
  if (idx <= 0) return;
  const temp = templates[idx];
  templates[idx] = { ...templates[idx - 1], order: idx };
  templates[idx - 1] = { ...temp, order: idx - 1 };
  saveTemplates(templates);
}

export function moveTemplateDown(id: string): void {
  const templates = getTemplates();
  const idx = templates.findIndex(t => t.id === id);
  if (idx === -1 || idx >= templates.length - 1) return;
  const temp = templates[idx];
  templates[idx] = { ...templates[idx + 1], order: idx };
  templates[idx + 1] = { ...temp, order: idx + 1 };
  saveTemplates(templates);
}

export interface TemplateVariable {
  key: string;
  label: string;
  example: string;
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  { key: '{nome}', label: 'Nome do cliente', example: 'João Silva' },
  { key: '{evento}', label: 'Nome do evento', example: 'Casamento' },
  { key: '{data_evento}', label: 'Data do evento', example: '15/12/2026' },
  { key: '{valor}', label: 'Valor total', example: 'R$ 15.000,00' },
  { key: '{responsavel}', label: 'Responsável', example: 'Maria' },
  { key: '{empresa}', label: 'Empresa', example: 'Ventura Luz e Efeitos' },
];

export function fillTemplate(
  message: string,
  vars: Record<string, string>
): string {
  return message.replace(/\{(\w+)\}/g, (_, key) => {
    return vars[key] ?? `{${key}}`;
  });
}
