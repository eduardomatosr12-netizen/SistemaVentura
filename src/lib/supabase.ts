import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Profile {
  id: string;
  user_id: string;
  nome: string;
  cargo: 'Socio' | 'Funcionario';
  avatar: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  acao: 'lead_criado' | 'lead_movido' | 'tarefa_concluida' | 'lead_atualizado';
  descricao: string;
  timestamp: string;
}

export const PROFILES_TABLE = 'profiles';
export const ACTIVITY_LOGS_TABLE = 'activity_logs';