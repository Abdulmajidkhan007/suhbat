import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  AddMembersInputSchema,
  CreateChannelInputSchema,
  CreateDirectChatInputSchema,
  CreateGroupInputSchema,
  ReportMessageInputSchema,
  EditMessageInputSchema,
  MessagesQuerySchema,
  PublicChannelsQuerySchema,
  SendMessageInputSchema,
  SetReactionInputSchema,
  UpdateChatInputSchema,
  UpdateMemberRoleInputSchema,
} from '@suhbat/core';
import type {
  AddMembersInput,
  CreateChannelInput,
  CreateDirectChatInput,
  CreateGroupInput,
  EditMessageInput,
  MessagesQuery,
  PublicChannelsQuery,
  ReactionState,
  ReportMessageInput,
  SendMessageInput,
  SetReactionInput,
  UpdateChatInput,
  UpdateMemberRoleInput,
} from '@suhbat/core';
import { ActivityService } from '../activity/activity.service';
import { httpContext } from '../activity/request-context';
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
    private readonly activity: ActivityService,
  ) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.chats.list(req.user.sub);
  }

  /** Ochiq kanallar qidiruvi. `:id` dan oldin turishi shart. */
  @Get('public')
  searchPublic(
    @Req() req: AuthedRequest,
    @Query(new ZodValidationPipe(PublicChannelsQuerySchema)) query: PublicChannelsQuery,
  ) {
    return this.chats.searchPublicChannels(req.user.sub, query);
  }

  /** Idempotent: juftlik uchun chat bor bo'lsa — o'sha qaytadi. */
  @Post('direct')
  @HttpCode(200)
  async createDirect(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(CreateDirectChatInputSchema)) body: CreateDirectChatInput,
  ) {
    // Idempotent: bor chat qayta so'ralsa "yaratildi" deb yozilmaydi.
    const chat = await this.chats.createDirect(req.user.sub, body.userId, (chatId) =>
      this.activity.record({ type: 'chat_create', userId: req.user.sub, chatId, ...httpContext(req) }));
    await this.gateway.syncPresence(chat.members.map((m) => m.user.id));
    return chat;
  }

  @Post('group')
  async createGroup(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(CreateGroupInputSchema)) body: CreateGroupInput,
  ) {
    const { chat, added } = await this.chats.createGroup(req.user.sub, body);
    this.activity.record({ type: 'chat_create', userId: req.user.sub, chatId: chat.id, ...httpContext(req) });
    // Qo'shilganlar chatdan xabar topishi uchun (faqat o'ziga: ular chatni yuklab oladi).
    for (const userId of added) {
      this.gateway.emitMemberChange({
        event: {
          chatId:      chat.id,
          userId,
          action:      'added',
          member:      chat.members.find((m) => m.user.id === userId) ?? null,
          memberCount: chat.memberCount,
        },
        recipientIds: [userId],
      });
    }
    this.gateway.syncPresenceBetween([req.user.sub], added);
    return chat;
  }

  @Post('channel')
  async createChannel(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(CreateChannelInputSchema)) body: CreateChannelInput,
  ) {
    const chat = await this.chats.createChannel(req.user.sub, body);
    this.activity.record({ type: 'channel_create', userId: req.user.sub, chatId: chat.id, ...httpContext(req) });
    return chat;
  }

  @Get(':id')
  get(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.chats.getSummary(id, req.user.sub);
  }

  @Patch(':id')
  async update(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateChatInputSchema)) body: UpdateChatInput,
  ) {
    const { event, recipientIds } = await this.chats.updateChat(id, req.user.sub, body);
    this.gateway.emitChatUpdated(event, recipientIds);
    return this.chats.getSummary(id, req.user.sub);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    const memberIds = await this.chats.deleteChat(id, req.user.sub);
    this.gateway.emitChatDeleted(id, memberIds);
  }

  /** Ochiq kanalga obuna bo'lish (idempotent). */
  @Post(':id/join')
  @HttpCode(200)
  async join(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    const { chat, change } = await this.chats.join(id, req.user.sub);
    if (change) {
      this.gateway.emitMemberChange(change);
      this.activity.record({ type: 'group_join', userId: req.user.sub, chatId: id, ...httpContext(req) });
    }
    return chat;
  }

  @Post(':id/leave')
  @HttpCode(204)
  async leave(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    this.gateway.emitMemberChange(await this.chats.leave(id, req.user.sub));
    this.activity.record({ type: 'group_leave', userId: req.user.sub, chatId: id, ...httpContext(req) });
  }

  @Post(':id/members')
  @HttpCode(200)
  async addMembers(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AddMembersInputSchema)) body: AddMembersInput,
  ) {
    const { chat, changes } = await this.chats.addMembers(id, req.user.sub, body);
    changes.forEach((c) => this.gateway.emitMemberChange(c));
    if (chat.type === 'group') {
      this.gateway.syncPresenceBetween(
        changes.map((c) => c.event.userId),
        chat.members.map((m) => m.user.id),
      );
    }
    return chat;
  }

  @Delete(':id/members/:userId')
  @HttpCode(204)
  async removeMember(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    this.gateway.emitMemberChange(await this.chats.removeMember(id, req.user.sub, userId));
  }

  @Patch(':id/members/:userId')
  async setRole(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(new ZodValidationPipe(UpdateMemberRoleInputSchema)) body: UpdateMemberRoleInput,
  ) {
    const change = await this.chats.setRole(id, req.user.sub, userId, body.role);
    this.gateway.emitMemberChange(change);
    return change.event.member;
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
    const { message, memberIds } = await this.chats.sendMessage(id, req.user.sub, body.content, body.attachmentId, body.replyToId);
    this.gateway.emitMessageNew(message, memberIds, body.clientId);
    this.activity.messageSent(httpContext(req), req.user.sub, message);
    return message;
  }

  @Patch(':id/messages/:messageId')
  async editMessage(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body(new ZodValidationPipe(EditMessageInputSchema)) body: EditMessageInput,
  ) {
    const { message, memberIds } = await this.chats.editMessage(id, req.user.sub, messageId, body.content);
    this.gateway.emitMessageUpdated(message, memberIds);
    return message;
  }

  @Delete(':id/messages/:messageId')
  async deleteMessage(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    const { deletedAt, memberIds } = await this.chats.deleteMessage(id, req.user.sub, messageId);
    this.gateway.emitMessageDeleted(id, messageId, deletedAt, memberIds);
    this.activity.record({ type: 'message_delete', userId: req.user.sub, chatId: id, ...httpContext(req) });
    return { deletedAt };
  }

  /** Shikoyat: shu xabarning mazmuni (va biriktirmasi) adminga ko'rinadi; boshqa xabarlar — yo'q. */
  @Post(':id/messages/:messageId/report')
  @HttpCode(204)
  async reportMessage(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body(new ZodValidationPipe(ReportMessageInputSchema)) body: ReportMessageInput,
  ) {
    await this.chats.reportMessage(id, req.user.sub, messageId, body.reason);
    this.activity.record({ type: 'report', userId: req.user.sub, chatId: id, ...httpContext(req) });
  }

  /** Reaksiya qo'yish/almashtirish; `{ emoji: null }` — olib tashlash. Idempotent. */
  @Put(':id/messages/:messageId/reaction')
  async setReaction(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body(new ZodValidationPipe(SetReactionInputSchema)) body: SetReactionInput,
  ): Promise<ReactionState> {
    const { reactions, myReaction, memberIds } = await this.chats.setReaction(id, req.user.sub, messageId, body.emoji);
    this.gateway.emitMessageReaction({ chatId: id, messageId, userId: req.user.sub, emoji: myReaction, reactions }, memberIds);
    return { reactions, myReaction };
  }
}
