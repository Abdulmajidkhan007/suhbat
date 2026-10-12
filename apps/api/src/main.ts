import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { SocketIoAdapter } from './common/socket-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const origins = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()) ?? true;
  // Caddy/nginx ortida haqiqiy mijoz IP'si (rate limit uchun): TRUST_PROXY=<proksi soni>.
  const hops = Number(process.env.TRUST_PROXY);
  if (Number.isInteger(hops) && hops > 0) app.set('trust proxy', hops);
  app.enableCors({ origin: origins });
  app.useWebSocketAdapter(new SocketIoAdapter(app, origins));
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  console.log(`suhbat api: http://localhost:${port}`);
}

void bootstrap();
