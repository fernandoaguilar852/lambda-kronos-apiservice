import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { IAuthBL } from './IAuthBL';
import { IAuthRepository } from '../repositories/IAuthRepository';
import {
    LoginRequestDTO,
    LoginResponseDTO,
    LogoutRequestDTO,
    RefreshRequestDTO,
    RefreshResponseDTO,
    AuthUserResponseDTO,
    UserRowDTO,
    GetWorkOrdersRequestDTO,
    GetWorkOrdersResponseDTO,
    GetWorkOrderByIdRequestDTO,
    WorkOrderDetailDTO,
} from '../repositories/dtos/AuthDTO';
import { ValidationError } from '../core/common/QueryFailException';

const JWT_SECRET  = process.env.JWT_SECRET  || 'kronos-secret-dev';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '1h';

function buildUserResponse(row: UserRowDTO): AuthUserResponseDTO {
    return {
        id:          row.id,
        uuid:        row.uuid,
        companyId:   row.company_id,
        clientId:    row.client_id,
        role:        row.role,
        firstName:   row.first_name,
        lastName:    row.last_name,
        email:       row.email,
        phone:       row.phone,
        avatarUrl:   row.avatar_url,
        preferences: row.preferences ? JSON.parse(row.preferences) : null,
    };
}

function signToken(payload: object): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES } as jwt.SignOptions);
}

export class AuthBL implements IAuthBL {

    constructor(private readonly repo: IAuthRepository) {}

    async login(dto: LoginRequestDTO): Promise<LoginResponseDTO> {
        if (!dto.email || !dto.password) {
            throw new ValidationError('email y password son requeridos');
        }

        const user = await this.repo.getUserByEmail(dto.email.trim().toLowerCase());
        if (!user) {
            throw new ValidationError('Credenciales inválidas');
        }

        const passwordMatch = await bcrypt.compare(dto.password, user.password);
        if (!passwordMatch) {
            throw new ValidationError('Credenciales inválidas');
        }

        // RN-CLI-01: CLIENT_USER solo puede iniciar sesión si su cliente tiene contrato activo
        if (user.role === 'CLIENT_USER' && user.client_id) {
            const hasContract = await this.repo.clientHasActiveContract(user.client_id);
            if (!hasContract) {
                throw new ValidationError('Su cliente no tiene contratos activos. Contacte a su proveedor de servicios.');
            }
        }

        // Obtener datos de suscripción de la empresa (usedApi y status)
        let usedApi = false;
        let subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' = 'TRIAL';

        if (user.company_id) {
            try {
                const subscriptionData = await this.repo.getSubscriptionFeatures(user.company_id);
                usedApi = subscriptionData.usedApi;
                subscriptionStatus = subscriptionData.subscriptionStatus;
            } catch (err) {
                console.warn('AuthBL.login: getSubscriptionFeatures failed (using defaults):', err);
            }
        }

        const payload = {
            sub:                user.id,
            uuid:               user.uuid,
            email:              user.email,
            role:               user.role,
            companyId:          user.company_id,
            clientId:           user.client_id,
            nombreUsuario:      `${user.first_name} ${user.last_name}`.trim(),
            companyActive:      Boolean(user.company_active),
            usedApi,
            subscriptionStatus,
        };

        const token = signToken(payload);

        return {
            token,
            expiresIn: JWT_EXPIRES,
        };
    }

    async logout(dto: LogoutRequestDTO): Promise<void> {
        if (!dto.userId) {
            throw new ValidationError('userId es requerido');
        }
        // JWT expira en 1 hora - no requiere invalidación en BD
        // El cliente debe eliminar el token de su almacenamiento local
    }

    async refresh(dto: RefreshRequestDTO): Promise<RefreshResponseDTO> {
        if (!dto.token) {
            throw new ValidationError('token es requerido');
        }

        let decoded: any;
        try {
            decoded = jwt.verify(dto.token, JWT_SECRET);
        } catch {
            throw new ValidationError('Token inválido o expirado');
        }

        // Extraer userId del token (campo "sub")
        const userId = decoded.sub;
        if (!userId) {
            throw new ValidationError('Token no contiene información de usuario válida');
        }

        // Consultar datos frescos del usuario desde la BD
        const user = await this.repo.getUserByEmail(decoded.email);
        if (!user) {
            throw new ValidationError('Usuario no encontrado');
        }

        // RN-CLI-01: CLIENT_USER solo puede refrescar token si su cliente tiene contrato activo
        if (user.role === 'CLIENT_USER' && user.client_id) {
            const hasContract = await this.repo.clientHasActiveContract(user.client_id);
            if (!hasContract) {
                throw new ValidationError('Su cliente no tiene contratos activos. Contacte a su proveedor de servicios.');
            }
        }

        // Obtener datos frescos de suscripción de la empresa
        let usedApi = false;
        let subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' = 'TRIAL';

        if (user.company_id) {
            try {
                const subscriptionData = await this.repo.getSubscriptionFeatures(user.company_id);
                usedApi = subscriptionData.usedApi;
                subscriptionStatus = subscriptionData.subscriptionStatus;
            } catch (err) {
                console.warn('AuthBL.refresh: getSubscriptionFeatures failed (using defaults):', err);
            }
        }

        // Generar nuevo token con datos actualizados
        const payload = {
            sub:                user.id,
            uuid:               user.uuid,
            email:              user.email,
            role:               user.role,
            companyId:          user.company_id,
            clientId:           user.client_id,
            nombreUsuario:      `${user.first_name} ${user.last_name}`.trim(),
            companyActive:      Boolean(user.company_active),
            usedApi,
            subscriptionStatus,
        };

        const newToken = signToken(payload);

        return { token: newToken, expiresIn: JWT_EXPIRES };
    }

    async getWorkOrders(dto: GetWorkOrdersRequestDTO): Promise<GetWorkOrdersResponseDTO> {
        // Validar parámetros de paginación
        if (!dto.pageNumber || dto.pageNumber < 1) {
            throw new ValidationError('pageNumber debe ser mayor o igual a 1');
        }
        if (!dto.pageSize || dto.pageSize < 1) {
            throw new ValidationError('pageSize debe ser mayor o igual a 1');
        }
        if (dto.pageSize > 100) {
            throw new ValidationError('pageSize no puede ser mayor a 100');
        }
        if (!dto.companyId) {
            throw new ValidationError('companyId es requerido (extraído del JWT)');
        }

        return this.repo.getWorkOrders(dto);
    }

    async getWorkOrderById(dto: GetWorkOrderByIdRequestDTO): Promise<WorkOrderDetailDTO> {
        // Validar parámetros
        if (!dto.workOrderId || dto.workOrderId < 1) {
            throw new ValidationError('workOrderId debe ser un número válido mayor a 0');
        }
        if (!dto.companyId) {
            throw new ValidationError('companyId es requerido (extraído del JWT)');
        }

        const workOrder = await this.repo.getWorkOrderById(dto);

        if (!workOrder) {
            throw new ValidationError('Work order no encontrada o no pertenece a su empresa');
        }

        return workOrder;
    }
}
