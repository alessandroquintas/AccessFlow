import { Module } from '@nestjs/common';
import { ClockPort } from '@/shared/application/ports/clock.port';
import { SystemClock } from './system-clock';

@Module({
  providers: [{ provide: ClockPort, useClass: SystemClock }],
  exports: [ClockPort],
})
export class ClockModule {}
