import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { generateUUID, isValidUUID } from '../lib/uuid';

// Exportar como typeonly e como const para compatibilidade
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

const STORAGE_KEY = 'auth_user';

const EMPLOYEES = ['Maria', 'João', 'Pedro', 'Ana'];

const CREDENTIALS: Record<string, { password: string; role: UserRole; name: string }> = {
  'axium.contato@gmail.com': {
    password: 'axium@26',
    role: 'admin',
    name: 'Administrador'
  }
};

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
    const loadStoredAuth = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const authData = JSON.parse(stored);
          if (authData?.email && authData?.id) {
            // Corrigir ID inválido se não for UUID
            if (!isValidUUID(authData.id)) {
              authData.id = generateUUID();
              localStorage.setItem(STORAGE_KEY, JSON.stringify(authData));
            }
            
            const userRole = authData.role || 'user';
            setUser({
              id: authData.id,
              email: authData.email,
              name: authData.name || 'Usuário',
              role: userRole,
              createdAt: authData.createdAt
            });
            setRole(userRole);
            setEmployeeName(authData.name || authData.employeeName || 'Usuário');
            setIsAuthenticated(true);
          }
        }
      } catch (err) {
        console.error('[AUTH] Error loading stored auth:', err);
        localStorage.removeItem(STORAGE_KEY);
      }
      setIsLoading(false);
    };
    loadStoredAuth();
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

      setUser(authUser);
      setRole(credential.role);
      setEmployeeName(credential.name);
      setIsAuthenticated(true);

      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        id: authUser.id,
        email: authUser.email,
        name: authUser.name,
        role: authUser.role,
        employeeName: authUser.name,
        createdAt: authUser.createdAt
      }));

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

    const currentRole = role;
    if (currentRole) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        id: user?.id,
        email: user?.email,
        name: name,
        role: currentRole,
        employeeName: name
      }));
    }
  };

  const logout = async () => {
    try {
      setUser(null);
      setRole(null);
      setEmployeeName(null);
      setIsAuthenticated(false);
      localStorage.removeItem(STORAGE_KEY);
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