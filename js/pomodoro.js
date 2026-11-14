/**
 * O timer. Usa o horário de término (endsAt), e não contagem de ticks,
 * então continua correto mesmo se o navegador atrasar a execução.
 * Estados: "idle" (parado), "running" (rodando), "paused" (pausado).
 * Emite o evento "done" com { mode, task, minutes } ao terminar.
 */
Gatinho.Pomodoro = class Pomodoro extends EventTarget {
  constructor(saved) {
    super();
    this._reset();
    if (saved && saved.mode !== 'idle') {
      const { mode, task, totalSec, endsAt, leftSec, running } = saved;
      Object.assign(this, { mode, task, totalSec, endsAt, leftSec, running });
    }
  }

  get state() {
    if (this.mode === 'idle') return 'idle';
    return this.running ? 'running' : 'paused';
  }

  /** Segundos restantes. */
  remaining() {
    if (!this.running) return this.leftSec;
    return Math.max(0, Math.ceil((this.endsAt - Date.now()) / 1000));
  }

  /** mode: "focus" ou "break". */
  start({ mode, minutes, task }) {
    this.mode = mode;
    this.task = task;
    this.totalSec = minutes * 60;
    this.leftSec = this.totalSec;
    this.resume();
  }

  pause() {
    if (!this.running) return;
    this.leftSec = this.remaining();
    this.running = false;
  }

  resume() {
    this.endsAt = Date.now() + this.leftSec * 1000;
    this.running = true;
  }

  cancel() {
    this._reset();
  }

  /** Chame periodicamente: finaliza o timer quando o tempo acaba. */
  check() {
    if (this.running && this.remaining() === 0) this._finish();
  }

  toJSON() {
    const { mode, task, totalSec, endsAt, leftSec, running } = this;
    return { mode, task, totalSec, endsAt, leftSec, running };
  }

  _finish() {
    const detail = { mode: this.mode, task: this.task, minutes: this.totalSec / 60 };
    this._reset();
    this.dispatchEvent(new CustomEvent('done', { detail }));
  }

  _reset() {
    this.mode = 'idle';
    this.task = '';
    this.totalSec = 0;
    this.endsAt = 0;
    this.leftSec = 0;
    this.running = false;
  }
};
