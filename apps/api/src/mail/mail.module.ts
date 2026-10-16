import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createMailer, Mailer } from './mailer';

/** `Mailer` — env bo'yicha Resend, SMTP yoki o'chiq. Testlarda `overrideProvider(Mailer)`. */
@Global()
@Module({
  providers: [{ provide: Mailer, inject: [ConfigService], useFactory: (config: ConfigService) => createMailer(config) }],
  exports:   [Mailer],
})
export class MailModule {}
