import crypto from 'crypto';
import { RowDataPacket } from 'mysql2/promise';
import { mysqlClient } from '../core/utils/DatabaseManager';
import { AUTH_QUERIES } from '../core/utils/Constans';
import { QueryFailException } from '../core/common/QueryFailException';
import { IAuthRepository } from './IAuthRepository';
import { UserRowDTO, RegisterRequestDTO } from './dtos/AuthDTO';

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

    async registerCompany(
        dto: RegisterRequestDTO,
        passwordHash: string
    ): Promise<{ companyId: number; companyUuid: string; appId: string; userId: number; userUuid: string }> {
        const connection = await mysqlClient.getConnection();
        try {
            await connection.beginTransaction();

            // UUIDs generados server-side
            const companyUuid   = crypto.randomUUID();
            const appId         = crypto.randomUUID();
            const messageUuid   = crypto.randomUUID();
            const subUuid       = crypto.randomUUID();
            const userUuid      = crypto.randomUUID();

            const nit = dto.company.taxId?.trim() || null;

            // 1. Verificar unicidad de email
            const [emailRows]: any = await connection.query(AUTH_QUERIES.CHECK_EMAIL_EXISTS, [dto.admin.email.trim().toLowerCase()]);
            if (emailRows.length > 0) {
                await connection.rollback();
                const err: any = new Error('El correo electrónico ya está registrado');
                err.code = 'EMAIL_EXISTS';
                throw err;
            }

            // 2. Verificar unicidad de NIT (solo si se proporcionó)
            if (nit) {
                const [nitRows]: any = await connection.query(AUTH_QUERIES.CHECK_NIT_EXISTS, [nit]);
                if (nitRows.length > 0) {
                    await connection.rollback();
                    const err: any = new Error('El NIT ya está registrado en el sistema');
                    err.code = 'NIT_EXISTS';
                    throw err;
                }
            }

            // 3. Crear empresa
            const [companyResult]: any = await connection.query(AUTH_QUERIES.INSERT_COMPANY, [
                companyUuid,
                dto.company.name.trim(),
                nit,
                dto.admin.email.trim().toLowerCase(),
                messageUuid,
                appId,
            ]);
            const companyId = companyResult.insertId as number;

            // 4. Crear suscripción TRIAL (30 días)
            await connection.query(AUTH_QUERIES.INSERT_SUBSCRIPTION, [subUuid, companyId]);

            // 5. Crear configuración por defecto de la empresa
            await connection.query(AUTH_QUERIES.INSERT_COMPANY_SETTINGS, [companyId]);

            // 6. Crear usuario administrador
            const [userResult]: any = await connection.query(AUTH_QUERIES.INSERT_USER, [
                userUuid,
                companyId,
                dto.admin.firstName.trim(),
                dto.admin.lastName.trim(),
                dto.admin.email.trim().toLowerCase(),
                dto.admin.phone?.trim() || null,
                passwordHash,
            ]);
            const userId = userResult.insertId as number;

            await connection.commit();

            return { companyId, companyUuid, appId, userId, userUuid };
        } catch (error: any) {
            await connection.rollback().catch(() => {});
            if (error.code === 'EMAIL_EXISTS' || error.code === 'NIT_EXISTS') throw error;
            console.error('AuthRepository.registerCompany error:', error);
            throw new QueryFailException('Error al registrar la empresa');
        } finally {
            connection.release();
        }
    }
}
