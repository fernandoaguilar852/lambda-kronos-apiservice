import {
  SwaggerSuccessResponse,
  SwaggerSuccessResponseWithPagination,
  SwaggerErrorResponse,
  SwaggerResponseHeaders,
  SwaggerMessageResponse,
  SwaggerErrorItem
} from './swaggerTypes';

export class SwaggerResponseBuilder {

  static buildSuccessResponse<T>(
    statusCode: number,
    data: T,
    messageUuid: string,
    requestAppId: string,
    responseCode: string = '0000',
    responseMessage: string = 'Success',
    responseDetails: string = 'Operation completed successfully'
  ): SwaggerSuccessResponse<T> {

    const headers: SwaggerResponseHeaders = {
      httpStatusCode: statusCode,
      httpStatusDesc: this.getStatusDescription(statusCode),
      messageUuid,
      requestDatetime: new Date().toISOString(),
      requestAppId
    };

    const messageResponse: SwaggerMessageResponse = {
      responseCode,
      responseMessage,
      responseDetails
    };

    return { headers, messageResponse, data };
  }

  static buildSuccessResponseWithPagination<T>(
    statusCode: number,
    data: T,
    pagination: {
      totalElement: number;
      pageSize: number;
      pageNumber: number;
      hasMoreElements: boolean;
    },
    messageUuid: string,
    requestAppId: string,
    responseCode: string = '0000',
    responseMessage: string = 'Success',
    responseDetails: string = 'Operation completed successfully'
  ): SwaggerSuccessResponseWithPagination<T> {

    const headers: SwaggerResponseHeaders = {
      httpStatusCode: statusCode,
      httpStatusDesc: this.getStatusDescription(statusCode),
      messageUuid,
      requestDatetime: new Date().toISOString(),
      requestAppId
    };

    const messageResponse: SwaggerMessageResponse = {
      responseCode,
      responseMessage,
      responseDetails
    };

    return { headers, messageResponse, data, pagination };
  }

  static buildErrorResponse(
    statusCode: number,
    errors: SwaggerErrorItem[],
    messageUuid: string,
    requestAppId: string,
    responseCode?: string,
    responseMessage?: string,
    responseDetails?: string
  ): SwaggerErrorResponse {

    const headers: SwaggerResponseHeaders = {
      httpStatusCode: statusCode,
      httpStatusDesc: this.getStatusDescription(statusCode),
      messageUuid,
      requestDatetime: new Date().toISOString(),
      requestAppId
    };

    const messageResponse: SwaggerMessageResponse = {
      responseCode: responseCode || `0${statusCode}`,
      responseMessage: responseMessage || this.getDefaultErrorMessage(statusCode),
      responseDetails: responseDetails || this.getDefaultErrorDetails(statusCode)
    };

    return { headers, messageResponse, errors };
  }

  static buildErrorItem(errorCode: string, errorDetail: string): SwaggerErrorItem {
    return { errorCode, errorDetail };
  }

  private static getStatusDescription(statusCode: number): string {
    const map: Record<number, string> = {
      200: 'OK', 201: 'CREATED', 204: 'NO_CONTENT',
      400: 'BAD_REQUEST', 401: 'UNAUTHORIZED', 403: 'FORBIDDEN',
      404: 'NOT_FOUND', 405: 'METHOD_NOT_ALLOWED', 409: 'CONFLICT',
      415: 'UNSUPPORTED_MEDIA_TYPE', 422: 'UNPROCESSABLE_ENTITY',
      500: 'INTERNAL_SERVER_ERROR', 502: 'BAD_GATEWAY', 503: 'SERVICE_UNAVAILABLE'
    };
    return map[statusCode] || 'UNKNOWN';
  }

  private static getDefaultErrorMessage(statusCode: number): string {
    const map: Record<number, string> = {
      400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
      404: 'Not Found', 405: 'Method Not Allowed', 409: 'Conflict',
      415: 'Unsupported Media Type', 422: 'Unprocessable Entity',
      500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable'
    };
    return map[statusCode] || 'Error';
  }

  private static getDefaultErrorDetails(statusCode: number): string {
    const map: Record<number, string> = {
      400: 'Invalid or malformed request data',
      401: 'Authentication required or token invalid',
      403: 'Insufficient permissions for this operation',
      404: 'Resource not found',
      405: 'Operation not allowed for this endpoint',
      409: 'Resource already exists or violates unique constraint',
      415: 'Content-Type must be application/json',
      422: 'Business rule violation',
      500: 'Unexpected error in server execution',
      502: 'Upstream service error',
      503: 'Service temporarily unavailable'
    };
    return map[statusCode] || 'An error occurred';
  }
}
