import { RowDataPacket } from 'mysql2/promise';
import { mysqlClient } from '../core/utils/DatabaseManager';
import { AUTH_QUERIES } from '../core/utils/Constans';
import { QueryFailException } from '../core/common/QueryFailException';
import { IAuthRepository } from './IAuthRepository';
import {
    UserRowDTO,
    GetWorkOrdersRequestDTO,
    GetWorkOrdersResponseDTO,
    WorkOrderDTO,
    GetWorkOrderByIdRequestDTO,
    WorkOrderDetailDTO,
} from './dtos/AuthDTO';

export class AuthRepository implements IAuthRepository {

    async getUserByEmail(email: string): Promise<UserRowDTO | null> {
        const connection = await mysqlClient.getConnection();
        try {
            const [rows]: any = await connection.query(AUTH_QUERIES.GET_USER_BY_EMAIL, [email]);
            return rows.length ? (rows[0] as UserRowDTO) : null;
        } catch (error) {
            console.error('AuthRepository.getUserByEmail error:', error);
            throw new QueryFailException('Error al consultar usuario por email');
        } finally {
            connection.release();
        }
    }

    async updateSessionToken(userId: number, token: string): Promise<void> {
        const connection = await mysqlClient.getConnection();
        try {
            await connection.query(AUTH_QUERIES.UPDATE_SESSION_TOKEN, [token, userId]);
        } catch (error) {
            console.error('AuthRepository.updateSessionToken error:', error);
            throw new QueryFailException('Error al actualizar session token');
        } finally {
            connection.release();
        }
    }

    async clearSessionToken(userId: number): Promise<void> {
        const connection = await mysqlClient.getConnection();
        try {
            await connection.query(AUTH_QUERIES.CLEAR_SESSION_TOKEN, [userId]);
        } catch (error) {
            console.error('AuthRepository.clearSessionToken error:', error);
            throw new QueryFailException('Error al limpiar session token');
        } finally {
            connection.release();
        }
    }

    async upsertFcmToken(userId: number, token: string): Promise<void> {
        const connection = await mysqlClient.getConnection();
        try {
            await connection.query(AUTH_QUERIES.UPSERT_FCM_TOKEN, [userId, token]);
        } catch (error) {
            console.error('AuthRepository.upsertFcmToken error:', error);
            throw new QueryFailException('Error al registrar FCM token');
        } finally {
            connection.release();
        }
    }

    /** RN-CLI-01: verifica que el cliente tenga al menos 1 contrato ACTIVE */
    async clientHasActiveContract(clientId: number): Promise<boolean> {
        const connection = await mysqlClient.getConnection();
        try {
            const [rows] = await connection.query<RowDataPacket[]>(
                AUTH_QUERIES.CHECK_CLIENT_ACTIVE_CONTRACT,
                [clientId]
            );
            return rows.length > 0;
        } catch (error) {
            console.error('AuthRepository.clientHasActiveContract error:', error);
            return false; // en caso de error de BD no bloqueamos el login
        } finally {
            connection.release();
        }
    }

    /**
     * Obtiene los datos de la suscripción activa de la empresa.
     * Retorna usedApi (del plan) y subscriptionStatus (de la suscripción).
     */
    async getSubscriptionFeatures(companyId: number): Promise<{
        usedApi: boolean;
        subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
    }> {
        const connection = await mysqlClient.getConnection();
        try {
            const [rows]: any = await connection.query(
                AUTH_QUERIES.GET_SUBSCRIPTION_PLAN_FEATURES,
                [companyId]
            );

            // Valores por defecto
            if (rows.length === 0) {
                return { usedApi: false, subscriptionStatus: 'TRIAL' };
            }

            const row = rows[0];
            const subscriptionStatus = row.subscription_status || 'TRIAL';
            const usedApiValue = row.used_api;

            // Normalizar usedApi a boolean
            let usedApi = false;

            if (usedApiValue !== null && usedApiValue !== undefined) {
                // Si es string JSON, lo parseamos
                if (typeof usedApiValue === 'string') {
                    try {
                        usedApi = JSON.parse(usedApiValue) === true;
                    } catch {
                        usedApi = usedApiValue.toLowerCase() === 'true';
                    }
                }
                // Si es número (1, 0)
                else if (typeof usedApiValue === 'number') {
                    usedApi = usedApiValue === 1;
                }
                // Si ya es boolean
                else {
                    usedApi = Boolean(usedApiValue);
                }
            }

            return { usedApi, subscriptionStatus };
        } catch (error) {
            console.error('AuthRepository.getSubscriptionFeatures error:', error);
            return { usedApi: false, subscriptionStatus: 'TRIAL' }; // Por defecto en caso de error
        } finally {
            connection.release();
        }
    }

