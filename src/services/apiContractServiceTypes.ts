import { api, type ApiError } from '../lib/apiClient.ts';

export interface ContractServiceType {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const contractServiceTypesApi = {
  list: () => api.get<ContractServiceType[]>('/contract-service-types'),
  get: (id: string) => api.get<ContractServiceType>(`/contract-service-types/${id}`),
  create: (data: Omit<ContractServiceType, 'id' | 'createdAt' | 'updatedAt'>) => api.post<ContractServiceType>('/contract-service-types', data),
  update: (id: string, data: Partial<ContractServiceType>) => api.put<ContractServiceType>(`/contract-service-types/${id}`, data),
  delete: (id: string) => api.delete<void>(`/contract-service-types/${id}`),
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
