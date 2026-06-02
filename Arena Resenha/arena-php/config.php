<?php
// ═══════════════════════════════════════════════════════
//  ARENA RESENHA — config.php
//  ⚠️  Edite apenas este arquivo após o upload na Hostinger
// ═══════════════════════════════════════════════════════

// ── Banco de Dados MySQL ────────────────────────────────
define('DB_HOST', 'localhost');       // Normalmente 'localhost' na Hostinger
define('DB_NAME', 'seu_banco');       // Nome do banco criado no hPanel
define('DB_USER', 'seu_usuario');     // Usuário do banco
define('DB_PASS', 'sua_senha');       // Senha do banco
define('DB_CHARSET', 'utf8mb4');

// ── Autenticação do Painel ──────────────────────────────
define('PAINEL_USUARIO', 'admin');
define('PAINEL_SENHA',   'arena2024');  // Altere para uma senha forte!

// ── Configurações Gerais ────────────────────────────────
define('SISTEMA_NOME', 'Arena Resenha — Gestão de Horários');
define('TIMEZONE', 'America/Sao_Paulo');

date_default_timezone_set(TIMEZONE);
