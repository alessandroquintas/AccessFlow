import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { EnvService } from './config/env.service';
import { setupSwagger } from './shared/presentation/http/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const env = app.get(EnvService);

  setupSwagger(app, env);

  await app.listen(env.get('PORT'));
}
void bootstrap();
