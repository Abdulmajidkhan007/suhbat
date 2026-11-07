import { Global, Module } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { PrivacyController } from './privacy.controller';

@Global()
@Module({ controllers: [PrivacyController], providers: [ActivityService], exports: [ActivityService] })
export class ActivityModule {}
