import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { collection, addDoc, getDocs, query, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

export interface ActivityLog {
  id: string;
  user_id: string;
  acao: 'lead_criado' | 'lead_movido' | 'tarefa_concluida' | 'lead_atualizado';
  descricao: string;
  timestamp: string;
}

interface ActivityLogsContextType {
  activityLogs: ActivityLog[];
  isLoadingLogs: boolean;
  fetchActivityLogsError: string | null;
  fetchActivityLogs: (limitCount?: number) => Promise<void>;
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

const COLLECTION = 'activity_logs';

export const ActivityLogsProvider = ({ children }: { children: ReactNode }) => {
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [fetchActivityLogsError, setFetchActivityLogsError] = useState<string | null>(null);

  const fetchActivityLogs = useCallback(async (limitCount = 20) => {
    setIsLoadingLogs(true);
    setFetchActivityLogsError(null);

    const timeoutId = setTimeout(() => {
      setFetchActivityLogsError('Tempo limite excedido (5s). Verifique sua conexão.');
      setIsLoadingLogs(false);
    }, 5000);

    try {
      const q = query(collection(db, COLLECTION), orderBy('timestamp', 'desc'), limit(limitCount));
      const snapshot = await getDocs(q);
      clearTimeout(timeoutId);
      const logs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ActivityLog));
      setActivityLogs(logs);
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('[ActivityLogs] Erro ao buscar logs:', err);
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
      const docRef = await addDoc(collection(db, COLLECTION), {
        acao,
        descricao,
        timestamp: new Date().toISOString(),
      });
      const newLog: ActivityLog = {
        id: docRef.id,
        acao,
        descricao,
        timestamp: new Date().toISOString(),
        user_id: '',
      };
      setActivityLogs(prev => [newLog, ...prev]);
    } catch (err) {
      console.error('[ActivityLogs] Erro ao registrar atividade:', err);
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
