import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { NoResultError } from 'kysely';
import { ZodValidationException } from 'nestjs-zod';

type ApiError = { statusCode: number; error: string; message: unknown };
type PgError = { code?: string; detail?: string };

const STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  500: 'Internal Server Error',
};

const body = (statusCode: number, message: unknown): ApiError => ({
  statusCode,
  error: STATUS_TEXT[statusCode] ?? 'Error',
  message,
});

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof ZodValidationException) {
      const issues = exception.getZodError();
      return response.status(HttpStatus.BAD_REQUEST).json(body(400, issues));
    }

    if (exception instanceof NoResultError) {
      return response.status(HttpStatus.NOT_FOUND).json(body(404, 'Resource not found'));
    }

    const pg = exception as PgError;
    if (pg?.code === '23505') {
      const field = pg.detail?.match(/\((.*?)\)=/)?.[1];
      const message = field ? `Поле "${field}" уже занято` : 'Такая запись уже существует';
      return response.status(HttpStatus.CONFLICT).json(body(409, message));
    }
    if (pg?.code === '23503') {
      return response.status(HttpStatus.BAD_REQUEST).json(body(400, 'Связанная запись не найдена'));
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message =
        typeof res === 'object' && res !== null && 'message' in res ? res.message : res;
      return response.status(status).json(body(status, message));
    }

    return response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(body(500, 'Внутренняя ошибка сервера'));
  }
}
