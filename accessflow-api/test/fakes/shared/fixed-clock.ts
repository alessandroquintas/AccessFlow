import { ClockPort } from '@/shared/application/ports/clock.port';

/** Relógio parado: só anda com `set` ou `advance`. */
export class FixedClock extends ClockPort {
  private current: Date;

  constructor(initial: Date = new Date('2026-01-01T00:00:00.000Z')) {
    super();
    this.current = new Date(initial);
  }

  now(): Date {
    return new Date(this.current);
  }

  set(date: Date): void {
    this.current = new Date(date);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
