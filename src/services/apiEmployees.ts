import { api, type ApiError } from '../lib/apiClient.ts';

export interface Employee {
  id: string;
  nome: string;
  funcao?: string;
  telefone?: string;
  email?: string;
  cpf?: string;
  pix?: string;
  salario?: number;
  ativo?: boolean;
  avatarUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const employeesApi = {
  list: () => api.get<Employee[]>('/employees'),
  get: (id: string) => api.get<Employee>(`/employees/${id}`),
  create: (data: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>) => api.post<Employee>('/employees', data),
  update: (id: string, data: Partial<Employee>) => api.put<Employee>(`/employees/${id}`, data),
  delete: (id: string) => api.delete<void>(`/employees/${id}`),
  updateAvatar: (id: string, avatarUrl: string) => api.put<Employee>(`/employees/${id}/avatar`, { avatarUrl }),
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
