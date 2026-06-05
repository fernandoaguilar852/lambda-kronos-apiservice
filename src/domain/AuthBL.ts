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
    RegisterFcmRequestDTO,
    AuthUserResponseDTO,
    UserRowDTO,
} from '../repositories/dtos/AuthDTO';
import { ValidationError, NotFoundError } from '../core/common/QueryFailException';

const JWT_SECRET  = process.env.JWT_SECRET  || 'kronos-secret-dev';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '30d';

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

        const payload = {
            sub:       user.id,
            uuid:      user.uuid,
            role:      user.role,
            companyId: user.company_id,
            clientId:  user.client_id,
        };

        const token = signToken(payload);

        // Persistir el token de sesión activo
        await this.repo.updateSessionToken(user.id, token);

        // Si viene fcmToken, registrarlo en el mismo paso
        if (dto.fcmToken) {
            try {
                await this.repo.upsertFcmToken(user.id, dto.fcmToken);
            } catch (err) {
                // No bloquear el login si el FCM falla
                console.warn('AuthBL.login: error al registrar FCM token:', err);
            }
        }

        return {
            token,
            expiresIn: JWT_EXPIRES,
            user:      buildUserResponse(user),
        };
    }

    async logout(dto: LogoutRequestDTO): Promise<void> {
        if (!dto.userId) {
            throw new ValidationError('userId es requerido');
        }
        await this.repo.clearSessionToken(dto.userId);
    }

    async refresh(dto: RefreshRequestDTO): Promise<RefreshResponseDTO> {
        if (!dto.token || !dto.userId) {
            throw new ValidationError('token y userId son requeridos');
        }

        let decoded: any;
        try {
            decoded = jwt.verify(dto.token, JWT_SECRET);
        } catch (err) {
            throw new ValidationError('Token inválido o expirado');
        }

        // Verificar que el token pertenece al usuario solicitado
        if (decoded.sub !== dto.userId) {
            throw new ValidationError('Token no corresponde al usuario indicado');
        }

        // Emitir nuevo token con el mismo payload base
        const payload = {
            sub:       decoded.sub,
            uuid:      decoded.uuid,
            role:      decoded.role,
            companyId: decoded.companyId,
            clientId:  decoded.clientId,
        };

        const newToken = signToken(payload);
        await this.repo.updateSessionToken(dto.userId, newToken);

        return {
            token:     newToken,
            expiresIn: JWT_EXPIRES,
        };
    }

    async registerFcm(dto: RegisterFcmRequestDTO): Promise<void> {
        if (!dto.userId || !dto.token) {
            throw new ValidationError('userId y token son requeridos');
        }
        await this.repo.upsertFcmToken(dto.userId, dto.token);
    }
}
