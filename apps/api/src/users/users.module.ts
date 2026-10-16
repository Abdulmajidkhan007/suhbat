import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsernameController } from './username.controller';
import { UsersController } from './users.controller';

@Module({ imports: [AuthModule], controllers: [UsernameController, UsersController] })
export class UsersModule {}
