# Arquitectura Lambda Kronos - Auth Service

## Tabla de Contenidos
1. [Visión General](#visión-general)
2. [Arquitectura en Capas](#arquitectura-en-capas)
3. [Interfaces de cada Capa](#interfaces-de-cada-capa)
4. [Constantes y Queries SQL](#constantes-y-queries-sql)
5. [Flujo de Datos](#flujo-de-datos)
6. [Estructura de Directorios](#estructura-de-directorios)
7. [Configuración y Despliegue](#configuración-y-despliegue)
8. [Seguridad y Validaciones](#seguridad-y-validaciones)
9. [Reglas de Negocio](#reglas-de-negocio)

---

## Visión General

**Lambda Kronos Auth Service** es un servicio de autenticación serverless implementado con AWS Lambda + API Gateway + MySQL (RDS).

### Características Principales
- Arquitectura en capas limpia (5 niveles)
- Inyección de dependencias manual
- Type-safe con TypeScript
- Multi-tenant con JWT
- CORS habilitado
- Pool de conexiones MySQL optimizado
- Transacciones ACID
- Best-effort non-blocking operations

### Stack Tecnológico
- **Runtime:** Node.js 20.x (arm64)
- **Lenguaje:** TypeScript 5.x
- **Base de Datos:** MySQL 8.0 (RDS AWS)
- **Infraestructura:** AWS SAM (Serverless Application Model)
- **Autenticación:** JWT (jsonwebtoken) + bcrypt

---

## Arquitectura en Capas

El proyecto implementa una **arquitectura limpia de 5 capas** con separación estricta de responsabilidades:

```
┌─────────────────────────────────────────────────────────────┐
│                    API GATEWAY (AWS)                        │
│              POST/GET /v1/fsm/auth/* (any)                  │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────▼─────────────────┐
        │  CAPA 1: HANDLER (app.ts)        │
        │  • Routing HTTP                  │
        │  • CORS handling                 │
        │  • JWT extraction                │
        │  • Dependency Injection          │
        └────────────────┬─────────────────┘
                         │
        ┌────────────────▼──────────────────────┐
        │ CAPA 2: CONTROLLER (Presentación)     │
        │ AuthController → IAuthController      │
        │  • Request/Response HTTP              │
        │  • Exception handling                 │
        │  • Response formatting (Swagger)      │
        └────────────────┬──────────────────────┘
                         │
        ┌────────────────▼──────────────────────┐
        │ CAPA 3: BUSINESS LOGIC (Dominio)     │
        │ AuthBL → IAuthBL                      │
        │  • Validaciones de negocio            │
        │  • Criptografía (bcrypt, JWT)         │
        │  • Orquestación de procesos           │
        │  • Reglas de negocio (RN-CLI-01)      │
        └────────────────┬──────────────────────┘
                         │
        ┌────────────────▼──────────────────────┐
        │ CAPA 4: REPOSITORY (Persistencia)    │
        │ AuthRepository → IAuthRepository      │
        │  • Acceso a datos MySQL               │
        │  • Queries SQL                        │
        │  • Transacciones                      │
        │  • Connection pooling                 │
        └────────────────┬──────────────────────┘
                         │
        ┌────────────────▼──────────────────────┐
        │ CAPA 5: CORE (Infraestructura)       │
        │  • DatabaseManager (pool MySQL)       │
        │  • JwtMiddleware (verificación)       │
        │  • SwaggerResponseBuilder             │
        │  • Constans.ts (queries + constantes) │
        │  • QueryFailException                 │
        └────────────────┬──────────────────────┘
                         │
        ┌────────────────▼──────────────────────┐
        │   MySQL 8.0 (RDS AWS us-east-1)      │
        │   • companies                         │
        │   • users                             │
        │   • subscriptions                     │
        │   • client_contracts                  │
        │   • contracts                         │
        │   • user_fcm_tokens                   │
        │   • company_settings                  │
        └───────────────────────────────────────┘
```

### Descripción de Capas

#### CAPA 1: Handler (app.ts)
**Responsabilidad:** Punto de entrada único de la Lambda AWS.

**Ubicación:** `src/app.ts`

**Funciones:**
- Recibe eventos de API Gateway (`APIGatewayProxyEvent`)
- Enruta peticiones HTTP a métodos del controlador
- Maneja CORS preflight (OPTIONS)
- Extrae y verifica JWT para rutas protegidas
- Inicializa el stack de dependencias
- Retorna respuestas HTTP (`APIGatewayProxyResult`)

**Rutas Públicas (sin JWT):**
```typescript
POST /v1/fsm/auth/register   // Registro de empresa
POST /v1/fsm/auth/login      // Login
POST /v1/fsm/auth/refresh    // Renovar token
```

**Rutas Protegidas (requieren JWT):**
```typescript
POST /v1/fsm/auth/logout        // Logout
POST /v1/fsm/auth/register-fcm  // Registrar token push
```

#### CAPA 2: Controller (controller/)
**Responsabilidad:** Capa de presentación HTTP.

**Ubicación:** `src/controller/`

**Componentes:**
- `IAuthController` — Interfaz
- `AuthController` — Implementación

**Funciones:**
- Mapear requests HTTP a métodos de negocio
- Validar estructura de DTOs
- Capturar y procesar excepciones
- Construir respuestas HTTP con formato Swagger
- Inyectar dependencias de capa BL

**Métodos:**
```typescript
login(body: LoginRequestDTO, messageUuid, requestAppId)
logout(body: LogoutRequestDTO, messageUuid, requestAppId)
refresh(body: RefreshRequestDTO, messageUuid, requestAppId)
registerFcm(body: RegisterFcmRequestDTO, messageUuid, requestAppId)
registerCompany(body: RegisterRequestDTO, messageUuid, requestAppId)
```

#### CAPA 3: Business Logic (domain/)
**Responsabilidad:** Lógica de negocio y orquestación.

**Ubicación:** `src/domain/`

**Componentes:**
- `IAuthBL` — Interfaz
- `AuthBL` — Implementación

**Funciones:**
- Validaciones de datos de entrada
- Operaciones criptográficas (bcrypt, JWT)
- Aplicación de reglas de negocio (RN-CLI-01)
- Orquestación de llamadas a repository
- Operaciones best-effort (no-blocking)

**Métodos:**
```typescript
login()           // Valida credenciales + verifica contrato activo
logout()          // Invalida sesión
refresh()         // Verifica y renueva JWT
registerFcm()     // Registra token push
registerCompany() // Transacción completa: empresa + admin + suscripción
```

**Operaciones Best-Effort:**
Las siguientes operaciones no bloquean la respuesta al cliente:
```typescript
// En login(): persiste token de sesión sin esperar
this.repo.updateSessionToken(user.id, token).catch(err =>
    console.warn('updateSessionToken failed (non-critical):', err?.message)
);

// En login(): registra FCM token si viene en request
if (dto.fcmToken) {
    this.repo.upsertFcmToken(user.id, dto.fcmToken).catch(...)
}
```

#### CAPA 4: Repository (repositories/)
**Responsabilidad:** Acceso a datos.

**Ubicación:** `src/repositories/`

**Componentes:**
- `IAuthRepository` — Interfaz
- `AuthRepository` — Implementación
- `dtos/AuthDTO.ts` — Data Transfer Objects

**Funciones:**
- Abstracción de acceso a MySQL
- Ejecución de queries SQL
- Manejo de transacciones ACID
- Gestión de pool de conexiones
- Manejo de errores de base de datos

**Métodos:**
```typescript
getUserByEmail(email: string): Promise<UserRowDTO | null>
updateSessionToken(userId: number, token: string): Promise<void>
clearSessionToken(userId: number): Promise<void>
upsertFcmToken(userId: number, token: string): Promise<void>
clientHasActiveContract(clientId: number): Promise<boolean>
registerCompany(dto, passwordHash): Promise<{...}>
```

#### CAPA 5: Core/Infraestructura (core/)
**Responsabilidad:** Utilidades y servicios de infraestructura.

**Ubicación:** `src/core/`

**Componentes:**

1. **DatabaseManager.ts**
   - Pool de conexiones MySQL (max 10 conexiones)
   - Singleton pattern
   - Configuración multi-ambiente (LOCAL, DEV, QA, PROD)

2. **JwtMiddleware.ts**
   - Verificación de JWT en headers
   - Extracción de payload
   - Manejo de errores de autenticación

3. **SwaggerResponseBuilder.ts**
   - Constructor de respuestas HTTP estandarizadas
   - Formato Swagger/OpenAPI
   - Manejo de paginación
   - Mapeo de códigos HTTP

4. **Constans.ts** (ver sección detallada más abajo)
   - Enums de HTTP status codes
   - Constantes CORS
   - **Queries SQL predefinidas**

5. **QueryFailException.ts**
   - Excepciones personalizadas para errores de BD

---

## Interfaces de cada Capa

### IAuthController (src/controller/IAuthController.ts)

```typescript
export interface IAuthController {
    /**
     * Autentica usuario con email + password.
     * @returns Token JWT + datos del usuario
     */
    login(
        body: LoginRequestDTO,
        messageUuid: string,
        requestAppId: string
    ): Promise<APIGatewayProxyResult>;

    /**
     * Cierra la sesión del usuario.
     */
    logout(
        body: LogoutRequestDTO,
        messageUuid: string,
        requestAppId: string
    ): Promise<APIGatewayProxyResult>;

    /**
     * Renueva un token JWT expirado.
     * @returns Nuevo token JWT
     */
    refresh(
        body: RefreshRequestDTO,
        messageUuid: string,
        requestAppId: string
    ): Promise<APIGatewayProxyResult>;

    /**
     * Registra token FCM para notificaciones push.
     */
    registerFcm(
        body: RegisterFcmRequestDTO,
        messageUuid: string,
        requestAppId: string
    ): Promise<APIGatewayProxyResult>;

    /**
     * Registra nueva empresa con usuario administrador.
     * @returns Token JWT + datos de empresa y usuario
     */
    registerCompany(
        body: RegisterRequestDTO,
        messageUuid: string,
        requestAppId: string
    ): Promise<APIGatewayProxyResult>;
}
```

### IAuthBL (src/domain/IAuthBL.ts)

```typescript
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
     * Registra una nueva empresa con su usuario administrador inicial.
     * Crea en una sola transacción:
     * - company
     * - subscription (TRIAL 30 días)
     * - company_settings (defaults)
     * - user (COMPANY_ADMIN)
     * Retorna JWT listo para auto-login.
     */
    registerCompany(dto: RegisterRequestDTO): Promise<RegisterResponseDTO>;
}
```

### IAuthRepository (src/repositories/IAuthRepository.ts)

```typescript
export interface IAuthRepository {
    /**
     * Obtiene un usuario activo por email.
     * @returns UserRowDTO o null si no existe o está inactivo
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

    /**
     * RN-CLI-01: Verifica que el cliente tenga al menos 1 contrato no INACTIVE.
     * Solo relevante para usuarios con rol CLIENT_USER.
     */
    clientHasActiveContract(clientId: number): Promise<boolean>;

    /**
     * Registra una nueva empresa con su usuario administrador.
     * Ejecuta la transacción completa:
     * - company
     * - subscription (TRIAL)
     * - company_settings
     * - user (COMPANY_ADMIN)
     * @returns IDs y UUIDs generados para construir JWT
     */
    registerCompany(dto: RegisterRequestDTO, passwordHash: string): Promise<{
        companyId:   number;
        companyUuid: string;
        appId:       string;
        userId:      number;
        userUuid:    string;
    }>;
}
```

### JwtPayload (src/core/utils/JwtMiddleware.ts)

```typescript
export interface JwtPayload {
    sub: number;          // userId
    uuid: string;         // user UUID
    role: string;         // ADMIN | TECHNICIAN | CLIENT_USER | SUPER_ADMIN
    companyId: number;    // tenant ID
    clientId?: number;    // solo para CLIENT_USER
}
```

### DTOs (src/repositories/dtos/AuthDTO.ts)

**DTOs de Entrada:**
```typescript
interface LoginRequestDTO {
    email: string;
    password: string;
    fcmToken?: string;  // Opcional, registrado best-effort
}

interface RegisterRequestDTO {
    company: {
        name: string;
        nit?: string;  // Opcional, debe ser único si se proporciona
        contactEmail: string;
    };
    admin: {
        firstName: string;
        lastName: string;
        email: string;     // Debe ser único
        phone: string;
        password: string;  // Mínimo 8 caracteres
    };
}

interface RefreshRequestDTO {
    token: string;  // JWT a renovar
}

interface LogoutRequestDTO {
    userId: number;  // Inyectado del JWT
}

interface RegisterFcmRequestDTO {
    userId: number;   // Inyectado del JWT
    fcmToken: string; // Token de Firebase Cloud Messaging
}
```

**DTOs de Salida:**
```typescript
interface LoginResponseDTO {
    token: string;
    expiresIn: string;  // "30d"
    user: AuthUserResponseDTO;
}

interface RegisterResponseDTO {
    token: string;
    expiresIn: string;
    user: AuthUserResponseDTO;
    company: {
        id: number;
        uuid: string;
        name: string;
        appId: string;
    };
}

interface RefreshResponseDTO {
    token: string;
    expiresIn: string;
}

interface AuthUserResponseDTO {
    id: number;
    uuid: string;
    companyId: number;
    clientId?: number;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    role: string;
    isActive: boolean;
    avatarUrl?: string;
    preferences?: any;
}
```

**DTOs de Base de Datos:**
```typescript
interface UserRowDTO {
    id: number;
    uuid: string;
    company_id: number;
    client_id?: number;
    first_name: string;
    last_name: string;
    password: string;              // Hash bcrypt
    email: string;
    phone: string;
    role: string;
    is_active: boolean;
    avatar_url?: string;
    current_session_token?: string;
    preferences?: string;          // JSON string
}
```

---

## Constantes y Queries SQL

### Archivo: src/core/utils/Constans.ts

Este archivo centraliza todas las constantes y queries SQL del proyecto.

#### 1. HTTP Status Codes

```typescript
export enum HttpStatus {
    OK = 200,
    CREATED = 201,
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    CONFLICT = 409,
    UNPROCESSABLE_ENTITY = 422,
    INTERNAL_SERVER_ERROR = 500,
    // ... más códigos
}
```

#### 2. Valores por Defecto

```typescript
export const enum DefaultValues {
    EMPTY_STRING = '',
    ZERO_PORT = 0,
    NODE_ENV_LOCAL = 'LOCAL',
    NODE_ENV_DEV = 'DEV',
    NODE_ENV_PROD = 'PROD',
    NODE_ENV_QA = 'QA',
}
```

#### 3. CORS Headers

```typescript
export enum ALLOWED_HEADERS_VALUES {
    CONTENT_TYPE = 'application/json',
    ALLOWED_HEADERS = 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
    ALLOW_ORIGIN = '*',
    ALLOWED_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
}
```

#### 4. Query Compartida (Multi-Lambda)

Esta query es usada por **todas las lambdas de Kronos** para resolver el tenant (companyId) a partir del app_id:

```typescript
export const GET_COMPANY_BY_APP_ID = `
    SELECT id FROM companies WHERE app_id = ? AND is_active = 1 LIMIT 1
`;
```

#### 5. AUTH_QUERIES — Queries SQL de Autenticación

```typescript
export const AUTH_QUERIES = {
    // ── Queries de autenticación básica ──────────────────────────────────

    GET_USER_BY_EMAIL: `
        SELECT
            id, uuid, company_id, client_id, first_name, last_name,
            password, email, phone, role, is_active, avatar_url,
            current_session_token, preferences
        FROM users
        WHERE email = ? AND is_active = 1
        LIMIT 1
    `,

    UPDATE_SESSION_TOKEN: `
        UPDATE users
        SET current_session_token = ?, updated_at = NOW()
        WHERE id = ?
    `,

    CLEAR_SESSION_TOKEN: `
        UPDATE users
        SET current_session_token = NULL, updated_at = NOW()
        WHERE id = ?
    `,

    UPSERT_FCM_TOKEN: `
        INSERT INTO user_fcm_tokens (user_id, token)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE token = VALUES(token)
    `,

    // ── RN-CLI-01: Verificación de contrato activo ──────────────────────

    /**
     * Verifica que un cliente tenga al menos 1 contrato no INACTIVE.
     * Retrocompatible: contratos en estado DRAFT también cuentan.
     * Solo aplica para usuarios con rol CLIENT_USER.
     */
    CHECK_CLIENT_ACTIVE_CONTRACT: `
        SELECT cc.id
        FROM client_contracts cc
        JOIN contracts co ON co.id = cc.contract_id
        WHERE cc.client_id = ? AND co.status != 'INACTIVE'
        LIMIT 1
    `,

    // ── Queries de registro de empresa ───────────────────────────────────

    CHECK_EMAIL_EXISTS: `
        SELECT id FROM users WHERE email = ? LIMIT 1
    `,

    CHECK_NIT_EXISTS: `
        SELECT id FROM companies WHERE nit = ? LIMIT 1
    `,

    INSERT_COMPANY: `
        INSERT INTO companies (uuid, name, nit, contact_email, message_uuid, app_id)
        VALUES (?, ?, ?, ?, ?, ?)
    `,

    /**
     * Crea suscripción TRIAL de 30 días.
     * plan_id = NULL porque es trial (sin plan pagado asociado).
     */
    INSERT_SUBSCRIPTION: `
        INSERT INTO subscriptions
            (uuid, company_id, plan_id, status, current_period_start, current_period_end)
        VALUES
            (?, ?, NULL, 'TRIAL', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY))
    `,

    INSERT_COMPANY_SETTINGS: `
        INSERT INTO company_settings (company_id) VALUES (?)
    `,

    /**
     * Crea usuario con rol COMPANY_ADMIN.
     * El password ya viene hasheado con bcrypt (10 rounds).
     */
    INSERT_USER: `
        INSERT INTO users
            (uuid, company_id, role, first_name, last_name, email, phone, password, is_active)
        VALUES
            (?, ?, 'COMPANY_ADMIN', ?, ?, ?, ?, ?, 1)
    `,
};
```

#### Notas sobre Queries

1. **Prepared Statements:** Todas las queries usan placeholders `?` para prevenir SQL injection.

2. **Índices Recomendados:**
   ```sql
   -- users
   INDEX idx_users_email (email)
   INDEX idx_users_active (is_active, email)

   -- companies
   INDEX idx_companies_app_id (app_id, is_active)
   INDEX idx_companies_nit (nit)

   -- client_contracts
   INDEX idx_cc_client_id (client_id)

   -- contracts
   INDEX idx_contracts_status (status)
   ```

3. **Catálogos Globales:**
   - `work_order_types` — No tiene `company_id` (catálogo global)
   - `work_order_statuses` — No tiene `company_id` (catálogo global)
   - Se seedean una sola vez en el setup inicial de la BD

4. **Transacciones:**
   - `registerCompany()` usa transacción explícita con rollback automático en caso de error
   - Todas las queries son ejecutadas dentro de la misma conexión transaccional

---

## Flujo de Datos

### Ejemplo: POST /v1/fsm/auth/login

```
1. API Gateway Event
   ↓
   POST /v1/fsm/auth/login
   Body: { email: "admin@example.com", password: "...", fcmToken: "..." }

2. app.lambdaHandler (HANDLER)
   ↓
   - Verifica método HTTP (POST)
   - Parsea body JSON
   - Inicializa stack DI:
     const controller = new AuthController(
         new AuthBL(new AuthRepository())
     );
   - Llama: controller.login(body, requestId, 'auth-service')

3. AuthController.login() (CONTROLLER)
   ↓
   - Llama: this.authBL.login(body)
   - Captura ValidationError si ocurre
   - Construye respuesta HTTP con SwaggerResponseBuilder
   - Retorna APIGatewayProxyResult

4. AuthBL.login() (BUSINESS LOGIC)
   ↓
   - Valida email y password no vacíos
   - Llama: this.repo.getUserByEmail(email)
   - Verifica que usuario exista y esté activo
   - Compara password con bcrypt.compare()
   - [RN-CLI-01] Si es CLIENT_USER:
     → Llama: this.repo.clientHasActiveContract(clientId)
     → Si no tiene contrato activo, lanza UnprocessableError
   - Genera JWT con signToken(payload, '30d')
   - Llama (best-effort): this.repo.updateSessionToken(userId, token)
   - Si fcmToken presente, llama (best-effort): this.repo.upsertFcmToken(userId, fcmToken)
   - Retorna: { token, expiresIn: '30d', user: {...} }

5. AuthRepository.getUserByEmail() (REPOSITORY)
   ↓
   - Obtiene conexión del pool MySQL
   - Ejecuta query: AUTH_QUERIES.GET_USER_BY_EMAIL
   - Mapea fila SQL → UserRowDTO
   - Retorna UserRowDTO o null

6. MySQL Database (RDS AWS)
   ↓
   SELECT id, uuid, company_id, client_id, first_name, last_name,
          password, email, phone, role, is_active, avatar_url,
          current_session_token, preferences
   FROM users
   WHERE email = 'admin@example.com' AND is_active = 1
   LIMIT 1

7. Respuesta HTTP (formato Swagger)
   ↓
   {
     "headers": {
       "httpStatusCode": 200,
       "httpStatusDesc": "OK",
       "messageUuid": "abc-123",
       "requestAppId": "auth-service"
     },
     "messageResponse": {
       "responseCode": "200",
       "responseMessage": "Operation Successfully",
       "responseDetails": null
     },
     "data": {
       "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
       "expiresIn": "30d",
       "user": {
         "id": 1,
         "uuid": "550e8400-e29b-41d4-a716-446655440000",
         "companyId": 1,
         "firstName": "Admin",
         "lastName": "User",
         "email": "admin@example.com",
         "phone": "+1234567890",
         "role": "COMPANY_ADMIN",
         "isActive": true
       }
     }
   }
```

### Ejemplo: Transacción registerCompany()

```
1. POST /v1/fsm/auth/register
   Body: {
     company: { name: "ACME Corp", nit: "123456789", contactEmail: "..." },
     admin: { firstName: "John", lastName: "Doe", email: "...", phone: "...", password: "..." }
   }

2. AuthBL.registerCompany()
   ↓
   - Valida nombre empresa no vacío
   - Valida email único
   - Valida password mínimo 8 caracteres
   - Genera hash bcrypt (10 rounds)
   - Llama: this.repo.registerCompany(dto, passwordHash)

3. AuthRepository.registerCompany() — INICIA TRANSACCIÓN
   ↓
   BEGIN TRANSACTION

   3.1. Verificar email único
        → SELECT id FROM users WHERE email = ?
        → Si existe, ROLLBACK + lanza ConflictError

   3.2. Verificar NIT único (si se proporcionó)
        → SELECT id FROM companies WHERE nit = ?
        → Si existe, ROLLBACK + lanza ConflictError

   3.3. Insertar empresa
        → INSERT INTO companies (uuid, name, nit, ...)
        → Obtiene companyId = LAST_INSERT_ID()
        → Genera app_id = `KRONOS-${companyId}`
        → UPDATE companies SET app_id = ? WHERE id = companyId

   3.4. Insertar suscripción TRIAL (30 días)
        → INSERT INTO subscriptions (uuid, company_id, plan_id, status, ...)

   3.5. Insertar configuración por defecto
        → INSERT INTO company_settings (company_id)

   3.6. Insertar usuario COMPANY_ADMIN
        → INSERT INTO users (uuid, company_id, role, first_name, ...)
        → Obtiene userId = LAST_INSERT_ID()

   COMMIT TRANSACTION

   Retorna: { companyId, companyUuid, appId, userId, userUuid }

4. AuthBL.registerCompany() (continúa)
   ↓
   - Genera JWT con payload: { sub: userId, uuid: userUuid, role: 'COMPANY_ADMIN', companyId }
   - Retorna: { token, expiresIn: '30d', user: {...}, company: {...} }

5. Respuesta HTTP 201 Created
```

---

## Estructura de Directorios

```
lambda-kronos-apiservice/
├── template.yaml                    # Configuración SAM AWS
├── samconfig.toml                   # Configuración local SAM
├── package.json                     # Dependencias raíz
├── .gitignore
├── ARCHITECTURE.md                  # Este documento
│
└── src/
    ├── app.ts                       # PUNTO DE ENTRADA - Lambda Handler
    ├── Makefile                     # Build configuration
    ├── package.json                 # Dependencias de runtime
    ├── tsconfig.json                # Configuración TypeScript
    │
    ├── controller/                  # CAPA 2: Presentación
    │   ├── IAuthController.ts       # Interfaz del controlador
    │   └── AuthController.ts        # Implementación
    │
    ├── domain/                      # CAPA 3: Lógica de Negocio
    │   ├── IAuthBL.ts               # Interfaz de Business Logic
    │   └── AuthBL.ts                # Implementación
    │
    ├── repositories/                # CAPA 4: Acceso a Datos
    │   ├── IAuthRepository.ts       # Interfaz del repositorio
    │   ├── AuthRepository.ts        # Implementación
    │   └── dtos/
    │       └── AuthDTO.ts           # Data Transfer Objects
    │
    └── core/                        # CAPA 5: Infraestructura
        ├── config/
        │   └── index.ts             # Configuración multi-ambiente
        ├── utils/
        │   ├── Constans.ts          # ⭐ CONSTANTES Y QUERIES SQL
        │   ├── DatabaseManager.ts   # Pool de conexiones MySQL
        │   └── JwtMiddleware.ts     # Verificación de JWT
        └── common/
            ├── SwaggerResponseBuilder.ts  # Constructor de respuestas
            ├── swaggerTypes.ts            # Interfaces de respuesta
            └── QueryFailException.ts      # Custom Exceptions
```

---

## Configuración y Despliegue

### Variables de Entorno (template.yaml)

```yaml
Environment:
  Variables:
    MYSQL_HOST: !Ref MySQLHost           # Endpoint RDS
    MYSQL_USER: !Ref MySQLUser           # Usuario BD
    MYSQL_PASSWORD: !Ref MySQLPassword   # Contraseña BD
    MYSQL_DATABASE: !Ref MySQLDatabase   # Nombre de BD
    NODE_ENVIRONMENT: DEV | PROD | QA | LOCAL
    JWT_SECRET: !Ref JwtSecret           # Clave para firmar JWT
    JWT_EXPIRES_IN: 30d                  # Expiración JWT
```

### Configuración de Ambientes (src/core/config/index.ts)

```typescript
const environments = {
    LOCAL: {
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: 'password',
        database: 'kronos_dev'
    },
    DEV: {
        host: process.env.MYSQL_HOST,
        port: 3306,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE
    },
    QA: { /* similar a LOCAL */ },
    PROD: {
        host: process.env.MYSQL_HOST,
        port: 3306,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE
    }
};
```

### Configuración Lambda (template.yaml)

```yaml
KronosAuthFunction:
  Type: AWS::Serverless::Function
  Properties:
    Handler: app.lambdaHandler
    Runtime: nodejs20.x
    Architectures:
      - arm64
    MemorySize: 256
    Timeout: 30
    Events:
      AuthApi:
        Type: Api
        Properties:
          Path: /v1/fsm/auth/{proxy+}
          Method: ANY
```

### Build Process (Makefile)

```bash
build-KronosAuthFunction:
    cp -r . $(ARTIFACTS_DIR)/
    npm install --omit=dev
    npm install typescript
    npx tsc                          # Transpila .ts → .js
    find $(ARTIFACTS_DIR) -name '*.ts' -not -path '*/node_modules/*' -delete
```

### Despliegue

```bash
# Build
sam build

# Deploy (primera vez)
sam deploy --guided

# Deploy (actualizaciones)
sam deploy
```

---

## Seguridad y Validaciones

### 1. Autenticación JWT

**Algoritmo:** HS256 (HMAC with SHA-256)

**Payload:**
```typescript
{
    sub: number,          // userId
    uuid: string,         // user UUID
    role: string,         // ADMIN | TECHNICIAN | CLIENT_USER | SUPER_ADMIN
    companyId: number,    // tenant ID
    clientId?: number,    // solo CLIENT_USER
    iat: number,          // Issued At (timestamp)
    exp: number           // Expiration (timestamp)
}
```

**Expiración:** 30 días (configurable vía `JWT_EXPIRES_IN`)

**Verificación:**
```typescript
// En app.ts (rutas protegidas)
const jwtPayload = verifyJwt(event.headers?.['Authorization']);
```

**Headers esperados:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. Contraseñas

**Hashing:** bcryptjs con 10 rounds de salt

```typescript
// En AuthBL.registerCompany()
const hash = await bcrypt.hash(dto.admin.password, 10);

// En AuthBL.login()
const isValid = await bcrypt.compare(dto.password, user.password);
```

**Validaciones:**
- Mínimo 8 caracteres
- Nunca se retornan en respuestas HTTP
- Nunca se loggean

### 3. Validaciones de Entrada

**Email:**
```typescript
// Regex básico de validación
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
    throw new ValidationError('Email inválido');
}
```

**Unicidad:**
```typescript
// En registerCompany()
const existingEmail = await this.repo.checkEmailExists(email);
if (existingEmail) {
    throw new ConflictError('El email ya está registrado');
}

const existingNit = await this.repo.checkNitExists(nit);
if (existingNit) {
    throw new ConflictError('El NIT ya está registrado');
}
```

### 4. CORS

**Headers aplicados en todas las respuestas:**
```typescript
{
    'Content-Type': 'application/json',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
}
```

**Preflight OPTIONS:**
```typescript
// En app.ts
if (method === 'OPTIONS') {
    return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'CORS preflight successful' })
    };
}
```

### 5. SQL Injection Prevention

Todas las queries usan **prepared statements** con placeholders `?`:

```typescript
// SEGURO ✅
const [rows] = await conn.execute(
    'SELECT * FROM users WHERE email = ?',
    [email]
);

// INSEGURO ❌ (nunca hacer)
const [rows] = await conn.execute(
    `SELECT * FROM users WHERE email = '${email}'`
);
```

### 6. Error Handling

**Errores personalizados:**
```typescript
class ValidationError extends Error {
    statusCode = 400;
}

class ConflictError extends Error {
    statusCode = 409;
}

class UnprocessableError extends Error {
    statusCode = 422;
}

class QueryFailException extends Error {
    statusCode = 500;
}
```

**Manejo en Controller:**
```typescript
try {
    const result = await this.authBL.login(body);
    return SwaggerResponseBuilder.buildSuccessResponse(200, result, messageUuid, requestAppId);
} catch (err: any) {
    if (err instanceof ValidationError) {
        return SwaggerResponseBuilder.buildErrorResponse(400, [...], messageUuid, requestAppId);
    }
    // ... otros casos
}
```

---

## Reglas de Negocio

### RN-CLI-01: CLIENT_USER requiere contrato activo

**Descripción:**
Un usuario con rol `CLIENT_USER` **solo puede iniciar sesión** si su cliente tiene al menos 1 contrato en estado **no INACTIVE**.

**Estados de contrato permitidos:**
- `ACTIVE` — Contrato activo
- `DRAFT` — Borrador (retrocompatibilidad con contratos existentes)
- `PENDING` — Pendiente de activación

**Estado bloqueante:**
- `INACTIVE` — Contrato cancelado/terminado

**Implementación:**
```typescript
// En AuthBL.login()
if (user.role === 'CLIENT_USER' && user.client_id) {
    const hasActiveContract = await this.repo.clientHasActiveContract(user.client_id);
    if (!hasActiveContract) {
        throw new UnprocessableError(
            'No tienes un contrato activo. Contacta al administrador.'
        );
    }
}
```

**Query SQL:**
```sql
-- Definida en Constans.ts → AUTH_QUERIES.CHECK_CLIENT_ACTIVE_CONTRACT
SELECT cc.id
FROM client_contracts cc
JOIN contracts co ON co.id = cc.contract_id
WHERE cc.client_id = ?
  AND co.status != 'INACTIVE'
LIMIT 1
```

**Excepción:**
Si la query falla por error de base de datos, **no se bloquea el login** (security over availability). Se loggea el error y se asume que tiene contrato activo.

```typescript
// En AuthBL.login()
let hasActiveContract = true;  // Default optimista
try {
    hasActiveContract = await this.repo.clientHasActiveContract(user.client_id);
} catch (err) {
    console.error('Error checking active contract (allowing login):', err);
    // No bloquear login por error de BD
}
```

### RN-TRIAL-01: Suscripción TRIAL por defecto

**Descripción:**
Al registrar una nueva empresa, se crea automáticamente una suscripción en estado `TRIAL` con duración de **30 días**.

**Implementación:**
```sql
INSERT INTO subscriptions
    (uuid, company_id, plan_id, status, current_period_start, current_period_end)
VALUES
    (?, ?, NULL, 'TRIAL', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY))
```

**Características:**
- `plan_id = NULL` — No hay plan pagado asociado
- `status = 'TRIAL'` — Periodo de prueba
- `current_period_end` — Se calcula automáticamente (NOW + 30 días)

### RN-ADMIN-01: Usuario inicial es COMPANY_ADMIN

**Descripción:**
Al registrar una nueva empresa, el primer usuario creado **siempre tiene rol** `COMPANY_ADMIN`.

**Implementación:**
```sql
INSERT INTO users
    (uuid, company_id, role, first_name, last_name, email, phone, password, is_active)
VALUES
    (?, ?, 'COMPANY_ADMIN', ?, ?, ?, ?, ?, 1)
```

**Privilegios:**
- Puede invitar otros usuarios
- Puede gestionar configuración de empresa
- Puede gestionar suscripciones

---

## Patrones de Diseño Utilizados

### 1. Dependency Injection (DI)
```typescript
// En app.ts
const controller = new AuthController(
    new AuthBL(
        new AuthRepository()
    )
);
```

### 2. Repository Pattern
Abstracción de acceso a datos vía interfaces.

### 3. Builder Pattern
```typescript
SwaggerResponseBuilder.buildSuccessResponse(...)
SwaggerResponseBuilder.buildErrorResponse(...)
```

### 4. Singleton Pattern
```typescript
// Pool de conexiones MySQL (una sola instancia)
export const mysqlClient = mysql.createPool(config);
```

### 5. Data Transfer Object (DTO)
Separación entre:
- DTOs de entrada (request)
- DTOs de salida (response)
- DTOs de BD (mapeo de filas SQL)

### 6. Factory Pattern
```typescript
signToken(payload, expiresIn)  // Factory de JWT
buildUserResponse(userRow)     // Factory de DTOs
```

---

## Mejores Prácticas

### 1. Best-Effort Non-Blocking
Operaciones no críticas se ejecutan sin bloquear la respuesta:
```typescript
this.repo.updateSessionToken(userId, token)
    .catch(err => console.warn('updateSessionToken failed (non-critical):', err?.message));
```

### 2. Type Safety
```typescript
// Todos los parámetros tienen tipos explícitos
login(body: LoginRequestDTO, messageUuid: string, requestAppId: string): Promise<APIGatewayProxyResult>
```

### 3. Error Handling Consistente
```typescript
// Todos los errores se manejan en el controller
try {
    const result = await this.authBL.login(body);
    return this.buildSuccess(result);
} catch (err) {
    return this.buildError(err);
}
```

### 4. Connection Pooling
```typescript
// Pool de 10 conexiones máximo
const mysqlClient = mysql.createPool({
    host,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
```

### 5. Transacciones ACID
```typescript
// En registerCompany()
const conn = await pool.getConnection();
await conn.beginTransaction();
try {
    // ... operaciones
    await conn.commit();
} catch (err) {
    await conn.rollback();
    throw err;
} finally {
    conn.release();
}
```

---

## Monitoreo y Logging

### Logs de Aplicación
```typescript
console.log('User logged in:', { userId, email, role });
console.warn('updateSessionToken failed (non-critical):', err?.message);
console.error('lambdaHandler error:', e);
```

### Métricas Recomendadas (CloudWatch)
- `LoginAttempts` — Total de intentos de login
- `LoginFailures` — Login fallidos (credenciales incorrectas)
- `LoginBlocked` — Bloqueados por RN-CLI-01
- `RegisterCompanyAttempts` — Intentos de registro
- `RegisterCompanySuccess` — Registros exitosos
- `DatabaseErrors` — Errores de BD
- `JWTVerificationFailures` — JWT inválidos

---

## Testing

### Estructura Recomendada
```
tests/
├── unit/
│   ├── AuthBL.test.ts           # Tests de lógica de negocio
│   ├── AuthRepository.test.ts   # Tests de acceso a datos
│   └── JwtMiddleware.test.ts    # Tests de JWT
├── integration/
│   └── auth.integration.test.ts # Tests end-to-end
└── fixtures/
    └── users.fixture.ts         # Datos de prueba
```

### Casos de Prueba Críticos

**Login:**
- Login exitoso con credenciales válidas
- Login fallido con password incorrecto
- Login bloqueado (CLIENT_USER sin contrato activo)
- Login con usuario inactivo (is_active = 0)

**Register Company:**
- Registro exitoso con datos válidos
- Registro fallido (email duplicado)
- Registro fallido (NIT duplicado)
- Rollback en caso de error (transacción)

**JWT:**
- Generación de token con payload correcto
- Verificación de token válido
- Rechazo de token expirado
- Rechazo de token con firma inválida

**Repository:**
- Queries SQL retornan datos correctos
- Manejo de errores de conexión
- Pool de conexiones funciona correctamente

---

## Troubleshooting

### Error: "Connection pool timeout"
**Causa:** Pool de conexiones agotado (10 conexiones simultáneas).

**Solución:**
```typescript
// Incrementar connectionLimit en DatabaseManager.ts
connectionLimit: 20
```

### Error: "JWT malformed"
**Causa:** Token JWT inválido o corrupto.

**Solución:**
- Verificar que el header `Authorization` tenga formato `Bearer <token>`
- Verificar que `JWT_SECRET` sea el mismo en generación y verificación

### Error: "ER_DUP_ENTRY"
**Causa:** Intento de insertar email o NIT duplicado.

**Solución:**
- Ya manejado en `registerCompany()` con `CHECK_EMAIL_EXISTS` y `CHECK_NIT_EXISTS`
- Retorna `409 Conflict` al cliente

### Error: "Lambda timeout after 30s"
**Causa:** Operación de BD muy lenta.

**Solución:**
- Revisar índices de BD
- Incrementar timeout en `template.yaml`:
  ```yaml
  Timeout: 60
  ```

---

## Roadmap y Mejoras Futuras

### Corto Plazo
- [ ] Implementar rate limiting por IP
- [ ] Agregar logging estructurado (Winston o Pino)
- [ ] Implementar tests unitarios (Jest)
- [ ] Agregar validación de schemas con Joi o Zod

### Mediano Plazo
- [ ] Implementar refresh token rotation
- [ ] Agregar 2FA (Two-Factor Authentication)
- [ ] Implementar password reset flow
- [ ] Agregar email verification en registro
- [ ] Implementar audit log de autenticación

### Largo Plazo
- [ ] Migrar a OAuth2 / OIDC
- [ ] Implementar SSO (Single Sign-On)
- [ ] Agregar soporte para login social (Google, Microsoft)
- [ ] Implementar device fingerprinting
- [ ] Agregar soporte para multi-región (global tables)

---

## Referencias

### Documentación Externa
- [AWS Lambda TypeScript](https://docs.aws.amazon.com/lambda/latest/dg/lambda-typescript.html)
- [AWS SAM](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/what-is-sam.html)
- [mysql2 Documentation](https://github.com/sidorares/node-mysql2)
- [jsonwebtoken Documentation](https://github.com/auth0/node-jsonwebtoken)
- [bcryptjs Documentation](https://github.com/dcodeIO/bcrypt.js)

### Contacto
- **Proyecto:** Kronos FSM (Field Service Management)
- **Repositorio:** lambda-kronos-apiservice
- **Equipo:** Hidrasoft Development Team

---

**Última actualización:** 2026-09-17
**Versión:** 1.0.0
