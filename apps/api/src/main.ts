import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app/app.module';
import { isAllowedOrigin } from './cors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new WsAdapter(app));
  app.enableShutdownHooks();
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  app.enableCors({
    // Requests without an Origin header (curl, server-to-server) are not browser CORS requests.
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) =>
      callback(null, !origin || isAllowedOrigin(origin)),
    credentials: true,
  });
  const port = Number(process.env.PORT) || 4000;
  await app.listen(port);
  Logger.log(`API http://localhost:${port}/${globalPrefix}`);
  Logger.log(`WS  ws://localhost:${port}/ws/events`);
}

bootstrap();
