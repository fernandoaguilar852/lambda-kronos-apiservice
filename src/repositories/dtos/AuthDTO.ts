export interface LoginRequestDTO {
    email: string;
    password: string;
    fcmToken?: string;
}

export interface RefreshRequestDTO {
    token: string;
    userId: number;
}

export interface LogoutRequestDTO {
    userId: number;
}

export interface RegisterFcmRequestDTO {
    userId: number;
    token: string;
}

export interface UserRowDTO {
    id: number;
    uuid: string;
    company_id: number | null;
    client_id: number | null;
    first_name: string;
    last_name: string;
    password: string;
    email: string;
    phone: string | null;
    role: string;
    is_active: number;
    avatar_url: string | null;
    current_session_token: string | null;
    preferences: string | null;
}

export interface AuthUserResponseDTO {
    id: number;
    uuid: string;
    companyId: number | null;
    clientId: number | null;
    role: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    avatarUrl: string | null;
    preferences: any | null;
}

export interface LoginResponseDTO {
    token: string;
    expiresIn: string;
    user: AuthUserResponseDTO;
}

export interface RefreshResponseDTO {
    token: string;
    expiresIn: string;
}

// ── Registro inicial de empresa ───────────────────────────────────────────────

export interface RegisterCompanyInputDTO {
    name: string;
    taxId?: string;   // NIT / RUC — opcional
}

export interface RegisterAdminInputDTO {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    password: string;
}

export interface RegisterRequestDTO {
    company: RegisterCompanyInputDTO;
    admin: RegisterAdminInputDTO;
}

export interface RegisterResponseDTO {
    token: string;
    expiresIn: string;
    user: AuthUserResponseDTO;
    company: {
        id: number;
        uuid: string;
        name: string;
        appId: string;   // UUID que el cliente puede usar en futuras integraciones
    };
}
