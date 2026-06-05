import { UserRowDTO } from './dtos/AuthDTO';

export interface IAuthRepository {
    /**
     * Obtiene un usuario activo por email.
     * Retorna null si el usuario no existe o está inactivo.
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
}
