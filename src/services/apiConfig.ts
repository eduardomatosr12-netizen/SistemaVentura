import { api, type ApiError } from '../lib/apiClient.ts';

export interface SystemConfig {
  id: string;
  whatsappApiKey?: string;
  asaasApiKey?: string;
  firebaseConfig?: any;
  updatedAt?: string;
}

export const configApi = {
  get: () => api.get<SystemConfig>('/config'),
  update: (data: Partial<SystemConfig>) => api.put<SystemConfig>('/config', data),
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
