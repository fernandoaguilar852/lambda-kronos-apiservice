-- ============================================================================
-- SCRIPT DDL - Lambda Kronos API Service
-- Tablas y campos para implementación de API externa
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABLA: api_usage_logs
-- Propósito: Auditoría y registro de consumo de API por empresa y usuario
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `api_usage_logs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `company_id` BIGINT NOT NULL COMMENT 'ID de la empresa que consume la API',
  `user_id` BIGINT NULL COMMENT 'ID del usuario (NULL para OAuth API_USER)',
  `endpoint` VARCHAR(255) NOT NULL COMMENT 'Path del endpoint consumido',
  `http_method` ENUM('GET','POST','PUT','DELETE','PATCH') NOT NULL COMMENT 'Método HTTP',
  `status_code` INT NOT NULL COMMENT 'Código de respuesta HTTP (200, 403, 500, etc)',
  `request_timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Timestamp de la petición',
  `response_time_ms` INT NULL COMMENT 'Tiempo de respuesta en milisegundos',
  `ip_address` VARCHAR(45) NULL COMMENT 'IP origen del request',
  `user_agent` VARCHAR(500) NULL COMMENT 'User-Agent del cliente',
  `error_message` TEXT NULL COMMENT 'Mensaje de error si status_code >= 400',

  PRIMARY KEY (`id`),
  INDEX `idx_company_timestamp` (`company_id`, `request_timestamp`),
  INDEX `idx_user_timestamp` (`user_id`, `request_timestamp`),
  INDEX `idx_endpoint` (`endpoint`),
  INDEX `idx_status` (`status_code`),

  CONSTRAINT `fk_api_logs_company`
    FOREIGN KEY (`company_id`)
    REFERENCES `companies` (`id`)
    ON DELETE CASCADE,

  CONSTRAINT `fk_api_logs_user`
    FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Registro de consumo de API para auditoría y reportes';


-- ----------------------------------------------------------------------------
-- 2. CAMPO: features_enabled en subscription_plans
-- Propósito: Almacenar features habilitadas en cada plan (usedApi, etc.)
-- ----------------------------------------------------------------------------
-- Verificar si el campo ya existe, si no, crearlo
ALTER TABLE `subscription_plans`
ADD COLUMN IF NOT EXISTS `features_enabled` JSON NULL
COMMENT 'Features habilitadas en formato JSON: {"usedApi": true/false, ...}';


-- ----------------------------------------------------------------------------
-- 3. POBLAR DATOS: features_enabled con usedApi
-- ----------------------------------------------------------------------------
-- Opción A: Todos los planes tienen API habilitada
UPDATE `subscription_plans`
SET `features_enabled` = JSON_OBJECT('usedApi', true)
WHERE `features_enabled` IS NULL
   OR JSON_EXTRACT(`features_enabled`, '$.usedApi') IS NULL;

-- Opción B: Diferenciar por tipo de plan (descomentar si prefieres esta opción)
/*
UPDATE `subscription_plans`
SET `features_enabled` = JSON_SET(
    COALESCE(`features_enabled`, '{}'),
    '$.usedApi',
    CASE
        WHEN `name` IN ('PREMIUM', 'ENTERPRISE', 'PRO') THEN true
        WHEN `name` IN ('FREE', 'BASIC', 'TRIAL') THEN false
        ELSE true
    END
)
WHERE JSON_EXTRACT(`features_enabled`, '$.usedApi') IS NULL;
*/


-- ============================================================================
-- QUERIES DE VERIFICACIÓN
-- ============================================================================

-- Verificar tabla api_usage_logs
SELECT
    TABLE_NAME,
    TABLE_ROWS,
    CREATE_TIME,
    TABLE_COMMENT
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'api_usage_logs';

-- Verificar estructura de api_usage_logs
DESCRIBE api_usage_logs;

-- Verificar campo features_enabled en subscription_plans
SELECT
    COLUMN_NAME,
    COLUMN_TYPE,
    IS_NULLABLE,
    COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'subscription_plans'
  AND COLUMN_NAME = 'features_enabled';

-- Ver planes con features_enabled poblados
SELECT
    id,
    name,
    features_enabled,
    JSON_EXTRACT(features_enabled, '$.usedApi') AS usedApi_value
FROM subscription_plans;

-- Verificar configuración para una empresa específica
SELECT
    c.id AS company_id,
    c.name AS company_name,
    s.status AS subscription_status,
    sp.name AS plan_name,
    sp.features_enabled,
    COALESCE(
        JSON_EXTRACT(sp.features_enabled, '$.usedApi'),
        false
    ) AS usedApi
FROM companies c
LEFT JOIN subscriptions s ON s.company_id = c.id
LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
WHERE c.id = 1  -- Reemplaza con tu company_id de prueba
ORDER BY s.created_at DESC
LIMIT 1;

-- Ver logs de API recientes
SELECT
    id,
    company_id,
    user_id,
    endpoint,
    http_method,
    status_code,
    response_time_ms,
    request_timestamp,
    error_message
FROM api_usage_logs
ORDER BY request_timestamp DESC
LIMIT 20;


-- ============================================================================
-- QUERIES ÚTILES PARA REPORTES
-- ============================================================================

-- Consumo de API por empresa (últimos 30 días)
SELECT
    company_id,
    COUNT(*) AS total_requests,
    COUNT(CASE WHEN status_code = 200 THEN 1 END) AS successful_requests,
    COUNT(CASE WHEN status_code >= 400 THEN 1 END) AS failed_requests,
    AVG(response_time_ms) AS avg_response_time_ms
FROM api_usage_logs
WHERE request_timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY company_id
ORDER BY total_requests DESC;

-- Endpoints más consultados
SELECT
    endpoint,
    http_method,
    COUNT(*) AS total_calls,
    AVG(response_time_ms) AS avg_response_time_ms
FROM api_usage_logs
WHERE request_timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY endpoint, http_method
ORDER BY total_calls DESC;

-- Errores recientes (últimas 24 horas)
SELECT
    company_id,
    user_id,
    endpoint,
    status_code,
    error_message,
    request_timestamp
FROM api_usage_logs
WHERE status_code >= 400
  AND request_timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
ORDER BY request_timestamp DESC;
