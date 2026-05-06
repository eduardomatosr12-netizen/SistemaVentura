-- =====================================================
-- Correção de RLS para tabela employees
-- Execute este SQL no Supabase Dashboard > SQL Editor
-- =====================================================

-- Verificar se a tabela employees existe, se não, criar
CREATE TABLE IF NOT EXISTS employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'user')),
  avatar TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Habilitar RLS na tabela employees
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes se houver (para evitar erros)
DROP POLICY IF EXISTS "Usuários autenticados podem gerenciar employees" ON employees;
DROP POLICY IF EXISTS "Authenticated users can manage employees" ON employees;
DROP POLICY IF EXISTS "Usuários veem próprio registro" ON employees;

-- Política: usuários autenticados podem fazer todas as operações
CREATE POLICY "Authenticated users can manage employees"
  ON employees FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Alternativamente, política mais restritiva (descomente se preferir):
-- CREATE POLICY "Usuários veem próprio registro"
--   ON employees FOR SELECT
--   USING (auth.uid() = user_id);
-- 
-- CREATE POLICY "Admins podem gerenciar todos"
--   ON employees FOR ALL
--   USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND cargo = 'Socio'))
--   WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND cargo = 'Socio'));

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees (user_id);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees (email);

-- Permissões para o app (anon key)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON employees TO authenticated;
GRANT SELECT ON employees TO anon;

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_employees_updated_at ON employees;
CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
