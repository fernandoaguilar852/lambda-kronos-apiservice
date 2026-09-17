/**
 * Constantes base compartidas por todas las lambdas de Kronos.
 * Lambda: lambda-kronos-apiservice — incluye AUTH_QUERIES específicos de autenticación.
 */

// ===========================
// HTTP STATUS CODES
// ===========================
export enum HttpStatus {
    CONTINUE = 100,
    SWITCHING_PROTOCOLS = 101,
    PROCESSING = 102,
    EARLYHINTS = 103,
    OK = 200,
    CREATED = 201,
    ACCEPTED = 202,
    NON_AUTHORITATIVE_INFORMATION = 203,
    NO_CONTENT = 204,
    RESET_CONTENT = 205,
    PARTIAL_CONTENT = 206,
    AMBIGUOUS = 300,
    MOVED_PERMANENTLY = 301,
    FOUND = 302,
    SEE_OTHER = 303,
    NOT_MODIFIED = 304,
    TEMPORARY_REDIRECT = 307,
    PERMANENT_REDIRECT = 308,
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    PAYMENT_REQUIRED = 402,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    METHOD_NOT_ALLOWED = 405,
    NOT_ACCEPTABLE = 406,
    PROXY_AUTHENTICATION_REQUIRED = 407,
    REQUEST_TIMEOUT = 408,
    CONFLICT = 409,
    GONE = 410,
    LENGTH_REQUIRED = 411,
    PRECONDITION_FAILED = 412,
    PAYLOAD_TOO_LARGE = 413,
    URI_TOO_LONG = 414,
    UNSUPPORTED_MEDIA_TYPE = 415,
    REQUESTED_RANGE_NOT_SATISFIABLE = 416,
    EXPECTATION_FAILED = 417,
    I_AM_A_TEAPOT = 418,
    MISDIRECTED = 421,
    UNPROCESSABLE_ENTITY = 422,
    FAILED_DEPENDENCY = 424,
    PRECONDITION_REQUIRED = 428,
    TOO_MANY_REQUESTS = 429,
    INTERNAL_SERVER_ERROR = 500,
    NOT_IMPLEMENTED = 501,
    BAD_GATEWAY = 502,
    SERVICE_UNAVAILABLE = 503,
    GATEWAY_TIMEOUT = 504,
    HTTP_VERSION_NOT_SUPPORTED = 505,
}

// ===========================
// DEFAULT VALUES
// ===========================
export const enum DefaultValues {
    EMPTY_STRING = '',
    ZERO_PORT = 0,
    NODE_ENV_LOCAL = 'LOCAL',
    NODE_ENV_DEV = 'DEV',
    NODE_ENV_PROD = 'PROD',
    NODE_ENV_QA = 'QA',
}

// ===========================
// ERROR MESSAGES
// ===========================
export const enum Message {
    REPOSITORY_ERROR = 'Internal server Error',
    BAD_REQUEST = 'Bad Request Error',
}

export const ERROR_QUERY_EXCEPTION_MESSAGE = 'The database query has fail';

// ===========================
// CORS HEADERS
// ===========================
export enum ALLOWED_HEADERS_VALUES {
    CONTENT_TYPE = 'application/json',
    ALLOWED_HEADERS = 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
    ALLOW_ORIGIN = '*',
    ALLOWED_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
}

// ===========================
// RESPONSE TEMPLATES
// ===========================
export const OPERATION_SUCCESS_RESPONSE = {
    statusCode: 200,
    status: 'Success',
    message: 'Operation Successfully',
};

// ===========================
// QUERY COMPARTIDA — Tenant resolution
// (presente en TODAS las lambdas)
// ===========================
export const GET_COMPANY_BY_APP_ID = `
    SELECT id FROM companies WHERE app_id = ? AND is_active = 1 LIMIT 1
`;

// ===========================
// HELPERS
// ===========================

/** Convierte cualquier valor de fecha a formato MySQL DATETIME: YYYY-MM-DD HH:MM:SS */
export const toMysqlDatetime = (v: string | Date | null | undefined): string | null => {
    if (!v) return null;
    return new Date(v).toISOString().slice(0, 19).replace('T', ' ');
};

// ===========================
// AUTH QUERIES
// ===========================
export const AUTH_QUERIES = {
    // Obtiene usuario con datos de company (is_active)
    GET_USER_BY_EMAIL: `
        SELECT
            u.id, u.uuid, u.company_id, u.client_id, u.first_name, u.last_name,
            u.password, u.email, u.phone, u.role, u.is_active, u.avatar_url,
            u.current_session_token, u.preferences,
            c.is_active AS company_active
        FROM users u
        LEFT JOIN companies c ON u.company_id = c.id
        WHERE u.email = ? AND u.is_active = 1
        LIMIT 1
    `,

    // Obtiene usedApi desde el plan de suscripción activo de la empresa
    // Extrae usedApi del JSON features_enabled, retorna false si no existe o es null
    GET_SUBSCRIPTION_PLAN_FEATURES: `
        SELECT
            COALESCE(
                JSON_EXTRACT(sp.features_enabled, '$.usedApi'),
                false
            ) AS used_api
        FROM subscriptions s
        LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
        WHERE s.company_id = ?
        ORDER BY s.created_at DESC
        LIMIT 1
    `,

    UPDATE_SESSION_TOKEN: `UPDATE users SET current_session_token = ?, updated_at = NOW() WHERE id = ?`,
    CLEAR_SESSION_TOKEN: `UPDATE users SET current_session_token = NULL, updated_at = NOW() WHERE id = ?`,
    UPSERT_FCM_TOKEN: `INSERT INTO user_fcm_tokens (user_id, token) VALUES (?, ?) ON DUPLICATE KEY UPDATE token = VALUES(token)`,

    // RN-CLI-01: Un CLIENT_USER solo puede iniciar sesión si su cliente tiene al menos 1 contrato no INACTIVE
    // Retrocompatible: contratos DRAFT también cuentan (los contratos existentes pueden estar en DRAFT)
    CHECK_CLIENT_ACTIVE_CONTRACT: `
        SELECT cc.id FROM client_contracts cc
        JOIN contracts co ON co.id = cc.contract_id
        WHERE cc.client_id = ? AND co.status != 'INACTIVE'
        LIMIT 1
    `,

    // ── Registro inicial de empresa ───────────────────────────────────────
    CHECK_EMAIL_EXISTS:  `SELECT id FROM users WHERE email = ? LIMIT 1`,
    CHECK_NIT_EXISTS:    `SELECT id FROM companies WHERE nit = ? LIMIT 1`,

    INSERT_COMPANY: `
        INSERT INTO companies (uuid, name, nit, contact_email, message_uuid, app_id)
        VALUES (?, ?, ?, ?, ?, ?)`,

    INSERT_SUBSCRIPTION: `
        INSERT INTO subscriptions (uuid, company_id, plan_id, status, current_period_start, current_period_end)
        VALUES (?, ?, NULL, 'TRIAL', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY))`,

    INSERT_COMPANY_SETTINGS: `
        INSERT INTO company_settings (company_id) VALUES (?)`,

    INSERT_USER: `
        INSERT INTO users (uuid, company_id, role, first_name, last_name, email, phone, password, is_active)
        VALUES (?, ?, 'COMPANY_ADMIN', ?, ?, ?, ?, ?, 1)`,

    // Nota: work_order_types y work_order_statuses son catálogos GLOBALES
    // (no tienen company_id). Se seedean una sola vez en el setup de la BD.
};
