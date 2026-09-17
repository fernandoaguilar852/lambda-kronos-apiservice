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
     * Obtiene el valor usedApi del plan de suscripción activo de la empresa.
     * Retorna false si no hay plan, el plan no existe, o features_enabled.usedApi no está definido.
     */
    getSubscriptionUsedApi(companyId: number): Promise<boolean>;

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
