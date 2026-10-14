import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatsModule } from '../chats/chats.module';
import { PushModule } from '../push/push.module';
import { CallsController } from './calls.controller';
import { CallsGateway } from './calls.gateway';

/** 1:1 ovozli/video qo'ng'iroqlar: Socket.IO signali va ICE (STUN/TURN) serverlar. */
@Module({
  imports:     [AuthModule, ChatsModule, PushModule],
  controllers: [CallsController],
  providers:   [CallsGateway],
})
export class CallsModule {}
