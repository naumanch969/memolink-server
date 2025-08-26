import { Response } from 'express';
import { ApiResponse, PaginationParams } from '../interfaces';

// Base response structure
const createResponse = <T>(success: boolean, data?: T, message?: string, error?: string, pagination?: PaginationParams): ApiResponse<T> => ({
  success,
  data,
  message,
  error,
  pagination,
});

// Success responses
export const sendSuccess = <T>({ res, data, message = 'Success', pagination }: { 
  res: Response; 
  data: T; 
  message?: string; 
  pagination?: PaginationParams; 
}) => {
  const response = createResponse(true, data, message, undefined, pagination);
  res.status(200).json(response);
};

export const sendCreated = <T>({ res, data, message = 'Created successfully', pagination }: { 
  res: Response; 
  data: T; 
  message?: string; 
  pagination?: PaginationParams; 
}) => {
  const response = createResponse(true, data, message, undefined, pagination);
  res.status(201).json(response);
};

export const sendAccepted = <T>({ res, data, message = 'Accepted', pagination }: { 
  res: Response; 
  data: T; 
  message?: string; 
  pagination?: PaginationParams; 
}) => {
  const response = createResponse(true, data, message, undefined, pagination);
  res.status(202).json(response);
};

export const sendNoContent = ({ res, message = 'No content' }: { res: Response; message?: string }) => {
  const response = createResponse(true, undefined, message);
  res.status(204).json(response);
};

// Error responses
export const sendBadRequest = ({ res, error = 'Bad request', message }: { 
  res: Response; 
  error?: string; 
  message?: string; 
}) => {
  const response = createResponse(false, undefined, message, error);
  res.status(400).json(response);
};

export const sendUnauthorized = ({ res, error = 'Unauthorized', message }: { 
  res: Response; 
  error?: string; 
  message?: string; 
}) => {
  const response = createResponse(false, undefined, message, error);
  res.status(401).json(response);
};

export const sendForbidden = ({ res, error = 'Forbidden', message }: { 
  res: Response; 
  error?: string; 
  message?: string; 
}) => {
  const response = createResponse(false, undefined, message, error);
  res.status(403).json(response);
};

export const sendNotFound = ({ res, error = 'Not found', message }: { 
  res: Response; 
  error?: string; 
  message?: string; 
}) => {
  const response = createResponse(false, undefined, message, error);
  res.status(404).json(response);
};

export const sendConflict = ({ res, error = 'Conflict', message }: { 
  res: Response; 
  error?: string; 
  message?: string; 
}) => {
  const response = createResponse(false, undefined, message, error);
  res.status(409).json(response);
};

export const sendUnprocessableEntity = ({ res, error = 'Validation failed', message, details }: { 
  res: Response; 
  error?: string; 
  message?: string; 
  details?: any; 
}) => {
  const response = createResponse(false, details, message, error);
  res.status(422).json(response);
};

export const sendTooManyRequests = ({ res, error = 'Too many requests', message }: { 
  res: Response; 
  error?: string; 
  message?: string; 
}) => {
  const response = createResponse(false, undefined, message, error);
  res.status(429).json(response);
};

export const sendInternalServerError = ({ res, error = 'Internal server error', message }: { 
  res: Response; 
  error?: string; 
  message?: string; 
}) => {
  const response = createResponse(false, undefined, message, error);
  res.status(500).json(response);
};

export const sendServiceUnavailable = ({ res, error = 'Service unavailable', message }: { 
  res: Response; 
  error?: string; 
  message?: string; 
}) => {
  const response = createResponse(false, undefined, message, error);
  res.status(503).json(response);
};

// Legacy functions for backward compatibility
export const sendResponse = ({ res, status, data, message, pagination }: { 
  res: Response; 
  status: number; 
  data: any; 
  message: string; 
  pagination?: PaginationParams; 
}) => {
  const response = createResponse(status >= 200 && status < 300, data, message, undefined, pagination);
  res.status(status).json(response);
};

export const sendError = ({ res, status, message }: { 
  res: Response; 
  status: number; 
  message: string; 
}) => {
  const response = createResponse(false, undefined, message, message);
  res.status(status).json(response);
};

// Specialized response functions
export const sendValidationError = ({ res, errors }: { 
  res: Response; 
  errors: Array<{ field: string; message: string }>; 
}) => {
  const response = createResponse(false, { errors }, 'Validation failed', 'Validation failed');
  res.status(422).json(response);
};

export const sendPaginationResponse = <T>({ res, data, pagination, message = 'Success' }: { 
  res: Response; 
  data: T[]; 
  pagination: PaginationParams; 
  message?: string; 
}) => {
  const response = createResponse(true, data, message, undefined, pagination);
  res.status(200).json(response);
};

export const sendDeleteResponse = ({ res, id, message = 'Deleted successfully' }: { 
  res: Response; 
  id: string; 
  message?: string; 
}) => {
  const response = createResponse(true, { id }, message);
  res.status(200).json(response);
};

export const sendUpdateResponse = <T>({ res, data, message = 'Updated successfully' }: { 
  res: Response; 
  data: T; 
  message?: string; 
}) => {
  const response = createResponse(true, data, message);
  res.status(200).json(response);
};

export const sendSearchResponse = <T>({ res, data, query, total, message = 'Search completed' }: { 
  res: Response; 
  data: T[]; 
  query: string; 
  total: number; 
  message?: string; 
}) => {
  const response = createResponse(true, data, message, undefined, { totalCount: total });
  res.status(200).json(response);
};  