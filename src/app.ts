import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { ALLOWED_HEADERS_VALUES } from './core/utils/Constans';
import { SwaggerResponseBuilder } from './core/common/SwaggerResponseBuilder';
import { verifyJwt, JwtPayload } from './core/utils/JwtMiddleware';

import { AuthController } from './controller/AuthController';
import { AuthBL } from './domain/AuthBL';
import { AuthRepository } from './repositories/AuthRepository';
import {
    LoginRequestDTO,
    LogoutRequestDTO,
    RefreshRequestDTO,
    RegisterFcmRequestDTO,
    RegisterRequestDTO,
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

        const requestId = event.requestContext?.requestId || '';

        // Instanciar stack con DI
        const controller = new AuthController(
            new AuthBL(new AuthRepository())
        );

        // ── POST /v1/fsm/auth/register ────────────────────────────────────────
        // Ruta PÚBLICA — crea empresa + usuario administrador + suscripción TRIAL
        if (method === 'POST' && path === '/v1/fsm/auth/register') {
            const body = JSON.parse(event.body || '{}') as RegisterRequestDTO;
            return controller.registerCompany(body, requestId, 'auth-service');
        }

        // ── POST /v1/fsm/auth/login ───────────────────────────────────────────
        // Ruta PÚBLICA — no requiere JWT
        if (method === 'POST' && path === '/v1/fsm/auth/login') {
            const body = JSON.parse(event.body || '{}') as LoginRequestDTO;
            return controller.login(body, requestId, 'auth-service');
        }

        // ── POST /v1/fsm/auth/refresh ─────────────────────────────────────────
        // Ruta PÚBLICA — token viene en el body
        if (method === 'POST' && path === '/v1/fsm/auth/refresh') {
            const body = JSON.parse(event.body || '{}') as RefreshRequestDTO;
            return controller.refresh(body, requestId, 'auth-service');
        }

        // ── Rutas protegidas — requieren JWT válido ───────────────────────────
        let jwtPayload: JwtPayload;
        try {
            jwtPayload = verifyJwt(event.headers?.['Authorization'] || event.headers?.['authorization']);
        } catch {
            return errorResp(401, requestId, 'auth-service', 'Token de autorización inválido o expirado');
        }

        const userId       = jwtPayload.sub;
        const companyId    = jwtPayload.companyId;
        const requestAppId = String(companyId);

        // ── POST /v1/fsm/auth/logout ──────────────────────────────────────────
        if (method === 'POST' && path === '/v1/fsm/auth/logout') {
            // Tomar userId del JWT (ignorar body.userId si se envía)
            const body = JSON.parse(event.body || '{}') as LogoutRequestDTO;
            body.userId = userId;
            return controller.logout(body, requestId, requestAppId);
        }

        // ── POST /v1/fsm/auth/register-fcm ───────────────────────────────────
        if (method === 'POST' && path === '/v1/fsm/auth/register-fcm') {
            const body = JSON.parse(event.body || '{}') as RegisterFcmRequestDTO;
            body.userId = userId;
            return controller.registerFcm(body, requestId, requestAppId);
        }

        // 404
        return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Endpoint not found', path, method }) };

    } catch (e: any) {
        console.error('lambdaHandler error:', e);
        return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Internal Server Error' }) };
    }
};
