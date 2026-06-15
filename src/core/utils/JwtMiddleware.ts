import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'kronos-secret-dev';

/**
 * Payload incluido en el JWT emitido por lambda-kronos-auth en el login.
 * Todos los campos son garantizados por AuthBL.login().
 */
export interface JwtPayload {
    sub:       number;   // userId
    uuid:      string;   // user UUID
    role:      string;   // ADMIN | TECHNICIAN | CLIENT_USER | SUPER_ADMIN
    companyId: number;   // tenant ID (companyId)
    clientId?: number;   // solo para CLIENT_USER
    iat?:      number;
    exp?:      number;
}

/**
 * Verifica el token JWT del header Authorization.
 * Lanza un error con código 'TOKEN_MISSING' o 'TOKEN_INVALID' según el caso.
 *
 * @param authHeader  Valor del header `Authorization` (e.g. "Bearer eyJ...")
 * @returns           Payload decodificado y verificado
 */
export function verifyJwt(authHeader: string | undefined | null): JwtPayload {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const err = new Error('TOKEN_MISSING');
        (err as any).code = 'TOKEN_MISSING';
        throw err;
    }
    const token = authHeader.substring(7).trim();
    try {
        return jwt.verify(token, JWT_SECRET) as unknown as JwtPayload;
    } catch {
        const err = new Error('TOKEN_INVALID');
        (err as any).code = 'TOKEN_INVALID';
        throw err;
    }
}