    /**
     * Obtiene work orders paginadas filtradas por companyId (multi-tenancy).
     * Garantiza que solo se retornan work orders de la empresa del usuario autenticado.
     */
    async getWorkOrders(dto: GetWorkOrdersRequestDTO): Promise<GetWorkOrdersResponseDTO> {
        const connection = await mysqlClient.getConnection();
        try {
            // 1. Obtener total de work orders para la empresa
            const [countRows]: any = await connection.query(
                AUTH_QUERIES.COUNT_WORK_ORDERS_BY_COMPANY,
                [dto.companyId]
            );
            const totalElement = countRows[0].total;

            // 2. Calcular offset
            const offset = (dto.pageNumber - 1) * dto.pageSize;

            // 3. Obtener work orders paginadas
            const [rows]: any = await connection.query(
                AUTH_QUERIES.GET_WORK_ORDERS_PAGINATED,
                [dto.companyId, dto.pageSize, offset]
            );

            // 4. Mapear resultados a DTOs
            const workOrders: WorkOrderDTO[] = rows.map((row: any) => ({
                id: row.id,
                uuid: row.uuid,
                companyId: row.companyId,
                companyName: row.companyName,
                client: {
                    id: row.client_id,
                    uuid: row.client_uuid,
                    name: row.client_name,
                    nit: row.client_nit,
                    address: row.client_address,
                },
                technician: row.technician_id ? {
                    id: row.technician_id,
                    uuid: row.technician_uuid,
                    fullName: row.technician_fullName,
                } : null,
                assignmentType: row.assignmentType,
                origin: row.origin,
                contract: row.contract_id ? {
                    id: row.contract_id,
                    name: row.contract_name,
                } : null,
                siteId: row.siteId,
                siteName: row.siteName,
                contractItem: row.contractItem_id ? {
                    id: row.contractItem_id,
                    name: row.contractItem_name,
                } : null,
                checklistTemplate: row.checklistTemplate_id ? {
                    id: row.checklistTemplate_id,
                    name: row.checklistTemplate_name,
                } : null,
                finalCost: row.finalCost,
                parentWorkOrderId: row.parentWorkOrderId,
                workOrderType: {
                    id: row.workOrderType_id,
                    uuid: row.workOrderType_uuid,
                    name: row.workOrderType_name,
                },
                workOrderStatus: {
                    id: row.workOrderStatus_id,
                    uuid: row.workOrderStatus_uuid,
                    name: row.workOrderStatus_name,
                    color: row.workOrderStatus_color,
                    isFinal: Boolean(row.workOrderStatus_isFinal),
                },
                scheduledDate: row.scheduledDate ? row.scheduledDate.toISOString() : null,
                scheduledEnd: row.scheduledEnd ? row.scheduledEnd.toISOString() : null,
                executionStart: row.executionStart ? row.executionStart.toISOString() : null,
                executionEnd: row.executionEnd ? row.executionEnd.toISOString() : null,
                clientSignatureUrl: row.clientSignatureUrl,
                invoiceUrl: row.invoiceUrl,
                reportUrl: row.reportUrl,
                observations: row.observations,
                description: row.description,
                canReopen: Boolean(row.canReopen),
                createdAt: row.createdAt.toISOString(),
                updatedAt: row.updatedAt.toISOString(),
            }));

            // 5. Calcular paginación
            const hasMoreElements = (dto.pageNumber * dto.pageSize) < totalElement;

            return {
                workOrders,
                pagination: {
                    totalElement,
                    pageSize: dto.pageSize,
                    pageNumber: dto.pageNumber,
                    hasMoreElements,
                },
            };
        } catch (error) {
            console.error('AuthRepository.getWorkOrders error:', error);
            throw new QueryFailException('Error al obtener work orders');
        } finally {
            connection.release();
        }
    }

