require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'arena-resenha-secret-2024';

let supabase;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn("⚠️ AVISO: SUPABASE_URL ou SUPABASE_KEY não configurados. Crie o arquivo .env com suas credenciais.");
}

// ─── Middlewares ─────────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(__dirname));

// ─── Teste definitivo (remover depois) ──────────────────────────────────────
app.get('/api/teste-salvar', async (req, res) => {
  if (!supabase) return res.json({ erro: 'Supabase não configurado' });

  const log = [];
  try {
    // 1. Buscar um horário de Segunda-feira 18:00 que esteja livre
    log.push('1. Buscando horário livre...');
    const { data: horario, error: e1 } = await supabase
      .from('horarios')
      .select('*')
      .eq('dia_semana', 'Segunda-feira')
      .eq('horario_inicio', '18:00')
      .single();
    if (e1) { log.push('ERRO buscar horário: ' + JSON.stringify(e1)); return res.json({ log }); }
    log.push('   Horário encontrado: id=' + horario.id + ', time_id=' + horario.time_id);

    // 2. Criar um time de teste REAL (não será apagado)
    log.push('2. Inserindo time "TESTE REAL" no Supabase...');
    const { data: newTime, error: e2 } = await supabase
      .from('times')
      .insert([{ nome_time: 'TESTE REAL - ' + new Date().toLocaleString('pt-BR'), nome_responsavel: 'Pedro Teste', cpf: '000.000.000-00', telefone: '(00) 00000-0000', endereco: '', observacoes: 'Criado pelo endpoint de teste' }])
      .select('*')
      .single();
    if (e2) { log.push('ERRO inserir time: ' + JSON.stringify(e2)); return res.json({ log }); }
    log.push('   Time criado com sucesso! id=' + newTime.id + ', nome=' + newTime.nome_time);

    // 3. Vincular o time ao horário
    log.push('3. Atualizando horário id=' + horario.id + ' com time_id=' + newTime.id + '...');
    const { error: e3 } = await supabase
      .from('horarios')
      .update({ time_id: newTime.id, status_pagamento: 'pago', updated_at: new Date().toISOString() })
      .eq('id', horario.id);
    if (e3) { log.push('ERRO atualizar horário: ' + JSON.stringify(e3)); return res.json({ log }); }
    log.push('   Horário atualizado com sucesso!');

    // 4. Ler de volta para confirmar
    log.push('4. Lendo de volta para confirmar...');
    const { data: check, error: e4 } = await supabase
      .from('horarios')
      .select('*, times(*)')
      .eq('id', horario.id)
      .single();
    if (e4) { log.push('ERRO ler de volta: ' + JSON.stringify(e4)); return res.json({ log }); }

    log.push('   RESULTADO FINAL:');
    log.push('   - horario.id = ' + check.id);
    log.push('   - horario.dia_semana = ' + check.dia_semana);
    log.push('   - horario.time_id = ' + check.time_id);
    log.push('   - horario.status_pagamento = ' + check.status_pagamento);
    log.push('   - time.nome_time = ' + (check.times ? check.times.nome_time : 'NULL'));
    log.push('   - time.nome_responsavel = ' + (check.times ? check.times.nome_responsavel : 'NULL'));

    // 5. Contar total de times
    const { data: allTimes } = await supabase.from('times').select('id, nome_time');
    log.push('5. Total de times no banco: ' + (allTimes ? allTimes.length : 0));
    if (allTimes) allTimes.forEach(t => log.push('   - id=' + t.id + ' → ' + t.nome_time));

    log.push('');
    log.push('✅ SUCESSO! Agora atualize a página principal (F5) e veja se o time "TESTE REAL" aparece no slot Segunda 18:00');

    res.json({ sucesso: true, log });
  } catch (err) {
    log.push('❌ EXCEÇÃO: ' + err.message);
    res.json({ sucesso: false, log });
  }
});

// Middleware de autenticação com JWT
function getToken(req) {
  // Tentar cookie primeiro, depois Authorization header
  if (req.cookies && req.cookies.token) return req.cookies.token;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.substring(7);
  return null;
}

