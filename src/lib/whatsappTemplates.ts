export interface WhatsAppTemplate {
  id: string;
  name: string;
  message: string;
  active: boolean;
  order: number;
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
