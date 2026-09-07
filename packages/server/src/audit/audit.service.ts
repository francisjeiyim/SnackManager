import { Injectable, Logger } from "@nestjs/common";
import type { AuditAction } from "@snackmanager/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuditService {
  private readonly logger = new Logger("Audit");

  constructor(private readonly prisma: PrismaService) {}

  async record(params: {
    action: AuditAction;
    entityType: string;
    entityId: string;
    userId?: string | null;
    data?: unknown;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          userId: params.userId ?? null,
          dataJson: (params.data ?? null) as never,
        },
      });
    } catch (err) {
      // Audit must never break the request it describes.
      this.logger.warn(`failed to write audit entry: ${String(err)}`);
    }
  }
}
