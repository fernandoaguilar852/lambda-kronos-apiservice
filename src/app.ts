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
    GetWorkOrdersRequestDTO,
    GetWorkOrderByIdRequestDTO,
    ApiUsageLogDTO,
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
 * Registra un log de uso de API de forma asíncrona (fire-and-forget).
 * No bloquea la respuesta al cliente si falla.
 */
function logApiUsage(
    repository: AuthRepository,
    event: APIGatewayProxyEvent,
    response: APIGatewayProxyResult,
    startTime: number,
    companyId: number,
    userId: number | null
): void {
    const responseTimeMs = Date.now() - startTime;
    const logDto: ApiUsageLogDTO = {
        companyId,
        userId,
        endpoint: event.path,
        httpMethod: event.httpMethod as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
        statusCode: response.statusCode,
        responseTimeMs,
        ipAddress: event.requestContext?.identity?.sourceIp || null,
        userAgent: event.headers?.['User-Agent'] || event.headers?.['user-agent'] || null,
        errorMessage: response.statusCode >= 400 ? (JSON.parse(response.body)?.messageResponse?.responseMessage || null) : null,
    };

    // Fire-and-forget: no esperamos el resultado
    repository.insertApiUsageLog(logDto).catch(err =>
        console.warn('Failed to log API usage (non-critical):', err)
    );
}

// ─── Lambda Handler ───────────────────────────────────────────────────────────

export const lambdaHandler = async (
    event: APIGatewayProxyEvent,
    _context: Context
): Promise<APIGatewayProxyResult> => {
    const startTime = Date.now();

    try {
        const path   = event.path;
        const method = event.httpMethod;

        // OPTIONS — CORS preflight
        if (method === 'OPTIONS') {
            return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ message: 'CORS preflight successful' }) };
        }

        const requestId = event.requestContext?.requestId || '';

        // Instanciar stack con DI
        const repository = new AuthRepository();
        const controller = new AuthController(
            new AuthBL(repository)
        );

        // ── POST /v1/fsm/auth/login ───────────────────────────────────────────
        // Ruta PÚBLICA — no requiere JWT
        if (method === 'POST' && path === '/v1/fsm/auth/login') {
            const body = JSON.parse(event.body || '{}') as LoginRequestDTO;
            const response = await controller.login(body, requestId, 'auth-service');

            // Loguear si el login fue exitoso (extraer companyId y userId del usuario)
            if (response.statusCode === 200) {
                try {
                    const user = await repository.getUserByEmail(body.email);
                    if (user && user.company_id) {
                        logApiUsage(repository, event, response, startTime, user.company_id, user.id);
                    }
                } catch (err) {
                    console.warn('Failed to log login API usage:', err);
                }
            }
            return response;
        }

        // ── POST /v1/fsm/auth/refresh ─────────────────────────────────────────
        // Ruta PÚBLICA — token viene en el body
        if (method === 'POST' && path === '/v1/fsm/auth/refresh') {
            const body = JSON.parse(event.body || '{}') as RefreshRequestDTO;
            const response = await controller.refresh(body, requestId, 'auth-service');

            // Loguear si el refresh fue exitoso (extraer companyId y userId del token)
            if (response.statusCode === 200 && body.token) {
                try {
                    const decoded = verifyJwt(`Bearer ${body.token}`);
                    if (decoded.companyId) {
                        logApiUsage(repository, event, response, startTime, decoded.companyId, decoded.sub);
                    }
                } catch (err) {
                    console.warn('Failed to log refresh API usage:', err);
                }
            }
            return response;
        }

        // ── Rutas protegidas — requieren JWT válido ───────────────────────────
        let jwtPayload: JwtPayload;
        try {
            jwtPayload = verifyJwt(event.headers?.['Authorization'] || event.headers?.['authorization']);
        } catch {
            // No podemos loguear aquí porque no tenemos companyId ni userId del JWT inválido
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
            const response = await controller.logout(body, requestId, requestAppId);
            logApiUsage(repository, event, response, startTime, companyId, userId);
            return response;
        }

        // ── Validaciones de permisos para endpoints GET /v1/fsm/external/* ────
        // Solo usuarios con rol COMPANY_ADMIN o SUPER_ADMIN pueden consultar
        if (method === 'GET' && path.startsWith('/v1/fsm/external/')) {
            // Validación 1: Rol debe ser COMPANY_ADMIN o SUPER_ADMIN
            if (jwtPayload.role !== 'COMPANY_ADMIN' && jwtPayload.role !== 'SUPER_ADMIN') {
                const response = errorResp(403, requestId, requestAppId, 'No tiene el usuario correcto para poder realizar la consulta');
                logApiUsage(repository, event, response, startTime, companyId, userId);
                return response;
            }

            // Validación 2: usedApi debe ser true
            if (!jwtPayload.usedApi) {
                const response = errorResp(403, requestId, requestAppId, 'No tiene los permisos para consultar la API, comuníquese con el proveedor del servicio');
                logApiUsage(repository, event, response, startTime, companyId, userId);
                return response;
            }
        }

        // ── GET /v1/fsm/external/work-orders ──────────────────────────────────
        // Ruta PROTEGIDA — requiere JWT + query params pageNumber y pageSize OBLIGATORIOS
        if (method === 'GET' && path === '/v1/fsm/external/work-orders') {
            const queryParams = event.queryStringParameters || {};

            // Validar query params obligatorios
            if (!queryParams.pageNumber || !queryParams.pageSize) {
                const response = errorResp(400, requestId, requestAppId, 'Query params obligatorios: pageNumber y pageSize');
                logApiUsage(repository, event, response, startTime, companyId, userId);
                return response;
            }

            const dto: GetWorkOrdersRequestDTO = {
                pageNumber: parseInt(queryParams.pageNumber, 10),
                pageSize: parseInt(queryParams.pageSize, 10),
                companyId, // ⭐ Del JWT - garantiza multi-tenancy
            };

            const response = await controller.getWorkOrders(dto, requestId, requestAppId);
            logApiUsage(repository, event, response, startTime, companyId, userId);
            return response;
        }

        // ── GET /v1/fsm/external/work-orders/{id} ─────────────────────────────────
        // Ruta PROTEGIDA — requiere JWT + pathParameter id
        if (method === 'GET' && path.startsWith('/v1/fsm/external/work-orders/')) {
            const pathParts = path.split('/');
            const workOrderId = parseInt(pathParts[pathParts.length - 1], 10);

            if (isNaN(workOrderId) || workOrderId < 1) {
                const response = errorResp(400, requestId, requestAppId, 'ID de work order inválido');
                logApiUsage(repository, event, response, startTime, companyId, userId);
                return response;
            }

            const dto: GetWorkOrderByIdRequestDTO = {
                workOrderId,
                companyId, // ⭐ Del JWT - garantiza multi-tenancy
            };

            const response = await controller.getWorkOrderById(dto, requestId, requestAppId);
            logApiUsage(repository, event, response, startTime, companyId, userId);
            return response;
        }

        // 404
        return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Endpoint not found', path, method }) };

    } catch (e: any) {
        console.error('lambdaHandler error:', e);
        return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Internal Server Error' }) };
    }
};
