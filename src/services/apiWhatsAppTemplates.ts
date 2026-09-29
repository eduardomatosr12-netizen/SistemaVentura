import { api, type ApiError } from '../lib/apiClient.ts';

export interface WhatsAppTemplate {
  id: string;
  name: string;
  content: string;
  category?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const whatsappTemplatesApi = {
  list: () => api.get<WhatsAppTemplate[]>('/whatsapp-templates'),
  get: (id: string) => api.get<WhatsAppTemplate>(`/whatsapp-templates/${id}`),
  create: (data: Omit<WhatsAppTemplate, 'id' | 'createdAt' | 'updatedAt'>) => api.post<WhatsAppTemplate>('/whatsapp-templates', data),
  update: (id: string, data: Partial<WhatsAppTemplate>) => api.put<WhatsAppTemplate>(`/whatsapp-templates/${id}`, data),
  delete: (id: string) => api.delete<void>(`/whatsapp-templates/${id}`),
};

export const handleApiError = (error: unknown, fallback: string): string => {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
};
