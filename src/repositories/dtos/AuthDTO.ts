export interface LoginRequestDTO {
    email: string;
    password: string;
}

export interface RefreshRequestDTO {
    token: string;
}

export interface LogoutRequestDTO {
    userId: number;
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
    company_active: number | null;  // is_active de companies
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
    // user object eliminado por seguridad - toda la info está en el JWT
}

export interface RefreshResponseDTO {
    token: string;
    expiresIn: string;
}

// ── Work Orders External API ──────────────────────────────────────────────────

export interface GetWorkOrdersRequestDTO {
    pageNumber: number;
    pageSize: number;
    companyId: number;  // Extraído del JWT
}

export interface WorkOrderClientDTO {
    id: number;
    uuid: string;
    name: string;
    nit: string | null;
    address: string | null;
}

export interface WorkOrderTechnicianDTO {
    id: number;
    uuid: string;
    fullName: string;
}

export interface WorkOrderContractDTO {
    id: number;
    name: string;
}

export interface WorkOrderContractItemDTO {
    id: number;
    name: string;
}

export interface WorkOrderChecklistTemplateDTO {
    id: number;
    name: string;
}

export interface WorkOrderTypeDTO {
    id: number;
    uuid: string;
    name: string;
}

export interface WorkOrderStatusDTO {
    id: number;
    uuid: string;
    name: string;
    color: string;
    isFinal: boolean;
}

export interface WorkOrderDTO {
    id: number;
    uuid: string;
    companyId: number;
    companyName: string;
    client: WorkOrderClientDTO;
    technician: WorkOrderTechnicianDTO | null;
    assignmentType: string;
    origin: string;
    contract: WorkOrderContractDTO | null;
    siteId: number | null;
    siteName: string | null;
    contractItem: WorkOrderContractItemDTO | null;
    checklistTemplate: WorkOrderChecklistTemplateDTO | null;
    finalCost: number | null;
    parentWorkOrderId: number | null;
    workOrderType: WorkOrderTypeDTO;
    workOrderStatus: WorkOrderStatusDTO;
    scheduledDate: string | null;
    scheduledEnd: string | null;
    executionStart: string | null;
    executionEnd: string | null;
    clientSignatureUrl: string | null;
    invoiceUrl: string | null;
    reportUrl: string | null;
    observations: string | null;
    description: string | null;
    canReopen: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface PaginationDTO {
    totalElement: number;
    pageSize: number;
    pageNumber: number;
    hasMoreElements: boolean;
}

export interface GetWorkOrdersResponseDTO {
    workOrders: WorkOrderDTO[];
    pagination: PaginationDTO;
}

// ── Work Order Detail (by ID) ─────────────────────────────────────────────────

export interface GetWorkOrderByIdRequestDTO {
    workOrderId: number;
    companyId: number;  // Extraído del JWT para multi-tenancy
}

export interface WorkOrderDetailDTO {
    id: number;
    uuid: string;
    companyId: number;
    companyName: string;
    client: WorkOrderClientDTO;
    technician: WorkOrderTechnicianDTO | null;
    assignmentType: string;
    origin: string;
    contract: WorkOrderContractDTO | null;
    siteId: number | null;
    siteName: string | null;
    contractItem: WorkOrderContractItemDTO | null;
    checklistTemplate: WorkOrderChecklistTemplateDTO | null;
    finalCost: number | null;
    parentWorkOrderId: number | null;
    workOrderType: WorkOrderTypeDTO;
    workOrderStatus: WorkOrderStatusDTO;
    scheduledDate: string | null;
    scheduledEnd: string | null;
    executionStart: string | null;
    executionEnd: string | null;
    // clientSignatureUrl NO incluido — solo en endpoint de listado
    invoiceUrl: string | null;
    reportUrl: string | null;
    observations: string | null;
    description: string | null;
    canReopen: boolean;
    createdAt: string;
    updatedAt: string;
}

// DTO para registrar logs de uso de API
export interface ApiUsageLogDTO {
    companyId: number;
    userId: number | null;
    endpoint: string;
    httpMethod: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    statusCode: number;
    responseTimeMs: number | null;
    ipAddress: string | null;
    userAgent: string | null;
    errorMessage: string | null;
}
