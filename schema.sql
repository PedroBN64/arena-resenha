-- Remover tabelas existentes caso precise recriar (Cuidado!)
-- DROP TABLE IF EXISTS horarios;
-- DROP TABLE IF EXISTS times;
-- DROP TABLE IF EXISTS usuarios;

-- Tabela de Usuários
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Tabela de Times
CREATE TABLE times (
    id SERIAL PRIMARY KEY,
    nome_time TEXT NOT NULL,
    nome_responsavel TEXT NOT NULL,
    cpf TEXT,
    telefone TEXT,
    endereco TEXT,
    observacoes TEXT,
    data_cadastro TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Tabela de Horários
CREATE TABLE horarios (
    id SERIAL PRIMARY KEY,
    dia_semana TEXT NOT NULL,
    horario_inicio TEXT NOT NULL,
    horario_fim TEXT NOT NULL,
    status_pagamento TEXT DEFAULT 'nao_pago',
    time_id INTEGER REFERENCES times(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(dia_semana, horario_inicio)
);

-- Habilitar a segurança em nível de linha (opcional, pode ser desabilitado para testes iniciais)
-- Neste projeto deixaremos tudo aberto porque faremos a segurança no backend (Node.js)
-- Para isso, não ative RLS ou se o Supabase ativar automaticamente, desabilite via painel ou rode:
-- ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE times DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE horarios DISABLE ROW LEVEL SECURITY;
