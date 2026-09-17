import { APIGatewayProxyResult } from 'aws-lambda';
import { IAuthController } from './IAuthController';
import { IAuthBL } from '../domain/IAuthBL';
import { SwaggerResponseBuilder } from '../core/common/SwaggerResponseBuilder';
import { ALLOWED_HEADERS_VALUES, HttpStatus } from '../core/utils/Constans';
import { ValidationError } from '../core/common/QueryFailException';
import {
    LoginRequestDTO,
    LogoutRequestDTO,
    RefreshRequestDTO,
    GetWorkOrdersRequestDTO,
    GetWorkOrderByIdRequestDTO,
} from '../repositories/dtos/AuthDTO';

const CORS_HEADERS = {
    'Content-Type':                 ALLOWED_HEADERS_VALUES.CONTENT_TYPE,
    'Access-Control-Allow-Headers': ALLOWED_HEADERS_VALUES.ALLOWED_HEADERS,
    'Access-Control-Allow-Origin':  ALLOWED_HEADERS_VALUES.ALLOW_ORIGIN,
    'Access-Control-Allow-Methods': ALLOWED_HEADERS_VALUES.ALLOWED_METHODS,
};

function successResp(statusCode: number, data: any, messageUuid: string, requestAppId: string, message?: string): APIGatewayProxyResult {
    return {
        statusCode,
        headers: CORS_HEADERS,
        body: JSON.stringify(
            SwaggerResponseBuilder.buildSuccessResponse(statusCode, data, messageUuid, requestAppId, '0000', 'Success', message || 'Operation completed successfully')
        ),
    };
}

function errorResp(statusCode: number, messageUuid: string, requestAppId: string, detail: string): APIGatewayProxyResult {
    return {
        statusCode,
        headers: CORS_HEADERS,
        body: JSON.stringify(
            SwaggerResponseBuilder.buildErrorResponse(
                statusCode,
                [SwaggerResponseBuilder.buildErrorItem(`E${statusCode}`, detail)],
                messageUuid,
                requestAppId
            )
        ),
    };
}

export class AuthController implements IAuthController {

    constructor(private readonly bl: IAuthBL) {}

    async login(body: LoginRequestDTO, messageUuid: string, requestAppId: string): Promise<APIGatewayProxyResult> {
        try {
            const result = await this.bl.login(body);
            return successResp(HttpStatus.OK, result, messageUuid, requestAppId, 'Login exitoso');
        } catch (err: any) {
            if (err instanceof ValidationError) {
                return errorResp(HttpStatus.UNAUTHORIZED, messageUuid, requestAppId, err.message);
            }
            console.error('AuthController.login error:', err);
            return errorResp(HttpStatus.INTERNAL_SERVER_ERROR, messageUuid, requestAppId, 'Error interno al procesar login');
        }
    }

    async logout(body: LogoutRequestDTO, messageUuid: string, requestAppId: string): Promise<APIGatewayProxyResult> {
        try {
            await this.bl.logout(body);
            return successResp(HttpStatus.OK, { success: true }, messageUuid, requestAppId, 'Sesión cerrada exitosamente');
        } catch (err: any) {
            if (err instanceof ValidationError) {
                return errorResp(HttpStatus.BAD_REQUEST, messageUuid, requestAppId, err.message);
            }
            console.error('AuthController.logout error:', err);
            return errorResp(HttpStatus.INTERNAL_SERVER_ERROR, messageUuid, requestAppId, 'Error interno al procesar logout');
        }
    }

    async refresh(body: RefreshRequestDTO, messageUuid: string, requestAppId: string): Promise<APIGatewayProxyResult> {
        try {
            const result = await this.bl.refresh(body);
            return successResp(HttpStatus.OK, result, messageUuid, requestAppId, 'Token renovado exitosamente');
        } catch (err: any) {
            if (err instanceof ValidationError) {
                return errorResp(HttpStatus.UNAUTHORIZED, messageUuid, requestAppId, err.message);
            }
            console.error('AuthController.refresh error:', err);
            return errorResp(HttpStatus.INTERNAL_SERVER_ERROR, messageUuid, requestAppId, 'Error interno al renovar token');
        }
    }

    async getWorkOrders(dto: GetWorkOrdersRequestDTO, messageUuid: string, requestAppId: string): Promise<APIGatewayProxyResult> {
        try {
            const result = await this.bl.getWorkOrders(dto);
            return successResp(
                HttpStatus.OK,
                result,
                messageUuid,
                requestAppId,
                'Work orders obtenidas exitosamente'
            );
        } catch (err: any) {
            if (err instanceof ValidationError) {
                return errorResp(HttpStatus.BAD_REQUEST, messageUuid, requestAppId, err.message);
            }
            console.error('AuthController.getWorkOrders error:', err);
            return errorResp(HttpStatus.INTERNAL_SERVER_ERROR, messageUuid, requestAppId, 'Error interno al obtener work orders');
        }
    }

    async getWorkOrderById(dto: GetWorkOrderByIdRequestDTO, messageUuid: string, requestAppId: string): Promise<APIGatewayProxyResult> {
        try {
            const result = await this.bl.getWorkOrderById(dto);
            return successResp(
                HttpStatus.OK,
                result,
                messageUuid,
                requestAppId,
                'Work order obtenida exitosamente'
            );
        } catch (err: any) {
            if (err instanceof ValidationError) {
                return errorResp(HttpStatus.NOT_FOUND, messageUuid, requestAppId, err.message);
            }
            console.error('AuthController.getWorkOrderById error:', err);
            return errorResp(HttpStatus.INTERNAL_SERVER_ERROR, messageUuid, requestAppId, 'Error interno al obtener work order');
        }
    }
}
