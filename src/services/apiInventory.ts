import { api, ApiError } from '../lib/apiClient.ts';

export interface InventoryColumn {
  id: string;
  title: string;
  type: string;
  width: number;
}

export interface InventoryRow {
  id: string;
  values: Record<string, unknown>;
  lastModifiedBy?: string;
}

export interface InventoryBoard {
  id: string;
  title: string;
  color: string;
  columns: InventoryColumn[];
  rows: InventoryRow[];
  createdAt?: string;
  updatedAt?: string;
}

export const inventoryApi = {
  list: () => api.get<InventoryBoard[]>('/inventory'),
  get: (id: string) => api.get<InventoryBoard>(`/inventory/${id}`),
  create: (data: Omit<InventoryBoard, 'id' | 'createdAt' | 'updatedAt'>) => api.post<InventoryBoard>('/inventory', data),
  update: (id: string, data: Partial<InventoryBoard>) => api.put<InventoryBoard>(`/inventory/${id}`, data),
  delete: (id: string) => api.delete<void>(`/inventory/${id}`),
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
