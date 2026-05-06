/**
 * Utility functions for WhatsApp integration
 */

/**
 * Cleans a phone number by removing parentheses, spaces, hyphens and other non-numeric characters
 * Ensures the number starts with the country code (55 for Brazil)
 */
export function cleanPhoneNumber(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, '');
  
  // If it doesn't start with 55 (Brazil country code), add it
  if (cleaned.length > 0 && !cleaned.startsWith('55')) {
    // If it starts with 0, remove it
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    // Add Brazil country code
    cleaned = '55' + cleaned;
  }
  
  return cleaned;
}

/**
 * Generates a WhatsApp link (wa.me) for a given phone number
 */
export function generateWhatsAppLink(phone: string, message?: string): string {
  const cleaned = cleanPhoneNumber(phone);
  if (!cleaned) return '';
  
  let url = `https://wa.me/${cleaned}`;
  
  if (message) {
    url += `?text=${encodeURIComponent(message)}`;
  }
  
  return url;
}

/**
 * Quick message templates for WhatsApp
 */
export const WHATSAPP_MESSAGE_TEMPLATES = [
  {
    id: 'greeting',
    label: 'Saudação',
    template: (leadName: string, userName: string) => 
      `Olá ${leadName}! Tudo bem? Aqui é o ${userName} da Axium. Como posso ajudar?`,
  },
  {
    id: 'followup',
    label: 'Acompanhamento',
    template: (leadName: string, userName: string) => 
      `${leadName}, tudo bem? Estou passando para saber se você já conseguiu resolver aquela questão. Atenciosamente, ${userName}.`,
  },
  {
    id: 'proposal',
    label: 'Enviar Proposta',
    template: (leadName: string, userName: string) => 
      `${leadName}, preparei uma proposta especial para você! Podemos conversar sobre ela agora? ${userName}.`,
  },
];
