import {
    LoginRequestDTO,
    LoginResponseDTO,
    LogoutRequestDTO,
    RefreshRequestDTO,
    RefreshResponseDTO,
    RegisterFcmRequestDTO,
} from '../repositories/dtos/AuthDTO';

export interface IAuthBL {
    /**
     * Autentica email + password con bcrypt.
     * Genera JWT de 30 días y lo persiste en current_session_token.
     * Retorna token + datos del usuario (sin password ni current_session_token).
     */
    login(dto: LoginRequestDTO): Promise<LoginResponseDTO>;

    /**
     * Invalida la sesión del usuario limpiando current_session_token.
     */
    logout(dto: LogoutRequestDTO): Promise<void>;

    /**
     * Verifica el JWT recibido y, si es válido, emite un nuevo token.
     */
    refresh(dto: RefreshRequestDTO): Promise<RefreshResponseDTO>;

    /**
     * Inserta o actualiza el FCM token del usuario para notificaciones push.
     */
    registerFcm(dto: RegisterFcmRequestDTO): Promise<void>;
}
