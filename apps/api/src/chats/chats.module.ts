import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatGateway } from './chat.gateway';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { PresenceService } from './presence.service';

@Module({
  imports:     [AuthModule],
  controllers: [ChatsController],
  providers:   [ChatsService, PresenceService, ChatGateway],
})
export class ChatsModule {}
