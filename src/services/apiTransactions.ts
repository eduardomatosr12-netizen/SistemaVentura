import { api, ApiError } from '../lib/apiClient.ts';

export interface Transaction {
  id: string;
  type: 'receita' | 'despesa';
  client?: string;
  description: string;
  amount: number;
  date: string;
  paidDate?: string;
  status: 'Pago' | 'Pendente' | 'Vencida' | 'Cancelado';
  source?: 'manual' | 'lead' | 'evento' | 'asaas';
  paymentMethod?: string;
  installments?: string;
  category?: string;
  eventType?: string;
  origemEventoId?: string;
  lastModifiedBy?: string;
  expenseType?: 'fixa' | 'variavel';
  recurrence?: 'mensal' | 'trimestral' | 'anual';
  dueDay?: number;
  parentId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const transactionsApi = {
  list: () => api.get<Transaction[]>('/transactions'),
  get: (id: string) => api.get<Transaction>(`/transactions/${id}`),
  getByEventId: (eventId: string) => api.get<Transaction[]>(`/transactions?origemEventoId=${eventId}`).then(arr => arr[0] || null),
  create: (data: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => api.post<Transaction>('/transactions', data),
  update: (id: string, data: Partial<Transaction>) => api.put<Transaction>(`/transactions/${id}`, data),
  delete: (id: string) => api.delete<void>(`/transactions/${id}`),
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
