import { APIGatewayProxyResult } from 'aws-lambda';
import {
    LoginRequestDTO,
    LogoutRequestDTO,
    RefreshRequestDTO,
    RegisterFcmRequestDTO,
    RegisterRequestDTO,
    GetWorkOrdersRequestDTO,
    GetWorkOrderByIdRequestDTO,
} from '../repositories/dtos/AuthDTO';

export interface IAuthController {
    login(body: LoginRequestDTO, messageUuid: string, requestAppId: string): Promise<APIGatewayProxyResult>;
    logout(body: LogoutRequestDTO, messageUuid: string, requestAppId: string): Promise<APIGatewayProxyResult>;
    refresh(body: RefreshRequestDTO, messageUuid: string, requestAppId: string): Promise<APIGatewayProxyResult>;
    registerFcm(body: RegisterFcmRequestDTO, messageUuid: string, requestAppId: string): Promise<APIGatewayProxyResult>;
    registerCompany(body: RegisterRequestDTO, messageUuid: string, requestAppId: string): Promise<APIGatewayProxyResult>;
    getWorkOrders(dto: GetWorkOrdersRequestDTO, messageUuid: string, requestAppId: string): Promise<APIGatewayProxyResult>;
    getWorkOrderById(dto: GetWorkOrderByIdRequestDTO, messageUuid: string, requestAppId: string): Promise<APIGatewayProxyResult>;
}
