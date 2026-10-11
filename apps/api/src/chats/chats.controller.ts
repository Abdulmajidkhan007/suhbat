import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CreateDirectChatInputSchema, MessagesQuerySchema, SendMessageInputSchema } from '@suhbat/core';
import type { CreateDirectChatInput, MessagesQuery, SendMessageInput } from '@suhbat/core';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthedRequest } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ChatGateway } from './chat.gateway';
import { ChatsService } from './chats.service';

@Controller('chats')
@UseGuards(JwtAuthGuard)
export class ChatsController {
  constructor(
    private readonly chats: ChatsService,
    private readonly gateway: ChatGateway,
  ) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.chats.list(req.user.sub);
  }

  /** Idempotent: juftlik uchun chat bor bo'lsa — o'sha qaytadi. */
  @Post('direct')
  @HttpCode(200)
  async createDirect(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(CreateDirectChatInputSchema)) body: CreateDirectChatInput,
  ) {
    const chat = await this.chats.createDirect(req.user.sub, body.userId);
    await this.gateway.syncPresence(chat.members.map((m) => m.user.id));
    return chat;
  }

  @Get(':id')
  get(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.chats.getSummary(id, req.user.sub);
  }

  @Get(':id/messages')
  messages(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(MessagesQuerySchema)) query: MessagesQuery,
  ) {
    return this.chats.listMessages(id, req.user.sub, query);
  }

  /** Asosiy yo'l — WebSocket `message:send`; bu REST zaxira (va testlar uchun). */
  @Post(':id/messages')
  async send(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(SendMessageInputSchema)) body: SendMessageInput,
  ) {
    const { message, memberIds } = await this.chats.sendMessage(id, req.user.sub, body.content);
    this.gateway.emitMessageNew(message, memberIds, body.clientId);
    return message;
  }
}
