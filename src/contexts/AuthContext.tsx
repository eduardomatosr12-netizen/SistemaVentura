import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';

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

const API_BASE = import.meta.env.VITE_API_URL || '/api';

function getToken(): string | null {
  return localStorage.getItem('ventura_token');
}

function setToken(token: string) {
  localStorage.setItem('ventura_token', token);
}

function removeToken() {
  localStorage.removeItem('ventura_token');
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [employeeName, setEmployeeName] = useState<string | null>(null);
  const [availableEmployees, setAvailableEmployees] = useState<string[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'employees'), orderBy('name'));
    const unsub = onSnapshot(q, snapshot => {
      const names = snapshot.docs
        .map(d => String((d.data() as { name?: string }).name || '').trim())
        .filter(Boolean);
      setAvailableEmployees(names);
    }, err => {
      console.warn('[Auth] Erro ao carregar funcionários:', err);
      setAvailableEmployees([]);
    });
    return () => unsub();
  }, []);

  const hasPermission = useCallback((allowedRoles: UserRole[]): boolean => {
    if (!isAuthenticated || !user) return false;
    return allowedRoles.includes(user.role);
  }, [isAuthenticated, user]);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Token inválido');
        return res.json();
      })
      .then((data) => {
        const userRole: UserRole = data.perfil || 'user';
        setUser({
          id: data.id,
          email: data.email,
          name: data.nome || 'Usuário',
          role: userRole,
          createdAt: data.createdAt,
        });
        setRole(userRole);
        setEmployeeName(data.nome || 'Usuário');
        setIsAuthenticated(true);
      })
      .catch(() => {
        removeToken();
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'E-mail ou senha incorretos' };
      }

      setToken(data.token);

      const userRole: UserRole = data.user.perfil || 'user';
      setUser({
        id: data.user.id,
        email: data.user.email,
        name: data.user.nome || 'Usuário',
        role: userRole,
      });
      setRole(userRole);
      setEmployeeName(data.user.nome || 'Usuário');
      setIsAuthenticated(true);

      return { success: true };
    } catch {
      return { success: false, error: 'Erro ao conectar com o servidor' };
    }
  };

  const selectEmployee = useCallback((name: string) => {
    setEmployeeName(name);
    setUser((prev) => (prev ? { ...prev, name } : null));
  }, []);

  const logout = async () => {
    removeToken();
    setUser(null);
    setRole(null);
    setEmployeeName(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        role,
        employeeName,
        availableEmployees,
        hasPermission,
        login,
        selectEmployee,
        logout,
      }}
    >
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
