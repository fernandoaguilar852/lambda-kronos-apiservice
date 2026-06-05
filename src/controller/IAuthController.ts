import { APIGatewayProxyResult } from 'aws-lambda';
import {
    LoginRequestDTO,
    LogoutRequestDTO,
    RefreshRequestDTO,
    RegisterFcmRequestDTO,
} from '../repositories/dtos/AuthDTO';

export interface IAuthController {
    login(body: LoginRequestDTO, messageUuid: string, requestAppId: string): Promise<APIGatewayProxyResult>;
    logout(body: LogoutRequestDTO, messageUuid: string, requestAppId: string): Promise<APIGatewayProxyResult>;
    refresh(body: RefreshRequestDTO, messageUuid: string, requestAppId: string): Promise<APIGatewayProxyResult>;
    registerFcm(body: RegisterFcmRequestDTO, messageUuid: string, requestAppId: string): Promise<APIGatewayProxyResult>;
}
