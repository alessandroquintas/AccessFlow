import { Module } from '@nestjs/common';
import { PrismaModule } from './shared/infrastructure/database/prisma.module';
import { ConfigModule } from '@nestjs/config';
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
})
export class AppModule {}
