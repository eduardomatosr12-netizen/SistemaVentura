import { api, ApiError } from '../lib/apiClient.ts';

export interface Rental {
  id: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  items: any[];
  totalValue: number;
  discount: number;
  status: string;
  startDate: string;
  endDate?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const rentalsApi = {
  list: () => api.get<Rental[]>('/rentals'),
  get: (id: string) => api.get<Rental>(`/rentals/${id}`),
  create: (data: Omit<Rental, 'id' | 'createdAt' | 'updatedAt'>) => api.post<Rental>('/rentals', data),
  update: (id: string, data: Partial<Rental>) => api.put<Rental>(`/rentals/${id}`, data),
  delete: (id: string) => api.delete<void>(`/rentals/${id}`),
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
