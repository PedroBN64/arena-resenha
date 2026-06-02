/* ═══════════════════════════════════════════════════════════
   ARENA RESENHA — app.js
   Lógica completa da aplicação SPA
   ═══════════════════════════════════════════════════════════ */

'use strict';

// ── Estado global ──────────────────────────────────────────
const State = {
  horarios: [],
  times: [],
  relatorio: [],
  filtroStatus: 'todos',
  filtroDia: '',
  paginaAtual: 'dashboard',
  horarioSelecionado: null,
  authenticated: false,
  username: ''
};

// ── API Helper ─────────────────────────────────────────────
async function api(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include'
  };
  const token = localStorage.getItem('arena_token');
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

// ── Toast Notifications ────────────────────────────────────
function showToast(msg, type = 'success') {
  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fa-solid ${icons[type]} toast-icon"></i><span class="toast-msg">${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 350);
  }, 3500);
}

// ═══════════════════════════════════════════════════════════
// AUTENTICAÇÃO
// ═══════════════════════════════════════════════════════════
function togglePassword() {
  const input = document.getElementById('login-pass');
  const icon = document.getElementById('eye-icon');
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fa-solid fa-eye-slash';
  } else {
    input.type = 'password';
    icon.className = 'fa-solid fa-eye';
  }
}

async function checkAuth() {
  try {
    const data = await api('GET', '/api/auth/check');
    if (data.authenticated) {
      State.authenticated = true;
      State.username = data.username;
      showApp();
    } else {
      showLogin();
    }
  } catch {
    showLogin();
  }
}

function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('sidebar-username').textContent = State.username || 'Admin';
  init();
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  const errEl = document.getElementById('login-error');
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entrando...';
  errEl.classList.add('hidden');

  try {
    const data = await api('POST', '/api/login', { username, password });
    if (data.token) localStorage.setItem('arena_token', data.token);
    State.authenticated = true;
    State.username = data.username;
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar';
  }
});

async function logout() {
  try {
    await api('POST', '/api/logout');
  } catch {}
  localStorage.removeItem('arena_token');
  State.authenticated = false;
  showLogin();
  showToast('Sessão encerrada com sucesso', 'info');
}

// ═══════════════════════════════════════════════════════════
// INICIALIZAÇÃO
// ═══════════════════════════════════════════════════════════
async function init() {
  await carregarHorarios();
  renderAgenda();
  await carregarDashboard();
  navigateTo('dashboard', document.querySelector('[data-page="dashboard"]'));
}

// ═══════════════════════════════════════════════════════════
// NAVEGAÇÃO
// ═══════════════════════════════════════════════════════════
const PAGE_TITLES = {
  dashboard: 'Dashboard',
  agenda: 'Agenda de Horários',
  historico: 'Histórico',
  relatorios: 'Relatórios'
};

function navigateTo(page, el) {
  // Desativar páginas e nav items
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Ativar página
  document.getElementById(`page-${page}`).classList.add('active');
  if (el) el.classList.add('active');

  // Atualizar título
  document.getElementById('topbar-title').textContent = PAGE_TITLES[page] || page;
  State.paginaAtual = page;

  // Fechar sidebar no mobile
  const sidebar = document.getElementById('sidebar');
  if (window.innerWidth <= 900 && sidebar.classList.contains('open')) {
    toggleSidebar();
  }

  // Carregar dados da página
  if (page === 'historico') carregarHistorico();
}

// ─── Sidebar Toggle ────────────────────────────────────────
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('active');
}

// ═══════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════
async function carregarDashboard() {
  try {
    const data = await api('GET', '/api/dashboard');

    animarNumero('stat-total', data.total);
    animarNumero('stat-ocupados', data.ocupados);
    animarNumero('stat-disponiveis', data.disponiveis);
    animarNumero('stat-pagos', data.pagos);
    animarNumero('stat-inadimplentes', data.nao_pagos);

    const pct = data.total > 0 ? Math.round((data.ocupados / data.total) * 100) : 0;
    document.getElementById('occupancy-percent').textContent = `${pct}%`;
    setTimeout(() => {
      document.getElementById('progress-bar').style.width = `${pct}%`;
    }, 200);

    renderDaysSummary();
  } catch (err) {
    showToast('Erro ao carregar dashboard', 'error');
    console.error(err);
  }
}

