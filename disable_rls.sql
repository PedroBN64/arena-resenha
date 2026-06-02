-- Desabilitar RLS em todas as tabelas para permitir escrita pelo backend
ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE times DISABLE ROW LEVEL SECURITY;
ALTER TABLE horarios DISABLE ROW LEVEL SECURITY;
