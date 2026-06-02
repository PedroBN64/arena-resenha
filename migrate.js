require('dotenv').config();
const { DatabaseSync } = require('node:sqlite');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: SUPABASE_URL ou SUPABASE_KEY não estão definidos no arquivo .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const db = new DatabaseSync(path.join(__dirname, 'database.db'));

async function migrar() {
  console.log("Iniciando migração dos dados...");

  try {
    // 1. Migrar Usuários
    const usuarios = db.prepare('SELECT * FROM usuarios').all();
    if (usuarios.length > 0) {
      console.log(`Migrando ${usuarios.length} usuários...`);
      const { error } = await supabase.from('usuarios').upsert(usuarios.map(u => ({
        id: u.id,
        username: u.username,
        password: u.password,
        created_at: u.created_at
      })));
      if (error) throw error;
    }

    // 2. Migrar Times
    const times = db.prepare('SELECT * FROM times').all();
    if (times.length > 0) {
      console.log(`Migrando ${times.length} times...`);
      const { error } = await supabase.from('times').upsert(times.map(t => ({
        id: t.id,
        nome_time: t.nome_time,
        nome_responsavel: t.nome_responsavel,
        cpf: t.cpf,
        telefone: t.telefone,
        endereco: t.endereco,
        observacoes: t.observacoes,
        data_cadastro: t.data_cadastro
      })));
      if (error) throw error;
    }

    // 3. Migrar Horários
    const horarios = db.prepare('SELECT * FROM horarios').all();
    if (horarios.length > 0) {
      console.log(`Migrando ${horarios.length} horários...`);
      const { error } = await supabase.from('horarios').upsert(horarios.map(h => ({
        id: h.id,
        dia_semana: h.dia_semana,
        horario_inicio: h.horario_inicio,
        horario_fim: h.horario_fim,
        status_pagamento: h.status_pagamento,
        time_id: h.time_id,
        created_at: h.created_at,
        updated_at: h.updated_at
      })));
      if (error) throw error;
    }

    console.log("✅ Migração concluída com sucesso!");

  } catch (error) {
    console.error("❌ Erro durante a migração:", error);
  }
}

migrar();