function requireAuth(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Não autorizado. Faça login.' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    req.username = decoded.username;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

// ─── Rotas de Inicialização Automática ──────────────────────────────────────
app.post('/api/init', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase não configurado.' });
  
  try {
    // Verificar/Criar Admin
    const { data: adminExists } = await supabase.from('usuarios').select('id').eq('username', 'admin').single();
    if (!adminExists) {
      const hash = bcrypt.hashSync('admin123', 10);
      await supabase.from('usuarios').insert([{ username: 'admin', password: hash }]);
      console.log('✅ Usuário admin criado: admin / admin123');
    }

    // Inicializar Horários
    const dias = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
    const horariosBase = [
      { inicio: '18:00', fim: '19:00' }, { inicio: '19:00', fim: '20:00' },
      { inicio: '20:00', fim: '21:00' }, { inicio: '21:00', fim: '22:00' },
      { inicio: '22:00', fim: '23:00' }, { inicio: '23:00', fim: '00:00' }
    ];

    const { data: currentHorarios } = await supabase.from('horarios').select('id');
    if (!currentHorarios || currentHorarios.length === 0) {
      const inserts = [];
      for (const dia of dias) {
        for (const h of horariosBase) {
          inserts.push({ dia_semana: dia, horario_inicio: h.inicio, horario_fim: h.fim });
        }
      }
      await supabase.from('horarios').insert(inserts);
      console.log('✅ Horários inicializados');
    }

    res.json({ success: true, message: 'Inicialização concluída' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Rotas de Autenticação ────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase não configurado.' });
  const { username, password } = req.body;
  
  if (!username || !password) return res.status(400).json({ error: 'Usuário e senha obrigatórios' });

  try {
    const { data: user, error } = await supabase.from('usuarios').select('*').eq('username', username).single();
    
    if (error || !user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 24 * 60 * 60 * 1000 });
    
    res.json({ success: true, username: user.username, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

app.get('/api/auth/check', (req, res) => {
  const token = getToken(req);
  if (!token) return res.json({ authenticated: false });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ authenticated: true, username: decoded.username });
  } catch {
    res.json({ authenticated: false });
  }
});

// ─── Rotas de Horários ────────────────────────────────────────────────────────
app.get('/api/horarios', async (req, res) => {
  if (!supabase) return res.json([]);
  try {
    const { data: horarios, error } = await supabase.from('horarios').select('*, times(*)');
    if (error) throw error;
    
    // Formatar como o frontend espera (times flat no objeto do horário)
    const formatted = horarios.map(h => {
      const t = h.times || {};
      return {
        ...h,
        nome_time: t.nome_time,
        nome_responsavel: t.nome_responsavel,
        cpf: t.cpf,
        telefone: t.telefone,
        endereco: t.endereco,
        observacoes: t.observacoes,
        time_cadastro: t.data_cadastro
      };
    });
    
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/dashboard', async (req, res) => {
  if (!supabase) return res.json({ total: 0, ocupados: 0, disponiveis: 0, pagos: 0, nao_pagos: 0 });
  try {
    const { data: horarios } = await supabase.from('horarios').select('id, time_id, status_pagamento');
    const total = horarios.length;
    const ocupados = horarios.filter(h => h.time_id !== null).length;
    const disponiveis = total - ocupados;
    const pagos = horarios.filter(h => h.time_id !== null && h.status_pagamento === 'pago').length;
    const nao_pagos = ocupados - pagos;
    
    res.json({ total, ocupados, disponiveis, pagos, nao_pagos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/horarios/:id', requireAuth, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase não configurado. Verifique as variáveis de ambiente na Vercel.' });

  const { id } = req.params;
  const { status_pagamento, nome_time, nome_responsavel, cpf, telefone, endereco, observacoes } = req.body;

  try {
    const { data: horarioAtual, error: fetchErr } = await supabase.from('horarios').select('time_id').eq('id', id).single();
    if (fetchErr) throw fetchErr;
    
    if (nome_time && nome_responsavel) {
      let timeId = horarioAtual.time_id;
      if (timeId) {
        const { error: updateErr } = await supabase.from('times').update({ nome_time, nome_responsavel, cpf: cpf || '', telefone: telefone || '', endereco: endereco || '', observacoes: observacoes || '' }).eq('id', timeId);
        if (updateErr) throw updateErr;
      } else {
        const { data: newTime, error: insertErr } = await supabase.from('times').insert([{ nome_time, nome_responsavel, cpf: cpf || '', telefone: telefone || '', endereco: endereco || '', observacoes: observacoes || '' }]).select('id').single();
        if (insertErr) throw insertErr;
        timeId = newTime.id;
      }
      const { error: horErr } = await supabase.from('horarios').update({ time_id: timeId, status_pagamento: status_pagamento || 'nao_pago', updated_at: new Date().toISOString() }).eq('id', id);
      if (horErr) throw horErr;
    } else if (status_pagamento !== undefined) {
      const { error: statusErr } = await supabase.from('horarios').update({ status_pagamento, updated_at: new Date().toISOString() }).eq('id', id);
      if (statusErr) throw statusErr;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /api/horarios/:id error:', err);
    res.status(500).json({ error: err.message || 'Erro ao salvar horário' });
  }
});

app.delete('/api/horarios/:id/liberar', requireAuth, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase não configurado.' });

  const { id } = req.params;
  try {
    const { error } = await supabase.from('horarios').update({ time_id: null, status_pagamento: 'nao_pago', updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/horarios/:id/liberar error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Rotas de Times ────────────────────────────────────────────────────────────
app.get('/api/times', async (req, res) => {
  const { busca } = req.query;
  try {
    let query = supabase.from('times').select('*, horarios(id, dia_semana, horario_inicio, horario_fim, status_pagamento)');
    if (busca) {
      query = query.or(`nome_time.ilike.%${busca}%,nome_responsavel.ilike.%${busca}%,telefone.ilike.%${busca}%,cpf.ilike.%${busca}%`);
    }
    const { data: times, error } = await query;
    if (error) throw error;
    res.json(times);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Relatório ────────────────────────────────────────────────────────────────
app.get('/api/relatorio', async (req, res) => {
  const { status, dia } = req.query;
  try {
    let query = supabase.from('horarios').select('dia_semana, horario_inicio, horario_fim, status_pagamento, times!inner(nome_time, nome_responsavel, telefone, cpf)').not('time_id', 'is', null);
    
    if (status) query = query.eq('status_pagamento', status);
    if (dia) query = query.eq('dia_semana', dia);

    const { data: dados, error } = await query;
    if (error) throw error;

    const formatted = dados.map(d => ({
      ...d,
      nome_time: d.times.nome_time,
      nome_responsavel: d.times.nome_responsavel,
      telefone: d.times.telefone,
      cpf: d.times.cpf
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Backup ───────────────────────────────────────────────────────────────────
app.get('/api/backup', requireAuth, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase não configurado.' });

  try {
    const { data: times } = await supabase.from('times').select('*');
    const { data: horarios } = await supabase.from('horarios').select('*');
    
    res.setHeader('Content-Disposition', `attachment; filename="arena_resenha_backup_${new Date().toISOString().split('T')[0]}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.json({ exportado_em: new Date().toISOString(), sistema: 'Arena Resenha - Gestão de Horários', times, horarios });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/restaurar', requireAuth, async (req, res) => {
  const { times, horarios } = req.body;
  if (!times || !horarios) return res.status(400).json({ error: 'Dados inválidos' });
  
  try {
    // Limpar tudo
    await supabase.from('horarios').delete().neq('id', 0);
    await supabase.from('times').delete().neq('id', 0);
    
    // Inserir times
    if (times.length > 0) {
      await supabase.from('times').insert(times);
    }
    // Inserir horários
    if (horarios.length > 0) {
      await supabase.from('horarios').insert(horarios);
    }
    
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
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`\n🏟️  Arena Resenha - Servidor Vercel-ready`);
    console.log(`🚀 Rodando em: http://localhost:${PORT}\n`);
  });
}

module.exports = app;