function animarNumero(id, alvo) {
  const el = document.getElementById(id);
  if (!el) return;
  const duration = 800;
  const start = performance.now();
  const startVal = parseInt(el.textContent) || 0;

  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(startVal + (alvo - startVal) * eased);
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

function renderDaysSummary() {
  const dias = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
  const shortNames = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
  const container = document.getElementById('days-summary-grid');
  if (!container) return;

  container.innerHTML = dias.map((dia, i) => {
    const slots = State.horarios.filter(h => h.dia_semana === dia);
    const total = slots.length;
    const ocupados = slots.filter(h => h.time_id).length;
    return `
      <div class="day-summary-card">
        <span class="day-name">${shortNames[i]}</span>
        <span class="day-occupancy">${ocupados}</span>
        <span class="day-of-total">de ${total}</span>
      </div>
    `;
  }).join('');
}

// ═══════════════════════════════════════════════════════════
// AGENDA
// ═══════════════════════════════════════════════════════════
async function carregarHorarios() {
  try {
    State.horarios = await api('GET', '/api/horarios');
  } catch (err) {
    showToast('Erro ao carregar horários', 'error');
    console.error(err);
  }
}

function renderAgenda() {
  const grid = document.getElementById('schedule-grid');
  if (!grid) return;

  const dias = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
  const horarios = ['18:00', '19:00', '20:00', '21:00', '22:00', '23:00'];

  grid.innerHTML = dias.map(dia => {
    const slotsHtml = horarios.map(h => {
      const horario = State.horarios.find(x => x.dia_semana === dia && x.horario_inicio === h);
      if (!horario) return '';
      return renderSlotCard(horario);
    }).join('');

    return `
      <div class="schedule-column">
        <div class="day-header">${dia.replace('-feira', '').replace('á', 'a').replace('ã', 'a')}<br><small style="font-size:0.7rem; opacity:0.7">${dia.includes('feira') ? 'FEIRA' : ''}</small></div>
        ${slotsHtml}
      </div>
    `;
  }).join('');
}

function renderSlotCard(h) {
  let stateClass = 'available';
  let statusHtml = '';
  let teamHtml = '';
  let icon = '<i class="fa-solid fa-plus slot-icon" style="color:var(--text-muted)"></i>';

  if (h.time_id) {
    if (h.status_pagamento === 'pago') {
      stateClass = 'paid';
      statusHtml = `<span class="slot-status status-paid"><i class="fa-solid fa-circle-check"></i> Pago</span>`;
      icon = '<i class="fa-solid fa-circle-check slot-icon" style="color:var(--green)"></i>';
    } else {
      stateClass = 'unpaid';
      statusHtml = `<span class="slot-status status-unpaid"><i class="fa-solid fa-circle-exclamation"></i> Não Pago</span>`;
      icon = '<i class="fa-solid fa-triangle-exclamation slot-icon" style="color:var(--red)"></i>';
    }
    teamHtml = `<span class="slot-team">${escapeHtml(h.nome_time || '')}</span>`;
  } else {
    statusHtml = `<span class="slot-status status-available">Disponível</span>`;
  }

  const fim = calcularFim(h.horario_inicio);

  return `
    <div class="slot-card ${stateClass}" onclick="abrirModal(${h.id})" id="slot-${h.id}" title="${h.nome_time || 'Disponível'}">
      ${icon}
      <span class="slot-time">${h.horario_inicio} – ${fim}</span>
      ${teamHtml}
      ${statusHtml}
    </div>
  `;
}

function calcularFim(inicio) {
  const [h, m] = inicio.split(':').map(Number);
  const fimH = (h + 1) % 24;
  return `${String(fimH).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

// ═══════════════════════════════════════════════════════════
// MODAL
// ═══════════════════════════════════════════════════════════
function abrirModal(horarioId) {
  const horario = State.horarios.find(h => h.id === horarioId);
  if (!horario) return;

  State.horarioSelecionado = horario;

  const overlay = document.getElementById('modal-overlay');
  const fim = calcularFim(horario.horario_inicio);
  const diaShort = horario.dia_semana;

  // Título e subtítulo
  document.getElementById('modal-title').innerHTML = `<i class="fa-solid fa-futbol gold"></i> ${horario.time_id ? 'Editar Horário' : 'Cadastrar Time'}`;
  document.getElementById('modal-subtitle').textContent = `${diaShort} · ${horario.horario_inicio} às ${fim}`;

  // Preencher campos
  document.getElementById('horario-id').value = horario.id;
  document.getElementById('time-id').value = horario.time_id || '';
  document.getElementById('nome-time').value = horario.nome_time || '';
  document.getElementById('nome-responsavel').value = horario.nome_responsavel || '';
  document.getElementById('cpf').value = horario.cpf || '';
  document.getElementById('telefone').value = horario.telefone || '';
  document.getElementById('endereco').value = horario.endereco || '';
  document.getElementById('observacoes').value = horario.observacoes || '';

  // Status de pagamento
  const status = horario.status_pagamento || 'nao_pago';
  setStatus(status, false);

  // Mostrar/ocultar botão liberar
  document.getElementById('btn-liberar').style.display = horario.time_id ? 'flex' : 'none';

  overlay.classList.add('active');
  setTimeout(() => document.getElementById('nome-time').focus(), 100);
}

function fecharModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  State.horarioSelecionado = null;
  document.getElementById('time-form').reset();
}

function closeModal(e) {
  if (e.target === document.getElementById('modal-overlay')) fecharModal();
}

function setStatus(status, updateInput = true) {
  const btnPago = document.getElementById('btn-pago');
  const btnNaoPago = document.getElementById('btn-nao-pago');
  const paymentBar = document.getElementById('payment-bar');
  const icon = document.getElementById('payment-icon');
  const text = document.getElementById('payment-text');

  btnPago.classList.toggle('active', status === 'pago');
  btnNaoPago.classList.toggle('active', status === 'nao_pago');

  paymentBar.classList.toggle('paid-state', status === 'pago');
  paymentBar.classList.toggle('unpaid-state', status === 'nao_pago');

  if (status === 'pago') {
    icon.style.color = 'var(--green)';
    text.textContent = '✅ Pagamento em Dia';
    text.style.color = 'var(--green)';
  } else {
    icon.style.color = 'var(--red)';
    text.textContent = '🔴 Pagamento Pendente';
    text.style.color = 'var(--red)';
  }

  if (updateInput) {
    document.getElementById('status-pagamento').value = status;
  } else {
    document.getElementById('status-pagamento').value = status;
  }
}

async function salvarTime(e) {
  e.preventDefault();

  const horarioId = document.getElementById('horario-id').value;
  const nomeTime = document.getElementById('nome-time').value.trim();
  const nomeResponsavel = document.getElementById('nome-responsavel').value.trim();
  const cpf = document.getElementById('cpf').value.trim();
  const telefone = document.getElementById('telefone').value.trim();
  const endereco = document.getElementById('endereco').value.trim();
  const observacoes = document.getElementById('observacoes').value.trim();
  const statusPagamento = document.getElementById('status-pagamento').value;

  if (!nomeTime || !nomeResponsavel) {
    showToast('Nome do time e responsável são obrigatórios', 'error');
    return;
  }

  const btnSalvar = e.target.querySelector('[type="submit"]');
  btnSalvar.disabled = true;
  btnSalvar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

  try {
    await api('PUT', `/api/horarios/${horarioId}`, {
      nome_time: nomeTime,
      nome_responsavel: nomeResponsavel,
      cpf,
      telefone,
      endereco,
      observacoes,
      status_pagamento: statusPagamento
    });

    await carregarHorarios();
    renderAgenda();
    await carregarDashboard();

    fecharModal();
    showToast(`Time "${nomeTime}" salvo com sucesso! ⚽`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar';
  }
}

async function liberarHorario() {
  const horario = State.horarioSelecionado;
  if (!horario) return;

  const nomeTime = document.getElementById('nome-time').value || 'este time';

  if (!confirm(`Tem certeza que deseja liberar o horário de "${nomeTime}"?\n\nO horário ficará disponível novamente.`)) return;

  try {
    await api('DELETE', `/api/horarios/${horario.id}/liberar`);
    await carregarHorarios();
    renderAgenda();
    await carregarDashboard();
    fecharModal();
    showToast('Horário liberado com sucesso!', 'info');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════
// HISTÓRICO
// ═══════════════════════════════════════════════════════════
let debounceTimer;

function buscarTimes() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => carregarHistorico(), 300);
}

function filtrarStatus(status, el) {
  State.filtroStatus = status;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  carregarHistorico();
}

function filtrarDia() {
  State.filtroDia = document.getElementById('day-filter').value;
  carregarHistorico();
}

async function carregarHistorico() {
  const busca = document.getElementById('search-input')?.value.trim() || '';
  const container = document.getElementById('times-list');
  if (!container) return;

  try {
    let url = '/api/times';
    if (busca) url += `?busca=${encodeURIComponent(busca)}`;
    const times = await api('GET', url);

    // Filtrar por status e dia
    let filtrados = times;

    if (State.filtroStatus !== 'todos') {
      filtrados = filtrados.filter(t =>
        t.horarios.some(h => h.status_pagamento === State.filtroStatus)
      );
    }

    if (State.filtroDia) {
      filtrados = filtrados.filter(t =>
        t.horarios.some(h => h.dia_semana === State.filtroDia)
      );
    }

    if (filtrados.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-futbol"></i>
          <h3>Nenhum time encontrado</h3>
          <p>Tente ajustar os filtros de busca ou cadastre um novo time na agenda.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtrados.map(t => renderTimeCard(t)).join('');
  } catch (err) {
    showToast('Erro ao carregar histórico', 'error');
  }
}

function renderTimeCard(time) {
  const slotsHtml = time.horarios.map(h => {
    const cls = h.status_pagamento === 'pago' ? 'paid' : 'unpaid';
    const icon = h.status_pagamento === 'pago' ? '✅' : '🔴';
    return `<span class="slot-chip ${cls}">${icon} ${h.dia_semana.split('-')[0]} ${h.horario_inicio}</span>`;
  }).join('');

  const temInadimplente = time.horarios.some(h => h.status_pagamento === 'nao_pago');
  const badge = temInadimplente
    ? `<span class="badge-unpaid"><i class="fa-solid fa-circle-exclamation"></i> Inadimplente</span>`
    : `<span class="badge-paid"><i class="fa-solid fa-circle-check"></i> Em Dia</span>`;

  const dataCadastro = new Date(time.data_cadastro).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });

  return `
    <div class="time-card">
      <div class="time-card-header">
        <div>
          <div class="time-card-name">⚽ ${escapeHtml(time.nome_time)}</div>
          <div class="time-card-responsible"><i class="fa-solid fa-user" style="color:var(--gold);font-size:0.75rem"></i> ${escapeHtml(time.nome_responsavel)}</div>
        </div>
        ${badge}
      </div>
      <div class="time-card-info">
        ${time.telefone ? `<span class="info-chip"><i class="fa-solid fa-phone"></i> ${escapeHtml(time.telefone)}</span>` : ''}
        ${time.cpf ? `<span class="info-chip"><i class="fa-solid fa-id-card"></i> ${escapeHtml(time.cpf)}</span>` : ''}
        ${time.endereco ? `<span class="info-chip"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(time.endereco.substring(0,40))}${time.endereco.length > 40 ? '...' : ''}</span>` : ''}
        <span class="info-chip"><i class="fa-solid fa-calendar"></i> Desde ${dataCadastro}</span>
      </div>
      ${time.horarios.length > 0 ? `<div class="time-card-slots">${slotsHtml}</div>` : '<p style="font-size:0.8rem;color:var(--text-muted)">Sem horários ativos</p>'}
      ${time.observacoes ? `<p style="font-size:0.8rem;color:var(--text-muted);margin-top:8px;font-style:italic">💬 ${escapeHtml(time.observacoes)}</p>` : ''}
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════
// RELATÓRIOS
// ═══════════════════════════════════════════════════════════
async function gerarRelatorio() {
  const status = document.getElementById('report-status').value;
  const dia = document.getElementById('report-dia').value;

  try {
    let url = '/api/relatorio';
    const params = [];
    if (status) params.push(`status=${encodeURIComponent(status)}`);
    if (dia) params.push(`dia=${encodeURIComponent(dia)}`);
    if (params.length) url += '?' + params.join('&');

    State.relatorio = await api('GET', url);
    renderPreviewRelatorio();
    showToast(`${State.relatorio.length} registros carregados`, 'info');
  } catch (err) {
    showToast('Erro ao gerar relatório', 'error');
  }
}

function renderPreviewRelatorio() {
  const preview = document.getElementById('report-preview');
  const tbody = document.getElementById('report-tbody');
  const total = document.getElementById('report-total');

  preview.style.display = 'block';

  if (State.relatorio.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:30px">Nenhum dado encontrado</td></tr>';
    total.textContent = '';
    return;
  }

  tbody.innerHTML = State.relatorio.map(r => `
    <tr>
      <td>${escapeHtml(r.nome_time)}</td>
      <td>${escapeHtml(r.nome_responsavel)}</td>
      <td>${escapeHtml(r.telefone || '-')}</td>
      <td>${escapeHtml(r.cpf || '-')}</td>
      <td>${escapeHtml(r.dia_semana)}</td>
      <td>${r.horario_inicio} – ${calcularFim(r.horario_inicio)}</td>
      <td>
        <span class="${r.status_pagamento === 'pago' ? 'status-badge-paid' : 'status-badge-unpaid'}">
          ${r.status_pagamento === 'pago' ? '✅ Pago' : '🔴 Não Pago'}
        </span>
      </td>
    </tr>
  `).join('');

  const pagos = State.relatorio.filter(r => r.status_pagamento === 'pago').length;
  const naoPagos = State.relatorio.length - pagos;
  total.innerHTML = `<strong>Total: ${State.relatorio.length} registros</strong> &nbsp;|&nbsp; ✅ Pagos: ${pagos} &nbsp;|&nbsp; 🔴 Não Pagos: ${naoPagos}`;
}

function exportarPDF() {
  if (!State.relatorio.length) {
    showToast('Carregue os dados primeiro!', 'error');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Cabeçalho
  doc.setFillColor(8, 8, 16);
  doc.rect(0, 0, 297, 297, 'F');

  doc.setFontSize(20);
  doc.setTextColor(245, 197, 24);
  doc.text('ARENA RESENHA', 148.5, 18, { align: 'center' });

  doc.setFontSize(11);
  doc.setTextColor(180, 180, 200);
  doc.text('Relatório de Horários e Pagamentos', 148.5, 26, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 140);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR', { dateStyle: 'full' })}`, 148.5, 32, { align: 'center' });

  // Linha decorativa
  doc.setDrawColor(245, 197, 24);
  doc.setLineWidth(0.5);
  doc.line(14, 36, 283, 36);

  // Tabela
  doc.autoTable({
    startY: 42,
    head: [['Time', 'Responsável', 'Telefone', 'CPF', 'Dia', 'Horário', 'Status']],
    body: State.relatorio.map(r => [
      r.nome_time,
      r.nome_responsavel,
      r.telefone || '-',
      r.cpf || '-',
      r.dia_semana,
      `${r.horario_inicio} – ${calcularFim(r.horario_inicio)}`,
      r.status_pagamento === 'pago' ? 'PAGO' : 'NÃO PAGO'
    ]),
    styles: {
      font: 'helvetica',
      fontSize: 9,
      fillColor: [13, 13, 26],
      textColor: [220, 220, 235],
      lineColor: [30, 30, 50],
      lineWidth: 0.3
    },
    headStyles: {
      fillColor: [30, 30, 50],
      textColor: [245, 197, 24],
      fontStyle: 'bold',
      fontSize: 9
    },
    alternateRowStyles: { fillColor: [18, 18, 30] },
    columnStyles: {
      6: {
        cellCallback: (cell, data) => {
          const isPago = data.cell.raw === 'PAGO';
          cell.styles.textColor = isPago ? [0, 230, 118] : [255, 61, 113];
        }
      }
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 6) {
        const isPago = data.cell.raw === 'PAGO';
        doc.setTextColor(...(isPago ? [0, 230, 118] : [255, 61, 113]));
        doc.text(data.cell.raw, data.cell.x + 2, data.cell.y + data.cell.height / 2 + 1, { baseline: 'middle' });
      }
    }
  });

  // Rodapé
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 100);
    doc.text(`Página ${i} de ${pageCount} — Arena Resenha © ${new Date().getFullYear()}`, 148.5, doc.internal.pageSize.height - 8, { align: 'center' });
  }

  doc.save(`arena_resenha_relatorio_${new Date().toISOString().split('T')[0]}.pdf`);
  showToast('PDF exportado com sucesso! 📄', 'success');
}

