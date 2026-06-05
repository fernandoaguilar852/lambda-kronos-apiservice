import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { ALLOWED_HEADERS_VALUES, GET_COMPANY_BY_APP_ID } from './core/utils/Constans';
import { SwaggerResponseBuilder } from './core/common/SwaggerResponseBuilder';
import { mysqlClient } from './core/utils/DatabaseManager';

import { AuthController } from './controller/AuthController';
import { AuthBL } from './domain/AuthBL';
import { AuthRepository } from './repositories/AuthRepository';
import {
    LoginRequestDTO,
    LogoutRequestDTO,
    RefreshRequestDTO,
    RegisterFcmRequestDTO,
} from './repositories/dtos/AuthDTO';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
    'Content-Type':                 ALLOWED_HEADERS_VALUES.CONTENT_TYPE,
    'Access-Control-Allow-Headers': ALLOWED_HEADERS_VALUES.ALLOWED_HEADERS,
    'Access-Control-Allow-Origin':  ALLOWED_HEADERS_VALUES.ALLOW_ORIGIN,
    'Access-Control-Allow-Methods': ALLOWED_HEADERS_VALUES.ALLOWED_METHODS,
};

function errorResp(statusCode: number, messageUuid: string, requestAppId: string, message: string): APIGatewayProxyResult {
    return {
        statusCode,
        headers: CORS_HEADERS,
        body: JSON.stringify(SwaggerResponseBuilder.buildErrorResponse(
            statusCode,
            [SwaggerResponseBuilder.buildErrorItem(`E${statusCode}`, message)],
            messageUuid,
            requestAppId
        )),
    };
}

/**
 * Valida el header request-app-id contra la BD y devuelve el companyId del tenant.
 * Retorna null si el app_id no existe o la empresa está inactiva.
 */
async function resolveCompanyId(requestAppId: string): Promise<number | null> {
    if (!requestAppId) return null;
    const connection = await mysqlClient.getConnection();
    try {
        const [rows]: any = await connection.query(GET_COMPANY_BY_APP_ID, [requestAppId]);
        return rows.length ? rows[0].id : null;
    } catch {
        return null;
    } finally {
        connection.release();
    }
}

// ─── Lambda Handler ───────────────────────────────────────────────────────────

export const lambdaHandler = async (
    event: APIGatewayProxyEvent,
    _context: Context
): Promise<APIGatewayProxyResult> => {
    try {
        const path   = event.path;
        const method = event.httpMethod;

        // OPTIONS — CORS preflight
        if (method === 'OPTIONS') {
            return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ message: 'CORS preflight successful' }) };
        }

        // Headers estándar
        const messageUuid  = event.headers?.['message-uuid']   || event.headers?.['Message-Uuid']   || '';
        const requestAppId = event.headers?.['request-app-id'] || event.headers?.['Request-App-Id'] || '';

        if (!messageUuid) {
            return errorResp(400, messageUuid, requestAppId, 'Header requerido: message-uuid');
        }

        // Instanciar stack con DI
        const controller = new AuthController(
            new AuthBL(new AuthRepository())
        );

        // ── POST /v1/fsm/auth/login ───────────────────────────────────────────
        // No requiere request-app-id ni validación de tenant.
        // El app_id puede llegar en el body (uso futuro) pero no es obligatorio.
        if (method === 'POST' && path === '/v1/fsm/auth/login') {
            const body = JSON.parse(event.body || '{}') as LoginRequestDTO;
            return controller.login(body, messageUuid, requestAppId || 'auth-service');
        }

        // ── POST /v1/fsm/auth/refresh ─────────────────────────────────────────
        // No requiere validación de tenant — el token es suficiente.
        if (method === 'POST' && path === '/v1/fsm/auth/refresh') {
            const body = JSON.parse(event.body || '{}') as RefreshRequestDTO;
            return controller.refresh(body, messageUuid, requestAppId || 'auth-service');
        }

        // ── Rutas protegidas: requieren request-app-id válido ─────────────────
        if (!requestAppId) {
            return errorResp(400, messageUuid, requestAppId, 'Header requerido: request-app-id');
        }

        const companyId = await resolveCompanyId(requestAppId);
        if (companyId === null) {
            return errorResp(401, messageUuid, requestAppId, 'request-app-id inválido o empresa inactiva');
        }

        // ── POST /v1/fsm/auth/logout ──────────────────────────────────────────
        if (method === 'POST' && path === '/v1/fsm/auth/logout') {
            const body = JSON.parse(event.body || '{}') as LogoutRequestDTO;
            return controller.logout(body, messageUuid, requestAppId);
        }

        // ── POST /v1/fsm/auth/register-fcm ───────────────────────────────────
        if (method === 'POST' && path === '/v1/fsm/auth/register-fcm') {
            const body = JSON.parse(event.body || '{}') as RegisterFcmRequestDTO;
            return controller.registerFcm(body, messageUuid, requestAppId);
        }

        // 404
        return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Endpoint not found', path, method }) };

    } catch (e: any) {
        console.error('lambdaHandler error:', e);
        return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Internal Server Error' }) };
    }
};
