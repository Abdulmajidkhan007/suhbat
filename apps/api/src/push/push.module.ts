import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DevicesController } from './devices.controller';
import { FcmClient } from './fcm.client';
import { PushService } from './push.service';

/** Push bildirishnomalar (FCM HTTP v1). `FCM_SERVICE_ACCOUNT_JSON` bo'lmasa o'chiq. */
@Module({
  imports:     [AuthModule],
  controllers: [DevicesController],
  providers:   [FcmClient, PushService],
  exports:     [PushService],
})
export class PushModule {}
