<?php
// ═══════════════════════════════════════════════════════
//  ARENA RESENHA — db.php
//  Conexão PDO singleton + helpers
// ═══════════════════════════════════════════════════════

require_once __DIR__ . '/config.php';

function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST
             . ';dbname=' . DB_NAME
             . ';charset=' . DB_CHARSET;
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::MYSQL_ATTR_INIT_COMMAND => 'SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci',
        ];
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            http_response_code(500);
            die('<div style="font-family:monospace;background:#1a0a0a;color:#ff6b6b;padding:20px;margin:40px auto;max-width:600px;border-radius:8px;border:1px solid #ff3d71">
                <strong>⛔ Erro de conexão com o banco de dados</strong><br><br>'
                . htmlspecialchars($e->getMessage()) .
                '<br><br>Verifique as credenciais em <code>config.php</code>
            </div>');
        }
    }
    return $pdo;
}

// ── Helpers ─────────────────────────────────────────────

/** Retorna todos os agendamentos ordenados por dia e horário */
function getAgendamentos(): array {
    $pdo = getDB();
    $sql = "SELECT * FROM agendamentos
            ORDER BY
              FIELD(dia_semana,
                'Segunda-feira','Terça-feira','Quarta-feira',
                'Quinta-feira','Sexta-feira','Sábado','Domingo'),
              horario";
    return $pdo->query($sql)->fetchAll();
}

/** Retorna um agendamento pelo ID */
function getAgendamentoById(int $id): ?array {
    $pdo  = getDB();
    $stmt = $pdo->prepare('SELECT * FROM agendamentos WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row ?: null;
}

/** Verifica se existe OUTRO agendamento ocupado no mesmo slot */
function slotOcupado(string $dia, string $horario, int $excludeId = 0): bool {
    $pdo  = getDB();
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM agendamentos
         WHERE dia_semana = ? AND horario = ? AND occupied = 1 AND id != ?'
    );
    $stmt->execute([$dia, $horario, $excludeId]);
    return (int)$stmt->fetchColumn() > 0;
}

// ── Autenticação ─────────────────────────────────────────

function iniciarSessao(): void {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
}

function estaAutenticado(): bool {
    iniciarSessao();
    return !empty($_SESSION['arena_auth']);
}

function requireAuth(): void {
    if (!estaAutenticado()) {
        header('Location: login.php');
        exit;
    }
}
