import { UserRowDTO, RegisterRequestDTO, RegisterResponseDTO } from './dtos/AuthDTO';

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
     * Inserta o actualiza el FCM token del usuario en user_fcm_tokens.
     */
    upsertFcmToken(userId: number, token: string): Promise<void>;

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
     * Registra una nueva empresa con su usuario administrador.
     * Ejecuta la transacción completa: company + subscription + settings + user.
     * Retorna los IDs y UUIDs generados para construir el JWT.
     */
    registerCompany(dto: RegisterRequestDTO, passwordHash: string): Promise<{
        companyId:   number;
        companyUuid: string;
        appId:       string;
        userId:      number;
        userUuid:    string;
    }>;
}
