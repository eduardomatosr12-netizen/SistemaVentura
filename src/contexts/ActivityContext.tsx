import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { collection, addDoc, query, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
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
  logActivity: (acao: ActivityLog['acao'], descricao: string) => Promise<void>;
}

const ActivityLogsContext = createContext<ActivityLogsContextType | undefined>(undefined);

const defaultActivityLogsContext: ActivityLogsContextType = {
  activityLogs: [],
  isLoadingLogs: false,
  fetchActivityLogsError: null,
  logActivity: async () => {},
};

const COLLECTION = 'activity_logs';

export const ActivityLogsProvider = ({ children }: { children: ReactNode }) => {
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [fetchActivityLogsError, setFetchActivityLogsError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, COLLECTION), orderBy('timestamp', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, snapshot => {
      const logs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ActivityLog));
      setActivityLogs(logs);
      setIsLoadingLogs(false);
      setFetchActivityLogsError(null);
    }, err => {
      console.error('[ActivityLogs] Erro no listener de logs:', err);
      setIsLoadingLogs(false);
      if (err?.message?.includes('fetch')) {
        setFetchActivityLogsError('Erro de conexão. Verifique sua internet.');
      } else {
        setFetchActivityLogsError('Erro ao carregar atividades. Tente novamente.');
      }
    });
    return unsubscribe;
  }, []);

  const logActivity = async (acao: ActivityLog['acao'], descricao: string) => {
    try {
      await addDoc(collection(db, COLLECTION), {
        acao,
        descricao,
        timestamp: Timestamp.now(),
        user_id: '',
      });
      console.log(`[ActivityLogs] Atividade registrada: ${acao}`);
    } catch (err) {
      console.error('[ActivityLogs] Erro ao registrar atividade:', err);
    }
  };

  return (
    <ActivityLogsContext.Provider value={{ activityLogs, isLoadingLogs, fetchActivityLogsError, logActivity }}>
      {children}
    </ActivityLogsContext.Provider>
  );
};

export const useActivityLogs = () => {
  const context = useContext(ActivityLogsContext);
  return context || defaultActivityLogsContext;
};
