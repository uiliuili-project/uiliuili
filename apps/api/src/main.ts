import 'reflect-metadata';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { getOrCreateInstallToken, instanceExists } from '@uiliuili/installer';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { config, requireInstalledConfig } from './config';
import { InstallAppModule } from './install/install-app.module';
import { RedisIoAdapter } from './realtime/redis-io.adapter';

async function bootstrap(): Promise<void> {
  const installed = instanceExists();
  if (installed) requireInstalledConfig();

  const adapter = new FastifyAdapter({
    trustProxy: config.trustProxy,
    bodyLimit: 32 * 1024 * 1024,
  });
  const app = await NestFactory.create<NestFastifyApplication>(
    installed ? AppModule : InstallAppModule,
    adapter,
    { bufferLogs: false },
  );

  await app.register(cookie as never, {
    secret: config.appKey || 'uiliuili-install-mode',
  });
  await app.register(helmet as never, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
  await app.register(cors as never, {
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow: boolean) => void,
    ) => {
      if (!origin) return callback(null, true);
      const allowed = new Set([
        config.appUrl,
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3002',
        'http://127.0.0.1:3002',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
      ]);
      callback(null, allowed.has(origin));
    },
    credentials: true,
  });

  const fastify = app.getHttpAdapter().getInstance();
  for (const contentType of [
    'application/octet-stream',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/vtt',
  ]) {
    fastify.addContentTypeParser(
      contentType,
      { parseAs: 'buffer', bodyLimit: 32 * 1024 * 1024 },
      (_request, body, done) => done(null, body),
    );
  }

  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  if (installed) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('uiliuili API')
      .setDescription('Danmaku video platform API')
      .setVersion('0.1.0')
      .addCookieAuth('ul_access')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  if (config.redisUrl) {
    const redisAdapter = new RedisIoAdapter(app);
    try {
      await redisAdapter.connectToRedis(config.redisUrl);
      app.useWebSocketAdapter(redisAdapter);
      const closeRedis = () => void redisAdapter.close();
      process.once('SIGINT', closeRedis);
      process.once('SIGTERM', closeRedis);
    } catch (error) {
      new Logger('Bootstrap').warn(
        `Redis adapter unavailable, using in-memory Socket.IO: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  const logger = new Logger('Bootstrap');
  await app.listen({ port: config.apiPort, host: '0.0.0.0' });
  logger.log(`uiliuili API listening on http://0.0.0.0:${config.apiPort}`);

  if (!installed) {
    const token = getOrCreateInstallToken(process.cwd());
    logger.warn('uiliuili is not installed yet.');
    logger.warn(`Open the web installer at ${config.appUrl}/admin/install`);
    logger.warn(`Installer token: ${token}`);
  }
}

void bootstrap().catch((error) => {
  console.error('Failed to start uiliuili API', error);
  process.exit(1);
});
