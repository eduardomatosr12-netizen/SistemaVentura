import { api, ApiError } from '../lib/apiClient.ts';

export interface Event {
  id: string;
  title: string;
  client?: string;
  clientId?: string;
  eventType?: string;
  date: string;
  dateEnd?: string;
  time?: string;
  local?: string;
  decorator?: string;
  city?: string;
  description?: string;
  equipe?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientCpf?: string;
  clientRg?: string;
  clientAddress?: string;
  clientGender?: string;
  contractServices?: string[];
  status?: string;
  valorTotal?: number;
  desconto?: number;
  items?: any[];
  despesasInternas?: any[];
  createdAt?: string;
  updatedAt?: string;
}

export const eventsApi = {
  list: () => api.get<Event[]>('/events'),
  get: (id: string) => api.get<Event>(`/events/${id}`),
  create: (data: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>) => api.post<Event>('/events', data),
  update: (id: string, data: Partial<Event>) => api.put<Event>(`/events/${id}`, data),
  delete: (id: string) => api.delete<void>(`/events/${id}`),
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
