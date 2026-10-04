import { api, ApiError } from '../lib/apiClient.ts';

export interface EventStockItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  valorReferencia: number;
  observacao?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const eventStockApi = {
  list: () => api.get<EventStockItem[]>('/event-stock'),
  get: (id: string) => api.get<EventStockItem>(`/event-stock/${id}`),
  create: (data: Omit<EventStockItem, 'id' | 'createdAt' | 'updatedAt'>) => api.post<EventStockItem>('/event-stock', data),
  update: (id: string, data: Partial<EventStockItem>) => api.put<EventStockItem>(`/event-stock/${id}`, data),
  delete: (id: string) => api.delete<void>(`/event-stock/${id}`),
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
