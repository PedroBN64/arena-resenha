const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// ─── Banco de Dados ─────────────────────────────────────────────────────────
const db = new Database(path.join(__dirname, 'database.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Criar tabelas
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS times (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome_time TEXT NOT NULL,
    nome_responsavel TEXT NOT NULL,
    cpf TEXT,
    telefone TEXT,
    endereco TEXT,
    observacoes TEXT,
    data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS horarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dia_semana TEXT NOT NULL,
    horario_inicio TEXT NOT NULL,
    horario_fim TEXT NOT NULL,
    status_pagamento TEXT DEFAULT 'nao_pago',
    time_id INTEGER REFERENCES times(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(dia_semana, horario_inicio)
  );
`);

// Criar admin padrão se não existir
const adminExists = db.prepare('SELECT id FROM usuarios WHERE username = ?').get('admin');
if (!adminExists) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO usuarios (username, password) VALUES (?, ?)').run('admin', hash);
  console.log('✅ Usuário admin criado: admin / admin123');
}

// Inicializar todos os horários da semana
const dias = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
const horariosBase = [
  { inicio: '18:00', fim: '19:00' },
  { inicio: '19:00', fim: '20:00' },
  { inicio: '20:00', fim: '21:00' },
  { inicio: '21:00', fim: '22:00' },
  { inicio: '22:00', fim: '23:00' },
  { inicio: '23:00', fim: '00:00' },
];

const insertHorario = db.prepare(`
  INSERT OR IGNORE INTO horarios (dia_semana, horario_inicio, horario_fim)
  VALUES (?, ?, ?)
`);

for (const dia of dias) {
  for (const h of horariosBase) {
    insertHorario.run(dia, h.inicio, h.fim);
  }
}

console.log('✅ Horários inicializados');

// ─── Middlewares ─────────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.use(session({
  secret: 'arena-resenha-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24h
}));

// Middleware de autenticação
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  res.status(401).json({ error: 'Não autorizado. Faça login.' });
}

// ─── Rotas de Autenticação ────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
  }

  const user = db.prepare('SELECT * FROM usuarios WHERE username = ?').get(username);
  
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Usuário ou senha inválidos' });
  }

  req.session.userId = user.id;
  req.session.username = user.username;
  res.json({ success: true, username: user.username });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/auth/check', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({ authenticated: true, username: req.session.username });
  } else {
    res.json({ authenticated: false });
  }
});

// ─── Rotas de Horários ────────────────────────────────────────────────────────
app.get('/api/horarios', (req, res) => {
  const horarios = db.prepare(`
    SELECT h.*, t.nome_time, t.nome_responsavel, t.cpf, t.telefone, t.endereco, t.observacoes, t.data_cadastro as time_cadastro
    FROM horarios h
    LEFT JOIN times t ON h.time_id = t.id
    ORDER BY 
      CASE h.dia_semana
        WHEN 'Segunda-feira' THEN 1
        WHEN 'Terça-feira' THEN 2
        WHEN 'Quarta-feira' THEN 3
        WHEN 'Quinta-feira' THEN 4
        WHEN 'Sexta-feira' THEN 5
        WHEN 'Sábado' THEN 6
        WHEN 'Domingo' THEN 7
      END,
      h.horario_inicio
  `).all();
  
  res.json(horarios);
});

app.get('/api/dashboard', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as count FROM horarios').get().count;
  const ocupados = db.prepare('SELECT COUNT(*) as count FROM horarios WHERE time_id IS NOT NULL').get().count;
  const disponiveis = total - ocupados;
  const pagos = db.prepare("SELECT COUNT(*) as count FROM horarios WHERE time_id IS NOT NULL AND status_pagamento = 'pago'").get().count;
  const nao_pagos = db.prepare("SELECT COUNT(*) as count FROM horarios WHERE time_id IS NOT NULL AND status_pagamento = 'nao_pago'").get().count;
  
  res.json({ total, ocupados, disponiveis, pagos, nao_pagos });
});

app.put('/api/horarios/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { status_pagamento, time_id, nome_time, nome_responsavel, cpf, telefone, endereco, observacoes } = req.body;

  try {
    // Se está cadastrando um time novo
    if (nome_time && nome_responsavel) {
      // Verificar se já existe time neste horário e atualizar ou criar novo
      const horarioAtual = db.prepare('SELECT * FROM horarios WHERE id = ?').get(id);
      
      let timeId;
      if (horarioAtual.time_id) {
        // Atualizar time existente
        db.prepare(`
          UPDATE times SET nome_time = ?, nome_responsavel = ?, cpf = ?, telefone = ?, endereco = ?, observacoes = ?
          WHERE id = ?
        `).run(nome_time, nome_responsavel, cpf || '', telefone || '', endereco || '', observacoes || '', horarioAtual.time_id);
        timeId = horarioAtual.time_id;
      } else {
        // Criar novo time
        const result = db.prepare(`
          INSERT INTO times (nome_time, nome_responsavel, cpf, telefone, endereco, observacoes)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(nome_time, nome_responsavel, cpf || '', telefone || '', endereco || '', observacoes || '');
        timeId = result.lastInsertRowid;
      }
      
      // Atualizar horário
      db.prepare(`
        UPDATE horarios SET time_id = ?, status_pagamento = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(timeId, status_pagamento || 'nao_pago', id);
      
    } else if (status_pagamento !== undefined) {
      // Apenas atualizar status de pagamento
      db.prepare(`
        UPDATE horarios SET status_pagamento = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(status_pagamento, id);
    }

    const updated = db.prepare(`
      SELECT h.*, t.nome_time, t.nome_responsavel, t.cpf, t.telefone, t.endereco, t.observacoes
      FROM horarios h LEFT JOIN times t ON h.time_id = t.id
      WHERE h.id = ?
    `).get(id);

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/horarios/:id/liberar', requireAuth, (req, res) => {
  const { id } = req.params;
  
  try {
    const horario = db.prepare('SELECT * FROM horarios WHERE id = ?').get(id);
    
    if (!horario) return res.status(404).json({ error: 'Horário não encontrado' });
    
    // Liberar horário (remover time_id e resetar status)
    db.prepare(`
      UPDATE horarios SET time_id = NULL, status_pagamento = 'nao_pago', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Rotas de Times ────────────────────────────────────────────────────────────
app.get('/api/times', (req, res) => {
  const { busca } = req.query;
  
  let query = `
    SELECT t.*, h.dia_semana, h.horario_inicio, h.horario_fim, h.status_pagamento, h.id as horario_id
    FROM times t
    LEFT JOIN horarios h ON h.time_id = t.id
  `;
  
  const params = [];
  
  if (busca) {
    query += ` WHERE t.nome_time LIKE ? OR t.nome_responsavel LIKE ? OR t.telefone LIKE ? OR t.cpf LIKE ?`;
    const like = `%${busca}%`;
    params.push(like, like, like, like);
  }
  
  query += ' ORDER BY t.nome_time';
  
  const times = db.prepare(query).all(...params);
  
  // Agrupar por time
  const timesMap = {};
  for (const row of times) {
    if (!timesMap[row.id]) {
      timesMap[row.id] = {
        id: row.id,
        nome_time: row.nome_time,
        nome_responsavel: row.nome_responsavel,
        cpf: row.cpf,
        telefone: row.telefone,
        endereco: row.endereco,
        observacoes: row.observacoes,
        data_cadastro: row.data_cadastro,
        horarios: []
      };
    }
    if (row.horario_id) {
      timesMap[row.id].horarios.push({
        id: row.horario_id,
        dia_semana: row.dia_semana,
        horario_inicio: row.horario_inicio,
        horario_fim: row.horario_fim,
        status_pagamento: row.status_pagamento
      });
    }
  }
  
  res.json(Object.values(timesMap));
});

// ─── Relatório ────────────────────────────────────────────────────────────────
app.get('/api/relatorio', (req, res) => {
  const { status, dia } = req.query;
  
  let query = `
    SELECT t.nome_time, t.nome_responsavel, t.telefone, t.cpf,
           h.dia_semana, h.horario_inicio, h.horario_fim, h.status_pagamento
    FROM horarios h
    INNER JOIN times t ON h.time_id = t.id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (status) {
    query += ' AND h.status_pagamento = ?';
    params.push(status);
  }
  
  if (dia) {
    query += ' AND h.dia_semana = ?';
    params.push(dia);
  }
  
  query += ` ORDER BY
    CASE h.dia_semana
      WHEN 'Segunda-feira' THEN 1
      WHEN 'Terça-feira' THEN 2
      WHEN 'Quarta-feira' THEN 3
      WHEN 'Quinta-feira' THEN 4
      WHEN 'Sexta-feira' THEN 5
      WHEN 'Sábado' THEN 6
      WHEN 'Domingo' THEN 7
    END, h.horario_inicio`;
  
  const dados = db.prepare(query).all(...params);
  res.json(dados);
});

// ─── Backup ───────────────────────────────────────────────────────────────────
app.get('/api/backup', requireAuth, (req, res) => {
  const times = db.prepare('SELECT * FROM times').all();
  const horarios = db.prepare('SELECT * FROM horarios').all();
  
  const backup = {
    exportado_em: new Date().toISOString(),
    sistema: 'Arena Resenha - Gestão de Horários',
    times,
    horarios
  };
  
  res.setHeader('Content-Disposition', `attachment; filename="arena_resenha_backup_${new Date().toISOString().split('T')[0]}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.json(backup);
});

// ─── Restaurar Backup ─────────────────────────────────────────────────────────
app.post('/api/restaurar', requireAuth, (req, res) => {
  const { times, horarios } = req.body;
  
  if (!times || !horarios) {
    return res.status(400).json({ error: 'Dados inválidos' });
  }
  
  try {
    const transaction = db.transaction(() => {
      // Limpar tabelas
      db.prepare('DELETE FROM horarios').run();
      db.prepare('DELETE FROM times').run();
      
      // Inserir times
      const insertTime = db.prepare(`
        INSERT INTO times (id, nome_time, nome_responsavel, cpf, telefone, endereco, observacoes, data_cadastro)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const t of times) {
        insertTime.run(t.id, t.nome_time, t.nome_responsavel, t.cpf, t.telefone, t.endereco, t.observacoes, t.data_cadastro);
      }
      
      // Inserir horários
      const insertH = db.prepare(`
        INSERT INTO horarios (id, dia_semana, horario_inicio, horario_fim, status_pagamento, time_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      for (const h of horarios) {
        insertH.run(h.id, h.dia_semana, h.horario_inicio, h.horario_fim, h.status_pagamento, h.time_id);
      }
    });
    
    transaction();
    res.json({ success: true, mensagem: 'Backup restaurado com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Servir Frontend ──────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── Iniciar Servidor ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏟️  Arena Resenha - Sistema de Gestão de Horários`);
  console.log(`🚀 Servidor rodando em: http://localhost:${PORT}`);
  console.log(`🔐 Login: admin / admin123\n`);
});
