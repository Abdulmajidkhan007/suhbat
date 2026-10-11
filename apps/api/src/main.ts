import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SocketIoAdapter } from './common/socket-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const origins = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()) ?? true;
  app.enableCors({ origin: origins });
  app.useWebSocketAdapter(new SocketIoAdapter(app, origins));
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  console.log(`suhbat api: http://localhost:${port}`);
}

void bootstrap();
