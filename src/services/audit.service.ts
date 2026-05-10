import { prisma } from '../config/prisma';
import { logger } from '../config/logger';

export class AuditService {
  async log(
    entityType: string,
    entityId: string,
    action: string,
    oldValue: unknown,
    newValue: unknown,
    changedBy: string,
    userId?: string,
    ipAddress?: string
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          entityType,
          entityId,
          action,
          oldValue: oldValue as never,
          newValue: newValue as never,
          changedBy,
          userId,
          ipAddress,
        },
      });
    } catch (err) {
      // Audit failures must never break the main flow
      logger.error('Failed to create audit log', { entityType, entityId, action, err });
    }
  }
}

export const auditService = new AuditService();