    /**
     * Obtiene una work order específica por ID filtrada por companyId (multi-tenancy).
     * Retorna null si no existe o no pertenece al companyId especificado.
     */
    async getWorkOrderById(dto: GetWorkOrderByIdRequestDTO): Promise<WorkOrderDetailDTO | null> {
        const connection = await mysqlClient.getConnection();
        try {
            const [rows]: any = await connection.query(
                AUTH_QUERIES.GET_WORK_ORDER_BY_ID,
                [dto.workOrderId, dto.companyId]
            );

            if (rows.length === 0) {
                return null;
            }

            const row = rows[0];

            // Mapear el resultado a WorkOrderDetailDTO (sin clientSignatureUrl)
            const workOrder: WorkOrderDetailDTO = {
                id: row.id,
                uuid: row.uuid,
                companyId: row.companyId,
                companyName: row.companyName,
                client: {
                    id: row.client_id,
                    uuid: row.client_uuid,
                    name: row.client_name,
                    nit: row.client_nit,
                    address: row.client_address,
                },
                technician: row.technician_id ? {
                    id: row.technician_id,
                    uuid: row.technician_uuid,
                    fullName: row.technician_fullName,
                } : null,
                assignmentType: row.assignmentType,
                origin: row.origin,
                contract: row.contract_id ? {
                    id: row.contract_id,
                    name: row.contract_name,
                } : null,
                siteId: row.siteId,
                siteName: row.siteName,
                contractItem: row.contractItem_id ? {
                    id: row.contractItem_id,
                    name: row.contractItem_name,
                } : null,
                checklistTemplate: row.checklistTemplate_id ? {
                    id: row.checklistTemplate_id,
                    name: row.checklistTemplate_name,
                } : null,
                finalCost: row.finalCost,
                parentWorkOrderId: row.parentWorkOrderId,
                workOrderType: {
                    id: row.workOrderType_id,
                    uuid: row.workOrderType_uuid,
                    name: row.workOrderType_name,
                },
                workOrderStatus: {
                    id: row.workOrderStatus_id,
                    uuid: row.workOrderStatus_uuid,
                    name: row.workOrderStatus_name,
                    color: row.workOrderStatus_color,
                    isFinal: Boolean(row.workOrderStatus_isFinal),
                },
                scheduledDate: row.scheduledDate ? row.scheduledDate.toISOString() : null,
                scheduledEnd: row.scheduledEnd ? row.scheduledEnd.toISOString() : null,
                executionStart: row.executionStart ? row.executionStart.toISOString() : null,
                executionEnd: row.executionEnd ? row.executionEnd.toISOString() : null,
                // clientSignatureUrl NO incluido
                invoiceUrl: row.invoiceUrl,
                reportUrl: row.reportUrl,
                observations: row.observations,
                description: row.description,
                canReopen: Boolean(row.canReopen),
                createdAt: row.createdAt.toISOString(),
                updatedAt: row.updatedAt.toISOString(),
            };

            return workOrder;
        } catch (error) {
            console.error('AuthRepository.getWorkOrderById error:', error);
            throw new QueryFailException('Error al obtener work order por ID');
        } finally {
            connection.release();
        }
    }
}
