import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import * as financeService from '../services/financeService';
import type { FinanceRecord } from '../services/financeService';

interface FinanceContextType {
  transactions: FinanceRecord[];
  isLoading: boolean;
  addTransaction: (record: Omit<FinanceRecord, 'id' | 'createdAt'>) => Promise<string>;
  updateTransaction: (id: string, fields: Partial<FinanceRecord>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider = ({ children }: { children: ReactNode }) => {
  const [transactions, setTransactions] = useState<FinanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const migrationDone = useRef(false);

  useEffect(() => {
    const unsubscribe = financeService.subscribeTransactions(records => {
      setTransactions(records);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isLoading && !migrationDone.current && transactions.length === 0) {
      migrationDone.current = true;
      financeService.migrateLocalStorageToFirestore().then(result => {
        if (result.invoices > 0 || result.expenses > 0) {
          console.log(`[Finance] Migrados ${result.invoices} faturas e ${result.expenses} despesas para o Firestore`);
        }
      }).catch(err => {
        console.error('[Finance] Erro na migração:', err);
      });
    }
  }, [isLoading, transactions]);

  const addTransaction = useCallback(async (record: Omit<FinanceRecord, 'id' | 'createdAt'>) => {
    const id = await financeService.addTransaction(record);
    console.log('[Finance] Transação adicionada:', id);
    return id;
  }, []);

  const updateTransaction = useCallback(async (id: string, fields: Partial<FinanceRecord>) => {
    await financeService.updateTransaction(id, fields);
    console.log('[Finance] Transação atualizada:', id);
  }, []);

  const deleteTransaction = useCallback(async (id: string) => {
    await financeService.deleteTransaction(id);
    console.log('[Finance] Transação excluída:', id);
  }, []);

  return (
    <FinanceContext.Provider value={{ transactions, isLoading, addTransaction, updateTransaction, deleteTransaction }}>
      {children}
    </FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
};
