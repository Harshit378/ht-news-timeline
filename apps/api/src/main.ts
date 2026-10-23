import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new WsAdapter(app));
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  // Capacitor serves the app from capacitor://localhost (iOS) and http://localhost (Android).
  const nativeOrigins = ['capacitor://localhost', 'http://localhost'];
  app.enableCors({
    origin: [
      ...(process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3000']),
      ...nativeOrigins,
    ],
    credentials: true,
  });
  const port = Number(process.env.PORT) || 4000;
  await app.listen(port);
  Logger.log(`API http://localhost:${port}/${globalPrefix}`);
  Logger.log(`WS  ws://localhost:${port}/ws/events`);
}

bootstrap();
