import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { doc, onSnapshot, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { generateUUID, isValidUUID } from '../lib/uuid';

type UserRole = 'admin' | 'manager' | 'user';
export type { UserRole };

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface AuthUser extends User {
  createdAt?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  role: UserRole | null;
  employeeName: string | null;
  availableEmployees: string[];
  hasPermission: (allowedRoles: UserRole[]) => boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  selectEmployee: (name: string) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const EMPLOYEES = ['Maria', 'João', 'Pedro', 'Ana'];

const CREDENTIALS: Record<string, { password: string; role: UserRole; name: string }> = {};

const authEmail = import.meta.env.VITE_AUTH_EMAIL?.trim().toLowerCase();
const authPassword = import.meta.env.VITE_AUTH_PASSWORD?.trim();
const authRole = (import.meta.env.VITE_AUTH_ROLE?.trim() || 'admin') as UserRole;
const authName = import.meta.env.VITE_AUTH_NAME?.trim() || 'Administrador';

if (authEmail && authPassword) {
  CREDENTIALS[authEmail] = {
    password: authPassword,
    role: authRole,
    name: authName,
  };
  console.log('[AUTH] Credenciais carregadas para:', authEmail);
} else {
  console.warn('[AUTH] Variáveis VITE_AUTH_EMAIL/VITE_AUTH_PASSWORD não configuradas no .env');
}

function getOrCreateSessionId(): string {
  const key = 'ventura_session_id';
  const existing = sessionStorage.getItem(key);
  if (existing && isValidUUID(existing)) return existing;
  const id = generateUUID();
  sessionStorage.setItem(key, id);
  return id;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [employeeName, setEmployeeName] = useState<string | null>(null);

  const hasPermission = useCallback((allowedRoles: UserRole[]): boolean => {
    if (!isAuthenticated || !user) return false;
    return allowedRoles.includes(user.role);
  }, [isAuthenticated, user]);

  useEffect(() => {
    const key = 'ventura_session_id';
    const storedId = sessionStorage.getItem(key);
    if (!storedId || !isValidUUID(storedId)) {
      setIsLoading(false);
      return;
    }

    const unsub = onSnapshot(doc(db, 'sessions', storedId), snap => {
      if (snap.exists()) {
        const data = snap.data();
        if (data?.email && data?.userId) {
          const userRole: UserRole = data.role || 'user';
          setUser({
            id: data.userId,
            email: data.email,
            name: data.name || 'Usuário',
            role: userRole,
            createdAt: data.createdAt
          });
          setRole(userRole);
          setEmployeeName(data.employeeName || data.name || 'Usuário');
          setIsAuthenticated(true);
        }
      } else {
        setIsAuthenticated(false);
        setUser(null);
        setRole(null);
        setEmployeeName(null);
      }
      setIsLoading(false);
    }, err => {
      console.error('[AUTH] Erro ao monitorar sessão:', err);
      setIsLoading(false);
    });

    return () => unsub();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedPassword = password.trim();

      console.log('[AUTH] Tentativa de login:', { email: normalizedEmail, credentialsAvailable: Object.keys(CREDENTIALS).length });

      const credential = CREDENTIALS[normalizedEmail];

      if (!credential) {
        console.warn('[AUTH] Credencial não encontrada para:', normalizedEmail);
        return { success: false, error: 'E-mail ou senha incorretos' };
      }

      if (credential.password !== normalizedPassword) {
        console.warn('[AUTH] Senha incorreta para:', normalizedEmail);
        return { success: false, error: 'E-mail ou senha incorretos' };
      }

      console.log('[AUTH] Login autorizado para:', normalizedEmail);

      const authUser: AuthUser = {
        id: generateUUID(),
        email: normalizedEmail,
        name: credential.name,
        role: credential.role,
        createdAt: new Date().toISOString()
      };

      const sessionId = getOrCreateSessionId();

      setUser(authUser);
      setRole(credential.role);
      setEmployeeName(credential.name);
      setIsAuthenticated(true);

      try {
        await setDoc(doc(db, 'sessions', sessionId), {
          userId: authUser.id,
          email: authUser.email,
          name: authUser.name,
          role: authUser.role,
          employeeName: authUser.name,
          createdAt: authUser.createdAt,
          lastActiveAt: Timestamp.now(),
        });
      } catch (firestoreErr) {
        console.error('[AUTH] Erro ao salvar sessão (login continua):', firestoreErr);
      }

      return { success: true };
    } catch (err) {
      console.error('[AUTH] Login error:', err);
      return { success: false, error: 'Erro ao fazer login' };
    }
  };

  const selectEmployee = (name: string) => {
    if (!EMPLOYEES.includes(name)) return;

    setEmployeeName(name);
    setUser(prev => prev ? { ...prev, name: name } : null);

    const sessionId = getOrCreateSessionId();
    const currentRole = role;
    if (currentRole) {
      setDoc(doc(db, 'sessions', sessionId), {
        name,
        employeeName: name,
        role: currentRole,
        lastActiveAt: Timestamp.now(),
      }, { merge: true }).catch(err => console.error('[AUTH] Erro ao atualizar sessão:', err));
    }
  };

  const logout = async () => {
    try {
      const sessionId = getOrCreateSessionId();
      await deleteDoc(doc(db, 'sessions', sessionId)).catch(() => {});
      sessionStorage.removeItem('ventura_session_id');
      setUser(null);
      setRole(null);
      setEmployeeName(null);
      setIsAuthenticated(false);
    } catch (err) {
      console.error('[AUTH] Logout error:', err);
    }
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      isLoading,
      user,
      role,
      employeeName,
      availableEmployees: EMPLOYEES,
      hasPermission,
      login,
      selectEmployee,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const usePermission = (allowedRoles: UserRole[]) => {
  const { hasPermission, isAuthenticated } = useAuth();
  return isAuthenticated && hasPermission(allowedRoles);
};
