import { api, type ApiError } from '../lib/apiClient.ts';

export interface EventExpense {
  id: string;
  eventId: string;
  description: string;
  category: string;
  customName?: string;
  valor: number;
  status: string;
  paymentMethod?: string;
  tipo: string;
  interno: boolean;
  financeiroId?: string;
  date: string;
  createdAt?: string;
  updatedAt?: string;
}

export const eventExpensesApi = {
  list: (eventId?: string) => {
    const query = eventId ? `?eventId=${eventId}` : '';
    return api.get<EventExpense[]>(`/event-expenses${query}`);
  },
  get: (id: string) => api.get<EventExpense>(`/event-expenses/${id}`),
  create: (data: Omit<EventExpense, 'id' | 'createdAt' | 'updatedAt'>) => api.post<EventExpense>('/event-expenses', data),
  update: (id: string, data: Partial<EventExpense>) => api.put<EventExpense>(`/event-expenses/${id}`, data),
  delete: (id: string) => api.delete<void>(`/event-expenses/${id}`),
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
