import {
    LoginRequestDTO,
    LoginResponseDTO,
    LogoutRequestDTO,
    RefreshRequestDTO,
    RefreshResponseDTO,
    RegisterFcmRequestDTO,
    GetWorkOrdersRequestDTO,
    GetWorkOrdersResponseDTO,
    GetWorkOrderByIdRequestDTO,
    WorkOrderDetailDTO,
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

    /**
     * Obtiene work orders paginadas filtradas por companyId del JWT (multi-tenancy).
     * Validaciones de paginación aplicadas.
     */
    getWorkOrders(dto: GetWorkOrdersRequestDTO): Promise<GetWorkOrdersResponseDTO>;

    /**
     * Obtiene una work order específica por ID filtrada por companyId del JWT (multi-tenancy).
     * Lanza ValidationError si no existe o no pertenece a la empresa del usuario.
     */
    getWorkOrderById(dto: GetWorkOrderByIdRequestDTO): Promise<WorkOrderDetailDTO>;
}
