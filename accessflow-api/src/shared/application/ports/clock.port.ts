/** Fonte da hora atual. Injetável para que testes controlem o tempo. */
export abstract class ClockPort {
  abstract now(): Date;
}