function exportarExcel() {
  if (!State.relatorio.length) {
    showToast('Carregue os dados primeiro!', 'error');
    return;
  }

  const dados = State.relatorio.map(r => ({
    'Time': r.nome_time,
    'Responsável': r.nome_responsavel,
    'Telefone': r.telefone || '',
    'CPF': r.cpf || '',
    'Dia da Semana': r.dia_semana,
    'Horário': `${r.horario_inicio} – ${calcularFim(r.horario_inicio)}`,
    'Status': r.status_pagamento === 'pago' ? 'PAGO' : 'NÃO PAGO'
  }));

  const ws = XLSX.utils.json_to_sheet(dados);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Horários');

  // Larguras das colunas
  ws['!cols'] = [
    { wch: 25 }, { wch: 25 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 14 }
  ];

  XLSX.writeFile(wb, `arena_resenha_relatorio_${new Date().toISOString().split('T')[0]}.xlsx`);
  showToast('Excel exportado com sucesso! 📊', 'success');
}

// ═══════════════════════════════════════════════════════════
// BACKUP
// ═══════════════════════════════════════════════════════════
async function exportarBackup() {
  try {
    const res = await fetch('/api/backup', { credentials: 'include' });
    if (!res.ok) {
      showToast('Erro ao exportar backup', 'error');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arena_resenha_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup exportado com sucesso! 💾', 'success');
  } catch {
    showToast('Erro ao exportar backup', 'error');
  }
}

async function restaurarBackup(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (!confirm('⚠️ Restaurar o backup irá SOBRESCREVER todos os dados atuais.\n\nTem certeza que deseja continuar?')) {
    e.target.value = '';
    return;
  }

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data.times || !data.horarios) {
      showToast('Arquivo de backup inválido', 'error');
      return;
    }

    await api('POST', '/api/restaurar', data);
    await carregarHorarios();
    renderAgenda();
    await carregarDashboard();
    showToast('Backup restaurado com sucesso! ✅', 'success');
  } catch (err) {
    showToast('Erro ao restaurar backup: ' + err.message, 'error');
  } finally {
    e.target.value = '';
  }
}

// ═══════════════════════════════════════════════════════════
// MÁSCARAS DE FORMULÁRIO
// ═══════════════════════════════════════════════════════════
function mascaraCPF(input) {
  let v = input.value.replace(/\D/g, '').substring(0, 11);
  v = v.replace(/(\d{3})(\d)/, '$1.$2');
  v = v.replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3');
  v = v.replace(/\.(\d{3})(\d)/, '.$1-$2');
  input.value = v;
}

function mascaraTelefone(input) {
  let v = input.value.replace(/\D/g, '').substring(0, 11);
  if (v.length <= 10) {
    v = v.replace(/(\d{2})(\d)/, '($1) $2');
    v = v.replace(/(\d{4})(\d)/, '$1-$2');
  } else {
    v = v.replace(/(\d{2})(\d)/, '($1) $2');
    v = v.replace(/(\d{5})(\d)/, '$1-$2');
  }
  input.value = v;
}

// ═══════════════════════════════════════════════════════════
// UTILITÁRIOS
// ═══════════════════════════════════════════════════════════
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

// Fechar modal com ESC
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') fecharModal();
});

// ─── Inicializar ──────────────────────────────────────────
checkAuth();
