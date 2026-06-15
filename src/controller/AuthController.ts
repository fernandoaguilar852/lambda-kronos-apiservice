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
    RegisterFcmRequestDTO,
    RegisterRequestDTO,
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

    async registerFcm(body: RegisterFcmRequestDTO, messageUuid: string, requestAppId: string): Promise<APIGatewayProxyResult> {
        try {
            await this.bl.registerFcm(body);
            return successResp(HttpStatus.OK, { success: true }, messageUuid, requestAppId, 'FCM token registrado exitosamente');
        } catch (err: any) {
            if (err instanceof ValidationError) {
                return errorResp(HttpStatus.BAD_REQUEST, messageUuid, requestAppId, err.message);
            }
            console.error('AuthController.registerFcm error:', err);
            return errorResp(HttpStatus.INTERNAL_SERVER_ERROR, messageUuid, requestAppId, 'Error interno al registrar FCM token');
        }
    }

    async registerCompany(body: RegisterRequestDTO, messageUuid: string, requestAppId: string): Promise<APIGatewayProxyResult> {
        try {
            const result = await this.bl.registerCompany(body);
            return successResp(
                HttpStatus.CREATED,
                result,
                messageUuid,
                requestAppId,
                '¡Empresa registrada exitosamente! Bienvenido a Kronos.'
            );
        } catch (err: any) {
            if (err instanceof ValidationError) {
                return errorResp(HttpStatus.BAD_REQUEST, messageUuid, requestAppId, err.message);
            }
            console.error('AuthController.registerCompany error:', err);
            return errorResp(HttpStatus.INTERNAL_SERVER_ERROR, messageUuid, requestAppId, 'Error interno al registrar la empresa');
        }
    }
}
