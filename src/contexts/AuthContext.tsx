import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { doc, getDoc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
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

const CREDENTIALS: Record<string, { password: string; role: UserRole; name: string }> = {
  'joseleonardomcc@gmail.com': {
    password: 'Brasil2016v',
    role: 'admin',
    name: 'Administrador'
  }
};

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
    getDoc(doc(db, 'sessions', storedId)).then(snap => {
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
      }
    }).catch(err => console.error('[AUTH] Erro ao carregar sessão:', err))
    .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedPassword = password.trim();

      const credential = CREDENTIALS[normalizedEmail];

      if (!credential || credential.password !== normalizedPassword) {
        return { success: false, error: 'E-mail ou senha incorretos' };
      }

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

      setDoc(doc(db, 'sessions', sessionId), {
        userId: authUser.id,
        email: authUser.email,
        name: authUser.name,
        role: authUser.role,
        employeeName: authUser.name,
        createdAt: authUser.createdAt,
        lastActiveAt: Timestamp.now(),
      }).catch(err => console.error('[AUTH] Erro ao salvar sessão:', err));

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
