import { Controller, Get, Header, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IceServersResponse } from '@suhbat/core';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthedRequest } from '../auth/jwt-auth.guard';
import { buildIceServers, readIceConfig } from './ice-servers';
import type { IceConfig } from './ice-servers';

@Controller('calls')
@UseGuards(JwtAuthGuard)
export class CallsController {
  private readonly ice: IceConfig;

  constructor(config: ConfigService) {
    this.ice = readIceConfig((key) => config.get<string>(key));
  }

  /** STUN + (sozlangan bo'lsa) TURN. TURN credential foydalanuvchiga xos va vaqtinchalik bo'lishi mumkin. */
  @Get('ice-servers')
  @Header('Cache-Control', 'no-store')
  iceServers(@Req() req: AuthedRequest): IceServersResponse {
    return buildIceServers(this.ice, req.user.sub);
  }
}
