import { ClockPort } from '@/shared/application/ports/clock.port';

export class SystemClock extends ClockPort {
  now(): Date {
    return new Date();
  }
}
