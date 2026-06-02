-- ═══════════════════════════════════════════════════════
--  ARENA RESENHA — setup.sql
--  Execute uma única vez no MySQL do hPanel / phpMyAdmin
-- ═══════════════════════════════════════════════════════

-- Tabela principal de agendamentos
CREATE TABLE IF NOT EXISTS `agendamentos` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `dia_semana`  VARCHAR(20)  NOT NULL,
  `horario`     VARCHAR(5)   NOT NULL,
  `team`        VARCHAR(100) NOT NULL DEFAULT '',
  `resp`        VARCHAR(100) NOT NULL DEFAULT '',
  `cpf`         VARCHAR(20)  NOT NULL DEFAULT '',
  `tel`         VARCHAR(20)  NOT NULL DEFAULT '',
  `addr`        VARCHAR(255) NOT NULL DEFAULT '',
  `obs`         TEXT,
  `status`      ENUM('pago','nao_pago') NOT NULL DEFAULT 'nao_pago',
  `occupied`    TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at`  DATETIME     DEFAULT NULL,
  -- Trava: impede dois agendamentos no mesmo dia e horário
  UNIQUE KEY `uk_slot` (`dia_semana`, `horario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Inserir os 42 slots padrão (7 dias × 6 horários: 18h–23h)
-- INSERT IGNORE ignora se o slot já existe
INSERT IGNORE INTO `agendamentos` (`dia_semana`, `horario`) VALUES
  ('Segunda-feira','18:00'), ('Segunda-feira','19:00'), ('Segunda-feira','20:00'),
  ('Segunda-feira','21:00'), ('Segunda-feira','22:00'), ('Segunda-feira','23:00'),
  ('Terça-feira', '18:00'), ('Terça-feira', '19:00'), ('Terça-feira', '20:00'),
  ('Terça-feira', '21:00'), ('Terça-feira', '22:00'), ('Terça-feira', '23:00'),
  ('Quarta-feira','18:00'), ('Quarta-feira','19:00'), ('Quarta-feira','20:00'),
  ('Quarta-feira','21:00'), ('Quarta-feira','22:00'), ('Quarta-feira','23:00'),
  ('Quinta-feira','18:00'), ('Quinta-feira','19:00'), ('Quinta-feira','20:00'),
  ('Quinta-feira','21:00'), ('Quinta-feira','22:00'), ('Quinta-feira','23:00'),
  ('Sexta-feira', '18:00'), ('Sexta-feira', '19:00'), ('Sexta-feira', '20:00'),
  ('Sexta-feira', '21:00'), ('Sexta-feira', '22:00'), ('Sexta-feira', '23:00'),
  ('Sábado',      '18:00'), ('Sábado',      '19:00'), ('Sábado',      '20:00'),
  ('Sábado',      '21:00'), ('Sábado',      '22:00'), ('Sábado',      '23:00'),
  ('Domingo',     '18:00'), ('Domingo',     '19:00'), ('Domingo',     '20:00'),
  ('Domingo',     '21:00'), ('Domingo',     '22:00'), ('Domingo',     '23:00');
