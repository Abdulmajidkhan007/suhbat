import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  AdminActivityQuerySchema, AdminAuditQuerySchema, AdminBulkDeleteInputSchema, AdminMediaQuerySchema, AdminUsersQuerySchema,
} from '@suhbat/core';
import type {
  AdminActivityList, AdminActivityQuery, AdminMediaList, AdminMediaPreview, AdminMediaQuery, AdminOverview, AdminReportList,
  AdminAuditList, AdminAuditQuery, AdminBulkDeleteInput, AdminBulkDeleteResult, AdminRecoveryCodesResponse,
  AdminTempPasswordResponse, AdminUserList, AdminUsersQuery,
} from '@suhbat/core';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AdminGuard } from './admin.guard';
import type { AdminRequest } from './admin.guard';
import { AdminActivityService } from './admin-activity.service';
import { AdminService } from './admin.service';
import type { AdminActor } from './admin.service';

const envNumber = (key: string, fallback: number) => {
  const n = Number(process.env[key]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
const actor = (req: AdminRequest): AdminActor => ({ id: req.user.sub, email: req.adminEmail });
const uuid = new ParseUUIDPipe({ version: '4' });

/** O'qish: IP/endpoint bo'yicha daqiqada `ADMIN_READ_LIMIT` (60); o'zgartirish: `ADMIN_WRITE_LIMIT` (20). */
const readLimit = () => ({ default: { limit: () => envNumber('ADMIN_READ_LIMIT', 60), ttl: () => envNumber('THROTTLE_TTL_MS', 60_000) } });
const writeLimit = () => ({ default: { limit: () => envNumber('ADMIN_WRITE_LIMIT', 20), ttl: () => envNumber('THROTTLE_TTL_MS', 60_000) } });

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly activity: AdminActivityService,
  ) {}

  @Throttle(readLimit())
  @Get('users')
  users(@Query(new ZodValidationPipe(AdminUsersQuerySchema)) q: AdminUsersQuery): Promise<AdminUserList> {
    return this.admin.listUsers(q.q, q.page, q.pageSize);
  }

  @Throttle(readLimit())
  @Get('audit')
  audit(@Query(new ZodValidationPipe(AdminAuditQuerySchema)) q: AdminAuditQuery): Promise<AdminAuditList> {
    return this.admin.listAudit(q.page, q.pageSize);
  }

  @Throttle(readLimit())
  @Get('overview')
  overview(): Promise<AdminOverview> {
    return this.activity.overview();
  }

  @Throttle(readLimit())
  @Get('activity')
  listActivity(@Query(new ZodValidationPipe(AdminActivityQuerySchema)) q: AdminActivityQuery): Promise<AdminActivityList> {
    return this.activity.listActivity(q);
  }

  @Throttle(readLimit())
  @Get('media')
  listMedia(@Query(new ZodValidationPipe(AdminMediaQuerySchema)) q: AdminMediaQuery): Promise<AdminMediaList> {
    return this.activity.listMedia(q);
  }

  /** Faqat ochiq kanal media'si yoki shikoyat qilingan xabar biriktirmasi; aks holda 403. */
  @Throttle(readLimit())
  @Get('media/:attachmentId/preview')
  previewMedia(@Param('attachmentId', uuid) attachmentId: string): Promise<AdminMediaPreview> {
    return this.activity.previewMedia(attachmentId);
  }

  @Throttle(readLimit())
  @Get('reports')
  reports(@Query(new ZodValidationPipe(AdminAuditQuerySchema)) q: AdminAuditQuery): Promise<AdminReportList> {
    return this.activity.listReports(q.page, q.pageSize);
  }

  @Throttle(writeLimit())
  @Post('users/bulk-delete')
  @HttpCode(200)
  bulkDelete(
    @Req() req: AdminRequest,
    @Body(new ZodValidationPipe(AdminBulkDeleteInputSchema)) body: AdminBulkDeleteInput,
  ): Promise<AdminBulkDeleteResult> {
    return this.admin.deleteMany(actor(req), body.ids);
  }

  @Throttle(writeLimit())
  @Post('users/:id/block')
  @HttpCode(204)
  async block(@Req() req: AdminRequest, @Param('id', uuid) id: string): Promise<void> {
    await this.admin.block(actor(req), id);
  }

  @Throttle(writeLimit())
  @Post('users/:id/unblock')
  @HttpCode(204)
  async unblock(@Req() req: AdminRequest, @Param('id', uuid) id: string): Promise<void> {
    await this.admin.unblock(actor(req), id);
  }

  @Throttle(writeLimit())
  @Post('users/:id/revoke-sessions')
  @HttpCode(204)
  async revokeSessions(@Req() req: AdminRequest, @Param('id', uuid) id: string): Promise<void> {
    await this.admin.revokeSessions(actor(req), id);
  }

  @Throttle(writeLimit())
  @Post('users/:id/temp-password')
  @HttpCode(200)
  async tempPassword(@Req() req: AdminRequest, @Param('id', uuid) id: string): Promise<AdminTempPasswordResponse> {
    return { temporaryPassword: await this.admin.setTempPassword(actor(req), id) };
  }

  @Throttle(writeLimit())
  @Post('users/:id/recovery-codes')
  @HttpCode(200)
  async recoveryCodes(@Req() req: AdminRequest, @Param('id', uuid) id: string): Promise<AdminRecoveryCodesResponse> {
    return { codes: await this.admin.regenerateRecoveryCodes(actor(req), id) };
  }

  @Throttle(writeLimit())
  @Delete('users/:id')
  @HttpCode(204)
  async remove(@Req() req: AdminRequest, @Param('id', uuid) id: string): Promise<void> {
    await this.admin.deleteOne(actor(req), id);
  }
}
