import {
    UserRowDTO,
    GetWorkOrdersRequestDTO,
    GetWorkOrdersResponseDTO,
    GetWorkOrderByIdRequestDTO,
    WorkOrderDetailDTO,
} from './dtos/AuthDTO';

export interface IAuthRepository {
    /**
     * Obtiene un usuario activo por email.
     * Retorna null si el usuario no existe o está inactivo.
     * Incluye company_active desde la tabla companies.
     */
    getUserByEmail(email: string): Promise<UserRowDTO | null>;

    /**
     * Actualiza el current_session_token del usuario.
     */
    updateSessionToken(userId: number, token: string): Promise<void>;

    /**
     * Limpia el current_session_token (logout).
     */
    clearSessionToken(userId: number): Promise<void>;

    /**
     * RN-CLI-01: Verifica que el cliente tenga al menos 1 contrato ACTIVE.
     * Solo relevante para usuarios con rol CLIENT_USER.
     */
    clientHasActiveContract(clientId: number): Promise<boolean>;

    /**
     * Obtiene los datos de la suscripción activa de la empresa.
     * Retorna usedApi (del plan) y subscriptionStatus (de la suscripción).
     * Valores por defecto: usedApi=false, subscriptionStatus='TRIAL'.
     */
    getSubscriptionFeatures(companyId: number): Promise<{
        usedApi: boolean;
        subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
    }>;

    /**
     * Obtiene work orders paginadas filtradas por companyId (multi-tenancy).
     * El companyId viene del JWT - garantiza que solo se retornan work orders de la empresa del usuario.
     */
    getWorkOrders(dto: GetWorkOrdersRequestDTO): Promise<GetWorkOrdersResponseDTO>;

    /**
     * Obtiene una work order específica por ID filtrada por companyId (multi-tenancy).
     * El companyId viene del JWT - garantiza que solo se retorna si pertenece a la empresa del usuario.
     * Retorna null si la work order no existe o no pertenece al companyId.
     */
    getWorkOrderById(dto: GetWorkOrderByIdRequestDTO): Promise<WorkOrderDetailDTO | null>;
}
