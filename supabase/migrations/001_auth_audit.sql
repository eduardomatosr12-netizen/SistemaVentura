-- =====================================================
-- Tabelas de Autenticação e Auditoria - Sistema Axium
-- Execute este SQL no Supabase Dashboard > SQL Editor
-- =====================================================

-- 1. Tabela de Perfis (vinculada ao auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  cargo TEXT NOT NULL CHECK (cargo IN ('Socio', 'Funcionario')),
  avatar TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Habilitar RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Política: usuários veem/editam apenas seu próprio perfil
CREATE POLICY "Usuários gerenciam próprios perfis"
  ON profiles FOR ALL
  USING (auth.uid() = user_id);

-- Trigger para criar perfil automaticamente ao cadastrar
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (user_id, nome, cargo)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'nome', COALESCE(NEW.raw_user_meta_data->>'cargo', 'Funcionario'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 2. Tabela de Logs de Atividades
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  acao TEXT NOT NULL CHECK (acao IN ('lead_criado', 'lead_movido', 'lead_atualizado', 'tarefa_concluida')),
  descricao TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Habilitar RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Política: todos os usuários autenticados veem logs
CREATE POLICY "Usuários veem logs de atividades"
  ON activity_logs FOR SELECT
  USING (auth.role() = 'authenticated');

-- Política: usuários inserem seus próprios logs
CREATE POLICY "Usuários criam próprios logs"
  ON activity_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 3. Índice para performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles (user_id);

-- 4. Permissões para o app (anon key)
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT, INSERT ON profiles TO anon;
GRANT SELECT, INSERT ON activity_logs TO anon;