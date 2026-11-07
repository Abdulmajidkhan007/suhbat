import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatsModule } from '../chats/chats.module';
import { MediaModule } from '../media/media.module';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

/** Admin panel API: foydalanuvchilarni ko'rish/boshqarish. Faqat `ADMIN_EMAILS` dagilar (aks holda 404). */
@Module({
  imports:     [AuthModule, ChatsModule, MediaModule],
  controllers: [AdminController],
  providers:   [AdminService, AdminGuard],
})
export class AdminModule {}
