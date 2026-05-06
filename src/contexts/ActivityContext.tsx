import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { supabase, ACTIVITY_LOGS_TABLE, type ActivityLog } from '../lib/supabase';

interface ActivityLogsContextType {
  activityLogs: ActivityLog[];
  isLoadingLogs: boolean;
  fetchActivityLogsError: string | null;
  fetchActivityLogs: (limit?: number) => Promise<void>;
  logActivity: (acao: ActivityLog['acao'], descricao: string) => Promise<void>;
}

const ActivityLogsContext = createContext<ActivityLogsContextType | undefined>(undefined);

const defaultActivityLogsContext: ActivityLogsContextType = {
  activityLogs: [],
  isLoadingLogs: false,
  fetchActivityLogsError: null,
  fetchActivityLogs: async () => {},
  logActivity: async () => {},
};

export const ActivityLogsProvider = ({ children }: { children: ReactNode }) => {
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [fetchActivityLogsError, setFetchActivityLogsError] = useState<string | null>(null);

  const fetchActivityLogs = useCallback(async (limit = 20) => {
    setIsLoadingLogs(true);
    setFetchActivityLogsError(null);
    
    const timeoutId = setTimeout(() => {
      setFetchActivityLogsError('Tempo limite excedido (5s). Verifique sua conexão.');
      setIsLoadingLogs(false);
    }, 5000);

    try {
      const { data, error } = await supabase
        .from(ACTIVITY_LOGS_TABLE)
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);
      
      clearTimeout(timeoutId);
      
      if (error) {
        if (error.code === '404' || error.message.includes('not found')) {
          console.warn('Tabela de logs de atividade não encontrada:', error.message);
          setActivityLogs([]);
          setIsLoadingLogs(false);
          return;
        }
        console.error('Erro ao buscar logs de atividade:', error);
        setFetchActivityLogsError('Erro ao carregar atividades. Tente novamente mais tarde.');
        return;
      }
      setActivityLogs(data || []);
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('Erro ao buscar logs de atividade:', err);
      if (err?.message?.includes('fetch')) {
        setFetchActivityLogsError('Erro de conexão. Verifique sua internet.');
      } else {
        setFetchActivityLogsError('Erro ao carregar atividades. Tente novamente.');
      }
    } finally {
      setIsLoadingLogs(false);
    }
  }, []);

  const logActivity = async (acao: ActivityLog['acao'], descricao: string) => {
    try {
      const { data, error } = await supabase
        .from(ACTIVITY_LOGS_TABLE)
        .insert({ acao, descricao, timestamp: new Date().toISOString() })
        .select()
        .single();
      
      if (error) {
        if (error.code === '404' || error.message.includes('not found')) {
          console.warn('Tabela de logs não encontrada. Atividade não será registrada.');
          return;
        }
        console.error('Erro ao registrar atividade:', error);
        return;
      }
      
      if (data) {
        setActivityLogs(prev => [data, ...prev]);
      }
    } catch (err) {
      console.error('Erro ao registrar atividade:', err);
    }
  };

  return (
    <ActivityLogsContext.Provider value={{ activityLogs, isLoadingLogs, fetchActivityLogsError, fetchActivityLogs, logActivity }}>
      {children}
    </ActivityLogsContext.Provider>
  );
};

export const useActivityLogs = () => {
  const context = useContext(ActivityLogsContext);
  return context || defaultActivityLogsContext;
};