import { FastifyReply } from 'fastify';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: { code: string; details?: unknown };
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function sendSuccess<T>(
  reply: FastifyReply,
  data: T,
  message = 'Success',
  statusCode = 200,
  meta?: PaginationMeta
): void {
  void reply.status(statusCode).send({
    success: true,
    message,
    data,
    ...(meta !== undefined && { meta }),
  } satisfies ApiResponse<T>);
}

export function sendCreated<T>(reply: FastifyReply, data: T, message = 'Created'): void {
  sendSuccess(reply, data, message, 201);
}

export function sendError(
  reply: FastifyReply,
  message: string,
  statusCode: number,
  code: string,
  details?: unknown
): void {
  void reply.status(statusCode).send({
    success: false,
    message,
    error: { code, ...(details !== undefined && { details }) },
  } satisfies ApiResponse<never>);
}

export function paginationMeta(page: number, limit: number, total: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
