import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { EnvService } from './config/env.service';
import { setupSwagger } from './shared/presentation/http/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const env = app.get(EnvService);

  // SIGTERM (ECS) e SIGINT: o readiness passa a 503, espera a drenagem
  // (SHUTDOWN_DRAIN_SECONDS), o servidor para de aceitar conexões e espera as
  // requisições em andamento, e só então o Prisma desconecta. A ordem está
  // nos hooks de ShutdownState e PrismaService.
  app.enableShutdownHooks();

  setupSwagger(app, env);

  await app.listen(env.get('PORT'));
}
void bootstrap();
