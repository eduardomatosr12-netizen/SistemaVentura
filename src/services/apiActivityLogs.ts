import { api, ApiError } from '../lib/apiClient.ts';

export interface ActivityLog {
  id: string;
  acao: string;
  descricao: string;
  timestamp: string;
  userId?: string;
  userName?: string;
  metadata?: any;
}

export const activityLogsApi = {
  list: (params?: { limit?: string; offset?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', params.limit);
    if (params?.offset) searchParams.set('offset', params.offset);
    const query = searchParams.toString();
    return api.get<ActivityLog[]>(`/activity-logs${query ? `?${query}` : ''}`);
  },
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
