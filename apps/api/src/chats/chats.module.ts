import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { ChatGateway } from './chat.gateway';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { MediaController } from './media.controller';
import { PresenceService } from './presence.service';

@Module({
  imports:     [AuthModule, MediaModule],
  controllers: [ChatsController, MediaController],
  providers:   [ChatsService, PresenceService, ChatGateway],
})
export class ChatsModule {}
