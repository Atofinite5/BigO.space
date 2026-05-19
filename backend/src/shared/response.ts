import { Response } from 'express';

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  [key: string]: unknown;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: ApiMeta;
  timestamp: string;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  meta?: ApiMeta,
): void {
  const body: ApiResponse<T> = {
    success: true,
    data,
    ...(meta ? { meta } : {}),
    timestamp: new Date().toISOString(),
  };
  res.status(statusCode).json(body);
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): void {
  const body: ApiResponse = {
    success: false,
    error: { code, message, ...(details !== undefined ? { details } : {}) },
    timestamp: new Date().toISOString(),
  };
  res.status(statusCode).json(body);
}
