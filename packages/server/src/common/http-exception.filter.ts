import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";
import { BillingError } from "@snackmanager/shared";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("Exception");

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      res.status(status).json(this.normalize(status, exception.getResponse()));
      return;
    }

    // Domain rule violations from the billing engine → 409 Conflict.
    if (exception instanceof BillingError) {
      res.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        error: "BillingError",
        code: exception.code,
        message: exception.message,
      });
      return;
    }

    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
    });
  }

  private normalize(status: number, body: unknown): Record<string, unknown> {
    if (typeof body === "string") return { statusCode: status, message: body };
    return { statusCode: status, ...(body as Record<string, unknown>) };
  }
}
