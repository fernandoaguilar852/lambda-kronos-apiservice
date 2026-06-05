import { mysqlClient } from '../core/utils/DatabaseManager';
import { AUTH_QUERIES } from '../core/utils/Constans';
import { QueryFailException } from '../core/common/QueryFailException';
import { IAuthRepository } from './IAuthRepository';
import { UserRowDTO } from './dtos/AuthDTO';

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
}
