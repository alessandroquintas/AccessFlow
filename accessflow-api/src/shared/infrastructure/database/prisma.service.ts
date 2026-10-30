import {
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnApplicationShutdown
{
  constructor() {
    super({
      log: ['warn'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  /**
   * No fim do close() do Nest, depois de o servidor HTTP fechar e as
   * requisições em andamento terminarem. Em onModuleDestroy, que roda antes
   * de tudo, desconectaria com consultas ainda em curso.
   */
  async onApplicationShutdown(): Promise<void> {
    await this.$disconnect();
  }
}
