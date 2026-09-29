import { api, type ApiError } from '../lib/apiClient.ts';

export interface Lead {
  id: string;
  name: string;
  niche: string;
  whatsapp: string;
  email: string;
  instagram?: string;
  stage: string;
  origin?: string;
  firstContact: string;
  closingDate?: string;
  followUpReminder?: string;
  address?: string;
  notes?: string;
  value: string;
  items?: any[];
  lastModifiedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const leadsApi = {
  list: () => api.get<Lead[]>('/leads'),
  get: (id: string) => api.get<Lead>(`/leads/${id}`),
  create: (data: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>) => api.post<Lead>('/leads', data),
  update: (id: string, data: Partial<Lead>) => api.put<Lead>(`/leads/${id}`, data),
  delete: (id: string) => api.delete<void>(`/leads/${id}`),
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
