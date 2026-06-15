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
    RegisterRequestDTO,
    RegisterResponseDTO,
    AuthUserResponseDTO,
    UserRowDTO,
} from '../repositories/dtos/AuthDTO';
import { ValidationError } from '../core/common/QueryFailException';

const JWT_SECRET  = process.env.JWT_SECRET  || 'kronos-secret-dev';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '30d';
const BCRYPT_SALT_ROUNDS = 10;

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

        // Persistir el token de sesión (best-effort — no bloquea el login si falla)
        this.repo.updateSessionToken(user.id, token).catch(err =>
            console.warn('AuthBL.login: updateSessionToken failed (non-critical):', err?.message)
        );

        // Registrar FCM token si viene en el request
        if (dto.fcmToken) {
            this.repo.upsertFcmToken(user.id, dto.fcmToken).catch(err =>
                console.warn('AuthBL.login: upsertFcmToken failed (non-critical):', err?.message)
            );
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
        // Best-effort — el JWT ya no es válido tras expiración sin necesidad de invalidación en BD
        this.repo.clearSessionToken(dto.userId).catch(err =>
            console.warn('AuthBL.logout: clearSessionToken failed (non-critical):', err?.message)
        );
    }

    async refresh(dto: RefreshRequestDTO): Promise<RefreshResponseDTO> {
        if (!dto.token || !dto.userId) {
            throw new ValidationError('token y userId son requeridos');
        }

        let decoded: any;
        try {
            decoded = jwt.verify(dto.token, JWT_SECRET);
        } catch {
            throw new ValidationError('Token inválido o expirado');
        }

        if (decoded.sub !== dto.userId) {
            throw new ValidationError('Token no corresponde al usuario indicado');
        }

        const payload = {
            sub:       decoded.sub,
            uuid:      decoded.uuid,
            role:      decoded.role,
            companyId: decoded.companyId,
            clientId:  decoded.clientId,
        };

        const newToken = signToken(payload);

        this.repo.updateSessionToken(dto.userId, newToken).catch(err =>
            console.warn('AuthBL.refresh: updateSessionToken failed (non-critical):', err?.message)
        );

        return { token: newToken, expiresIn: JWT_EXPIRES };
    }

    async registerFcm(dto: RegisterFcmRequestDTO): Promise<void> {
        if (!dto.userId || !dto.token) {
            throw new ValidationError('userId y token son requeridos');
        }
        await this.repo.upsertFcmToken(dto.userId, dto.token);
    }

    // ── Registro de empresa ───────────────────────────────────────────────────

    async registerCompany(dto: RegisterRequestDTO): Promise<RegisterResponseDTO> {
        // ── Validaciones ──────────────────────────────────────────────────────
        const companyName = dto.company?.name?.trim();
        const firstName   = dto.admin?.firstName?.trim();
        const lastName    = dto.admin?.lastName?.trim();
        const email       = dto.admin?.email?.trim().toLowerCase();
        const password    = dto.admin?.password;

        if (!companyName)  throw new ValidationError('El nombre de la empresa es requerido');
        if (!firstName)    throw new ValidationError('El nombre del administrador es requerido');
        if (!lastName)     throw new ValidationError('El apellido del administrador es requerido');
        if (!email)        throw new ValidationError('El correo electrónico es requerido');
        if (!password)     throw new ValidationError('La contraseña es requerida');
        if (password.length < 8) throw new ValidationError('La contraseña debe tener al menos 8 caracteres');

        // Validación básica de formato email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) throw new ValidationError('El correo electrónico no tiene un formato válido');

        // ── Hash de password ──────────────────────────────────────────────────
        const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

        // ── Normalizar DTO antes de pasar al repo ─────────────────────────────
        const normalizedDto: RegisterRequestDTO = {
            company: { ...dto.company, name: companyName, taxId: dto.company.taxId?.trim() || undefined },
            admin:   { ...dto.admin, firstName, lastName, email },
        };

        // ── Transacción en el repository ──────────────────────────────────────
        let result: { companyId: number; companyUuid: string; appId: string; userId: number; userUuid: string };
        try {
            result = await this.repo.registerCompany(normalizedDto, passwordHash);
        } catch (err: any) {
            if (err.code === 'EMAIL_EXISTS') throw new ValidationError(err.message);
            if (err.code === 'NIT_EXISTS')   throw new ValidationError(err.message);
            throw err;
        }

        // ── Construir JWT de auto-login ───────────────────────────────────────
        const payload = {
            sub:       result.userId,
            uuid:      result.userUuid,
            role:      'COMPANY_ADMIN',
            companyId: result.companyId,
            clientId:  null,
        };
        const token = signToken(payload);

        return {
            token,
            expiresIn: JWT_EXPIRES,
            user: {
                id:          result.userId,
                uuid:        result.userUuid,
                companyId:   result.companyId,
                clientId:    null,
                role:        'COMPANY_ADMIN',
                firstName,
                lastName,
                email,
                phone:       dto.admin.phone?.trim() || null,
                avatarUrl:   null,
                preferences: null,
            },
            company: {
                id:    result.companyId,
                uuid:  result.companyUuid,
                name:  companyName,
                appId: result.appId,
            },
        };
    }
}
