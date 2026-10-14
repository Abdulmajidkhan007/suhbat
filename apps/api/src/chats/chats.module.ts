import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { PushModule } from '../push/push.module';
import { ChatGateway } from './chat.gateway';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { ConnectionHoldService } from './connection-hold.service';
import { MediaController } from './media.controller';
import { PresenceService } from './presence.service';

@Module({
  imports:     [AuthModule, MediaModule, PushModule],
  controllers: [ChatsController, MediaController],
  providers:   [ChatsService, PresenceService, ConnectionHoldService, ChatGateway],
  exports:     [ChatsService, PresenceService, ConnectionHoldService, ChatGateway],
})
export class ChatsModule {}
