import { Controller, Get } from '@nestjs/common';
import type { PrivacyInfo } from '@suhbat/core';
import { ActivityService } from './activity.service';

/** Ilova ichidagi «Maxfiylik» sahifasi uchun: jurnal necha kun saqlanadi (tokensiz — kirishdan oldin ham o'qiladi). */
@Controller('privacy')
export class PrivacyController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  info(): PrivacyInfo {
    return { retentionDays: this.activity.retentionDays };
  }
}
